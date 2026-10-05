// api/admin.js: lead stats for the dashboard (admin password required).
//   GET /api/admin?action=dashboard&days=30
//   GET /api/admin?action=leads
const { kv, kvConfigured } = require("../lib/kv");
const { cors } = require("../lib/http");
const { adminGate } = require("../lib/auth");

module.exports = async function handler(req, res) {
  cors(req, res, "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!adminGate(req, res)) return;

  try {
    var action = (req.query && req.query.action) || "dashboard";
    var days = Math.min(Math.max(parseInt(req.query && req.query.days) || 30, 1), 365);
    if (!kvConfigured()) {
      return res.status(200).json({ storage: false, stats: { total_leads: 0, last_period: 0 }, recent_leads: [] });
    }
    var ids = (await kv(["LRANGE", "leads", "0", "999"])) || [];
    var vals = ids.length ? await kv(["MGET"].concat(ids.map(function (i) { return "lead:" + i; }))) : [];
    var leads = (vals || []).filter(Boolean).map(function (v) { try { return JSON.parse(v); } catch (e) { return null; } }).filter(Boolean);

    if (action === "leads") return res.status(200).json({ total: leads.length, leads: leads.slice(0, 50) });

    var since = new Date(Date.now() - days * 86400000).toISOString();
    var inPeriod = leads.filter(function (l) { return l.created_at >= since; });
    var byState = {}, byPublisher = {};
    inPeriod.forEach(function (l) {
      byState[l.state || "?"] = (byState[l.state || "?"] || 0) + 1;
      byPublisher[l.publisher_id || "direct"] = (byPublisher[l.publisher_id || "direct"] || 0) + 1;
    });
    return res.status(200).json({
      storage: true,
      period_days: days,
      stats: { total_leads: leads.length, last_period: inPeriod.length },
      by_state: byState,
      by_publisher: byPublisher,
      recent_leads: leads.slice(0, 20).map(function (l) {
        return { id: l.id, name: l.first_name, state: l.state, zip: l.zip, publisher: l.publisher_id, created: l.created_at };
      })
    });
  } catch (err) {
    console.error("admin error:", err && err.message);
    return res.status(500).json({ error: "Something went wrong." });
  }
};
