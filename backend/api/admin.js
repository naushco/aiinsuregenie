// api/admin.js — Admin dashboard API
const fs = require("fs");
const path = require("path");

function getDB() {
  try {
    var f = path.join("/tmp", "leads.json");
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch(e) {}
  return { leads: [], consent_log: [], buyer_responses: [] };
}

module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Simple auth check
  var authHeader = req.headers.authorization || "";
  var adminPass = process.env.ADMIN_PASSWORD || "admin123";
  if (!authHeader.includes(adminPass)) {
    return res.status(401).json({ error: "Unauthorized. Pass admin password in Authorization header." });
  }

  var db = getDB();
  var action = req.query.action || "dashboard";
  var days = parseInt(req.query.days) || 30;
  var since = new Date(Date.now() - days * 86400000).toISOString();

  if (action === "dashboard") {
    var total = 0, sold = 0, revenue = 0;
    db.leads.forEach(function(l) {
      if (l.created_at < since) return;
      total++;
      if (l.status === "sold") { sold++; revenue += l.total_revenue || 0; }
    });
    return res.json({
      period: days + " days",
      stats: {
        total_leads: total,
        sold_leads: sold,
        total_revenue: revenue.toFixed(2),
        avg_rpl: total > 0 ? (revenue / total).toFixed(2) : "0",
      },
      recent_leads: db.leads.slice(-20).reverse().map(function(l) {
        return { id: l.id, name: l.first_name, state: l.state, status: l.status, revenue: l.total_revenue, created: l.created_at };
      }),
    });
  }

  if (action === "leads") {
    return res.json({ total: db.leads.length, leads: db.leads.slice(-50).reverse() });
  }

  return res.json({ actions: ["dashboard", "leads"], usage: "/api/admin?action=dashboard&days=30" });
};
