// src/database.js — JSON File Database (no native dependencies)
// Zero compilation needed. Works on Render, Vercel, Railway, anywhere.

const path = require("path");
const fs = require("fs");

const DATA_DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, "leads.json");

function getEmptyDB() {
  return { leads: [], consent_log: [], buyer_responses: [] };
}

function readDB() {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch (e) { console.error("DB read error:", e.message); }
  return getEmptyDB();
}

function writeDB(db) {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); } catch (e) { console.error("DB write error:", e.message); }
}

function migrate() {
  if (!fs.existsSync(DB_FILE)) writeDB(getEmptyDB());
  console.log("Database ready at:", DB_FILE);
}

var queries = {
  insertLead: { run: function(lead) { var db = readDB(); db.leads.push(lead); writeDB(db); } },

  insertConsent: { run: function(c) { var db = readDB(); c.id = db.consent_log.length + 1; c.created_at = new Date().toISOString(); db.consent_log.push(c); writeDB(db); } },

  insertBuyerResponse: { run: function(r) { var db = readDB(); r.id = db.buyer_responses.length + 1; r.created_at = new Date().toISOString(); db.buyer_responses.push(r); writeDB(db); } },

  updatePing: { run: function(d) { var db = readDB(); for (var i = 0; i < db.buyer_responses.length; i++) { if (db.buyer_responses[i].lead_id === d.lead_id && db.buyer_responses[i].buyer_id === d.buyer_id) { Object.assign(db.buyer_responses[i], { ping_sent_at: d.ping_sent_at, ping_response: d.ping_response, ping_bid: d.ping_bid, ping_accepted: d.ping_accepted, ping_duration_ms: d.ping_duration_ms, status: d.status }); break; } } writeDB(db); } },

  updatePost: { run: function(d) { var db = readDB(); for (var i = 0; i < db.buyer_responses.length; i++) { if (db.buyer_responses[i].lead_id === d.lead_id && db.buyer_responses[i].buyer_id === d.buyer_id) { Object.assign(db.buyer_responses[i], { post_sent_at: d.post_sent_at, post_response: d.post_response, post_accepted: d.post_accepted, post_lead_id: d.post_lead_id, post_payout: d.post_payout, post_duration_ms: d.post_duration_ms, post_reject_reason: d.post_reject_reason, final_payout: d.final_payout, status: d.status }); break; } } writeDB(db); } },

  updateLeadTotals: { run: function(d) { var db = readDB(); for (var i = 0; i < db.leads.length; i++) { if (db.leads[i].id === d.id) { db.leads[i].total_revenue = d.total_revenue; db.leads[i].buyers_accepted = d.buyers_accepted; db.leads[i].buyers_rejected = d.buyers_rejected; db.leads[i].status = d.status; db.leads[i].updated_at = new Date().toISOString(); break; } } writeDB(db); } },

  findDuplicate: { get: function(p) { var db = readDB(); var hrs = parseInt((p.window || "").replace(/[^0-9]/g, "")) || 72; var cutoff = new Date(Date.now() - hrs * 3600000).toISOString(); for (var i = 0; i < db.leads.length; i++) { var l = db.leads[i]; if ((l.phone === p.phone || l.email === p.email) && l.created_at > cutoff) return { id: l.id, created_at: l.created_at }; } return null; } },

  getLeadById: { get: function(id) { var db = readDB(); for (var i = 0; i < db.leads.length; i++) { if (db.leads[i].id === id) return db.leads[i]; } return null; } },

  getBuyerResponses: { all: function(lid) { var db = readDB(); return db.buyer_responses.filter(function(r) { return r.lead_id === lid; }).sort(function(a, b) { return (b.final_payout || 0) - (a.final_payout || 0); }); } },

  getRecentLeads: { all: function(limit) { var db = readDB(); return db.leads.sort(function(a, b) { return b.created_at > a.created_at ? 1 : -1; }).slice(0, limit || 20); } },

  getDailyRevenue: { all: function(since) { var db = readDB(); var m = {}; db.leads.forEach(function(l) { if (l.created_at < since) return; var d = l.created_at.split("T")[0]; var k = d + "_" + (l.publisher_id || "direct"); if (!m[k]) m[k] = { date: d, publisher_id: l.publisher_id || "direct", total_leads: 0, sold_leads: 0, total_revenue: 0 }; m[k].total_leads++; if (l.status === "sold") { m[k].sold_leads++; m[k].total_revenue += l.total_revenue || 0; } }); return Object.values(m).sort(function(a, b) { return b.date > a.date ? 1 : -1; }); } },

  getBuyerStats: { all: function(since) { var db = readDB(); var m = {}; db.buyer_responses.forEach(function(r) { if (r.created_at < since) return; var k = r.buyer_id + "_" + r.created_at.split("T")[0]; if (!m[k]) m[k] = { buyer_id: r.buyer_id, buyer_name: r.buyer_name, date: r.created_at.split("T")[0], total_pings: 0, ping_accepts: 0, post_accepts: 0, total_payout: 0 }; m[k].total_pings++; if (r.ping_accepted) m[k].ping_accepts++; if (r.post_accepted) m[k].post_accepts++; m[k].total_payout += r.final_payout || 0; }); return Object.values(m).sort(function(a, b) { return b.total_payout - a.total_payout; }); } },

  getTotalStats: { get: function(since) { var s = { total_leads: 0, sold_leads: 0, total_revenue: 0, avg_rpl: 0, total_accepts: 0, total_rejects: 0 }; var db = readDB(); db.leads.forEach(function(l) { if (l.created_at < since) return; s.total_leads++; if (l.status === "sold") s.sold_leads++; s.total_revenue += l.total_revenue || 0; s.total_accepts += l.buyers_accepted || 0; s.total_rejects += l.buyers_rejected || 0; }); s.avg_rpl = s.total_leads > 0 ? s.total_revenue / s.total_leads : 0; return s; } },
};

if (process.argv.includes("--migrate")) { migrate(); process.exit(0); }

module.exports = { migrate: migrate, queries: queries };
