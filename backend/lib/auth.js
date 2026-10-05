// lib/auth.js: admin password check for the dashboard and admin API.
// The password lives ONLY in the ADMIN_PASSWORD environment variable.
const crypto = require("crypto");
const { ip } = require("./http");

var fails = {};
function sha(s) { return crypto.createHash("sha256").update(String(s)).digest(); }

// Returns true if the request carries the right password. Otherwise it sends the error and returns false.
exports.adminGate = function (req, res) {
  var pw = process.env.ADMIN_PASSWORD;
  if (!pw) {
    res.status(503).json({ error: "Admin is not set up. Add ADMIN_PASSWORD in your Vercel project settings." });
    return false;
  }
  var who = ip(req), now = Date.now();
  fails[who] = (fails[who] || []).filter(function (t) { return now - t < 10 * 60 * 1000; });
  if (fails[who].length >= 8) {
    res.status(429).json({ error: "Too many wrong attempts. Try again in 10 minutes." });
    return false;
  }
  var h = String(req.headers.authorization || "");
  var tok = h.indexOf("Bearer ") === 0 ? h.slice(7) : "";
  if (!crypto.timingSafeEqual(sha(tok), sha(pw))) {
    fails[who].push(now);
    res.status(401).json({ error: "Wrong password." });
    return false;
  }
  return true;
};
