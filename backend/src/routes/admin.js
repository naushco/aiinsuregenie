// src/routes/admin.js — Admin dashboard API
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { queries } = require("../database");

var router = express.Router();

// Simple JWT auth middleware
function authMiddleware(req, res, next) {
  var token = req.headers.authorization;
  if (!token || !token.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    var decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ============================================================
// POST /api/admin/login
// ============================================================
router.post("/login", function (req, res) {
  var email = req.body.email;
  var password = req.body.password;
  if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  var token = jwt.sign({ email: email, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "24h" });
  res.json({ token: token, expires_in: 86400 });
});

// All routes below require auth
router.use(authMiddleware);

// ============================================================
// GET /api/admin/dashboard — Overview stats
// ============================================================
router.get("/dashboard", function (req, res) {
  var days = parseInt(req.query.days) || 30;
  var since = new Date(Date.now() - days * 86400000).toISOString();
  var stats = queries.getTotalStats.get(since);
  var recentLeads = queries.getRecentLeads.all(20);

  res.json({
    period: days + " days",
    stats: {
      total_leads: stats.total_leads || 0,
      sold_leads: stats.sold_leads || 0,
      sell_rate: stats.total_leads > 0 ? ((stats.sold_leads / stats.total_leads) * 100).toFixed(1) + "%" : "0%",
      total_revenue: (stats.total_revenue || 0).toFixed(2),
      avg_revenue_per_lead: (stats.avg_rpl || 0).toFixed(2),
      total_accepts: stats.total_accepts || 0,
      total_rejects: stats.total_rejects || 0,
    },
    recent_leads: recentLeads.map(function (l) {
      return {
        id: l.id,
        name: l.first_name,
        state: l.state,
        status: l.status,
        revenue: l.total_revenue,
        buyers: l.buyers_accepted,
        created: l.created_at,
        publisher: l.publisher_id,
      };
    }),
  });
});

// ============================================================
// GET /api/admin/revenue — Revenue breakdown by day
// ============================================================
router.get("/revenue", function (req, res) {
  var days = parseInt(req.query.days) || 30;
  var since = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
  var data = queries.getDailyRevenue.all(since);

  res.json({
    period: days + " days",
    daily: data,
    totals: {
      revenue: data.reduce(function (s, d) { return s + (d.total_revenue || 0); }, 0).toFixed(2),
      leads: data.reduce(function (s, d) { return s + (d.total_leads || 0); }, 0),
      sold: data.reduce(function (s, d) { return s + (d.sold_leads || 0); }, 0),
    },
  });
});

// ============================================================
// GET /api/admin/buyers — Buyer performance
// ============================================================
router.get("/buyers", function (req, res) {
  var days = parseInt(req.query.days) || 30;
  var since = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
  var data = queries.getBuyerStats.all(since);

  // Aggregate by buyer
  var byBuyer = {};
  data.forEach(function (d) {
    if (!byBuyer[d.buyer_id]) {
      byBuyer[d.buyer_id] = { id: d.buyer_id, name: d.buyer_name, pings: 0, accepts: 0, revenue: 0, avg_bid: 0, bids: [] };
    }
    byBuyer[d.buyer_id].pings += d.total_pings;
    byBuyer[d.buyer_id].accepts += d.post_accepts;
    byBuyer[d.buyer_id].revenue += d.total_payout;
    if (d.avg_bid) byBuyer[d.buyer_id].bids.push(d.avg_bid);
  });

  var buyers = Object.values(byBuyer).map(function (b) {
    return {
      id: b.id,
      name: b.name,
      total_pings: b.pings,
      total_accepts: b.accepts,
      accept_rate: b.pings > 0 ? ((b.accepts / b.pings) * 100).toFixed(1) + "%" : "0%",
      total_revenue: b.revenue.toFixed(2),
      avg_bid: b.bids.length > 0 ? (b.bids.reduce(function (a, c) { return a + c; }, 0) / b.bids.length).toFixed(2) : "0",
    };
  });

  buyers.sort(function (a, b) { return parseFloat(b.total_revenue) - parseFloat(a.total_revenue); });
  res.json({ period: days + " days", buyers: buyers });
});

// ============================================================
// GET /api/admin/publishers — Publisher performance
// ============================================================
router.get("/publishers", function (req, res) {
  var days = parseInt(req.query.days) || 30;
  var since = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
  var data = queries.getDailyRevenue.all(since);

  var byPub = {};
  data.forEach(function (d) {
    var pub = d.publisher_id || "direct";
    if (!byPub[pub]) byPub[pub] = { id: pub, leads: 0, sold: 0, revenue: 0 };
    byPub[pub].leads += d.total_leads;
    byPub[pub].sold += d.sold_leads;
    byPub[pub].revenue += d.total_revenue || 0;
  });

  var publishers = Object.values(byPub).map(function (p) {
    return {
      publisher_id: p.id,
      total_leads: p.leads,
      sold_leads: p.sold,
      sell_rate: p.leads > 0 ? ((p.sold / p.leads) * 100).toFixed(1) + "%" : "0%",
      total_revenue: p.revenue.toFixed(2),
      avg_rpl: p.leads > 0 ? (p.revenue / p.leads).toFixed(2) : "0",
    };
  });

  publishers.sort(function (a, b) { return parseFloat(b.total_revenue) - parseFloat(a.total_revenue); });
  res.json({ period: days + " days", publishers: publishers });
});

module.exports = router;
