// api/leads.js — Vercel Serverless Function for lead submission
const { v4: uuidv4 } = require("uuid");

// Simple in-memory + file storage for leads
const fs = require("fs");
const path = require("path");

function getDB() {
  try {
    var f = path.join("/tmp", "leads.json");
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch(e) {}
  return { leads: [], consent_log: [], buyer_responses: [] };
}

function saveDB(db) {
  try { fs.writeFileSync(path.join("/tmp", "leads.json"), JSON.stringify(db)); } catch(e) {}
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "POST") {
    try {
      var data = req.body;
      var errors = [];
      if (!data.first_name || data.first_name.trim().length < 2) errors.push("first_name required");
      if (!data.phone) errors.push("phone required");
      if (!data.email) errors.push("email required");
      if (!data.consent_text) errors.push("consent_text required");
      if (errors.length > 0) return res.status(400).json({ success: false, errors: errors });

      // Normalize phone
      var phone = (data.phone || "").replace(/\D/g, "");
      if (phone.length === 11 && phone[0] === "1") phone = phone.slice(1);

      // Check duplicates
      var db = getDB();
      var cutoff = new Date(Date.now() - 72 * 3600000).toISOString();
      var dup = db.leads.find(function(l) { return (l.phone === phone || l.email === data.email) && l.created_at > cutoff; });
      if (dup) return res.status(409).json({ success: false, error: "duplicate", message: "Duplicate lead within 72hrs" });

      // Create lead
      var leadId = uuidv4();
      var lead = {
        id: leadId,
        created_at: new Date().toISOString(),
        status: "new",
        first_name: data.first_name,
        phone: phone,
        email: (data.email || "").trim().toLowerCase(),
        zip: data.zip || null,
        state: data.state || null,
        age: data.age || null,
        vehicle_year: data.vehicle_year || null,
        vehicle_make: data.vehicle_make || null,
        coverage: data.coverage || null,
        driving_record: data.driving_record || null,
        currently_insured: data.currently_insured || null,
        current_insurer: data.current_insurer || null,
        homeowner: data.homeowner || null,
        military: data.military || null,
        multi_car: data.multi_car || null,
        priority: data.priority || null,
        publisher_id: data.publisher_id || "direct",
        sub_id: data.sub_id || null,
        utm_source: data.utm_source || "aiinsuregenie",
        utm_medium: data.utm_medium || "chatbot",
        utm_campaign: data.utm_campaign || null,
        ip_address: req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown",
        total_revenue: 0,
        buyers_accepted: 0,
        buyers_rejected: 0,
      };

      db.leads.push(lead);

      // Log consent
      db.consent_log.push({
        lead_id: leadId,
        consent_text: data.consent_text,
        consent_timestamp: data.consent_timestamp,
        ip_address: lead.ip_address,
        disclosed_buyers: data.disclosed_buyers || "Insurance partners",
        created_at: new Date().toISOString(),
      });

      saveDB(db);

      // TODO: Add buyer API posting here when you have real buyer endpoints
      // For now, log the lead and return success
      console.log("NEW LEAD:", leadId, lead.first_name, lead.phone, lead.zip, lead.state);

      return res.status(200).json({
        success: true,
        lead_id: leadId,
        distribution: {
          mode: "hybrid",
          total_revenue: 0,
          accepted_buyers: [],
          rejected_count: 0,
        },
        message: "Lead received successfully",
      });
    } catch (err) {
      console.error("Lead error:", err);
      return res.status(500).json({ success: false, error: "Internal error" });
    }
  }

  if (req.method === "GET") {
    // Get lead by ID (query param)
    var id = req.query.id;
    if (id) {
      var db2 = getDB();
      var lead2 = db2.leads.find(function(l) { return l.id === id; });
      if (!lead2) return res.status(404).json({ error: "Lead not found" });
      return res.json({ lead: lead2 });
    }
    // Return recent leads count
    var db3 = getDB();
    return res.json({ total_leads: db3.leads.length, message: "AI InsureGenie Lead API" });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
