// api/privacy.js: "Do Not Sell or Share My Personal Information" requests.
//   POST /api/privacy {email?, phone?, gpc?}
// Records the opt-out. New leads and call requests from an opted-out email or phone are marked
// do_not_sell and are not forwarded to partners; the request is listed in the dashboard so you can
// also remove the person from anything already shared.
const crypto = require("crypto");
const { kv, kvConfigured } = require("../lib/kv");
const { cors, ip } = require("../lib/http");

var hits = {};
function rateLimited(who) {
  var now = Date.now();
  hits[who] = (hits[who] || []).filter(function (t) { return now - t < 600000; });
  if (hits[who].length >= 5) return true;
  hits[who].push(now);
  return false;
}

exports = module.exports = async function handler(req, res) {
  cors(req, res, "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!kvConfigured()) return res.status(503).json({ error: "Storage is not set up." });
  var who = ip(req);
  if (rateLimited(who)) return res.status(429).json({ error: "Too many requests." });

  var b = req.body || {};
  var email = String(b.email || "").trim().toLowerCase().slice(0, 120);
  var phone = String(b.phone || "").replace(/\D/g, "");
  if (phone.length === 11 && phone[0] === "1") phone = phone.slice(1);
  var okEmail = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email), okPhone = phone.length === 10;
  if (!okEmail && !okPhone) return res.status(400).json({ error: "Enter the email or phone number you gave us." });

  var rec = { id: crypto.randomUUID(), at: new Date().toISOString(), email: okEmail ? email : null, phone: okPhone ? phone : null,
    gpc: b.gpc === true, ip_address: who, user_agent: String(req.headers["user-agent"] || "").slice(0, 200) };
  try {
    if (okEmail) await kv(["SET", "optout:e:" + email, rec.at]);
    if (okPhone) await kv(["SET", "optout:p:" + phone, rec.at]);
    await kv(["SET", "optreq:" + rec.id, JSON.stringify(rec)]);
    await kv(["LPUSH", "optouts", rec.id]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("opt-out failed:", e && e.message);
    return res.status(500).json({ error: "Could not save your request." });
  }
};

// Used by leads/callback: true when this email or phone has opted out.
exports.isOptedOut = async function (email, phone) {
  if (!kvConfigured()) return false;
  var keys = [];
  if (email) keys.push("optout:e:" + String(email).toLowerCase());
  if (phone) keys.push("optout:p:" + phone);
  if (!keys.length) return false;
  var vals = await kv(["MGET"].concat(keys));
  return (vals || []).some(Boolean);
};
