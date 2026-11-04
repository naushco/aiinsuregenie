// api/admin.js: lead stats for the dashboard (admin password required).
//   GET /api/admin?action=dashboard&days=30
//   GET /api/admin?action=leads
//   GET /api/admin?action=funnel&days=30      (chat events per session)
//   GET /api/admin?action=subscribers         (email sign-ups)
//   GET /api/admin?action=optouts             (Do Not Sell requests)
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
    if (action === "funnel") {
      // Events from the chat, counted per unique chat session so repeats don't inflate numbers.
      var raw = (await kv(["LRANGE", "events", "0", "49999"])) || [];
      var since0 = new Date(Date.now() - days * 86400000).toISOString();
      var steps = ["chat_started", "match_shown", "no_match", "partner_click", "call_request", "email_signup"];
      var sess = {}, byDay = {}, byCampaign = {}, byPartner = {}, byState = {};
      steps.forEach(function (t) { sess[t] = {}; });
      raw.forEach(function (v) {
        var e; try { e = JSON.parse(v); } catch (x) { return; }
        if (!e || e.at < since0 || !sess[e.type]) return;
        sess[e.type][e.session_id] = 1;
        var d = e.at.slice(0, 10); byDay[d] = byDay[d] || {}; byDay[d][e.type] = (byDay[d][e.type] || 0) + 1;
        var c = e.utm_campaign || "(none)"; byCampaign[c] = byCampaign[c] || {}; byCampaign[c][e.type] = (byCampaign[c][e.type] || 0) + 1;
        if (e.type === "partner_click" && e.partner_id) byPartner[e.partner_id] = (byPartner[e.partner_id] || 0) + 1;
        if (e.type === "no_match") byState[e.state || "?"] = (byState[e.state || "?"] || 0) + 1;
      });
      var totals = {}; steps.forEach(function (t) { totals[t] = Object.keys(sess[t]).length; });
      return res.status(200).json({ period_days: days, sessions: totals, by_day: byDay, by_campaign: byCampaign, clicks_by_partner: byPartner, no_match_by_state: byState });
    }
    if (action === "subscribers") {
      var emails = (await kv(["LRANGE", "subscribers", "0", "9999"])) || [];
      var recs = emails.length ? await kv(["MGET"].concat(emails.map(function (e) { return "sub:" + e; }))) : [];
      var list = (recs || []).map(function (v) { try { return JSON.parse(v); } catch (e) { return null; } }).filter(Boolean)
        .map(function (r) { delete r.unsub_token; delete r.ip_address; delete r.user_agent; return r; });
      return res.status(200).json({ total: list.length, subscribers: list });
    }
    if (action === "optouts") {
      var oids = (await kv(["LRANGE", "optouts", "0", "4999"])) || [];
      var ovals = oids.length ? await kv(["MGET"].concat(oids.map(function (i) { return "optreq:" + i; }))) : [];
      return res.status(200).json({ optouts: (ovals || []).map(function (v) { try { return JSON.parse(v); } catch (e) { return null; } }).filter(Boolean) });
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
