// lib/http.js: shared CORS + client-IP helpers.
// ALLOWED_ORIGIN can be "*" (default) or a comma-separated list, e.g.
// "https://app.aiinsuregenie.com,https://admin.aiinsuregenie.com"

exports.cors = function (req, res, methods) {
  var allow = (process.env.ALLOWED_ORIGIN || "*").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  var origin = req.headers.origin;
  if (allow.indexOf("*") !== -1) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && allow.indexOf(origin) !== -1) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};

exports.ip = function (req) {
  return String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
};
