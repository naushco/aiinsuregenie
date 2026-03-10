// api/health.js — Health check endpoint
module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({ status: "ok", service: "AI InsureGenie API", uptime: process.uptime() });
};
