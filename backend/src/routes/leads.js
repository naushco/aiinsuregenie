// src/routes/leads.js — Lead submission and status API
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { queries } = require("../database");
const { validateLead, checkDuplicate } = require("../services/validator");
const { distributeLead } = require("../services/distributor");

var router = express.Router();

// ============================================================
// POST /api/leads — Submit a new lead from chatbot
// ============================================================
router.post("/", async function (req, res) {
  try {
    var data = req.body;

    // 1. Validate
    var validation = validateLead(data);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    // 2. Check duplicates
    var dupCheck = checkDuplicate(data.phone, data.email);
    if (dupCheck.isDuplicate) {
      return res.status(409).json({
        success: false,
        error: "duplicate",
        message: dupCheck.message,
        original_lead_id: dupCheck.original_lead_id,
      });
    }

    // 3. Create lead record
    var leadId = uuidv4();
    var lead = {
      id: leadId,
      first_name: data.first_name,
      phone: data.phone,
      email: data.email,
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
      publisher_id: data.publisher_id || data.sub_id || "direct",
      sub_id: data.sub_id || null,
      utm_source: data.utm_source || "aiinsuregenie",
      utm_medium: data.utm_medium || "chatbot",
      utm_campaign: data.utm_campaign || null,
      ip_address: req.ip || req.headers["x-forwarded-for"] || "unknown",
      user_agent: req.headers["user-agent"] || null,
      landing_page: data.landing_page || null,
      distribution_mode: process.env.DISTRIBUTION_MODE || "hybrid",
      call_requested: data.call_requested ? 1 : 0,
      preferred_call_time: data.preferred_call_time || null,
    };

    queries.insertLead.run(lead);

    // 4. Log TCPA consent (CRITICAL — never skip this)
    queries.insertConsent.run({
      lead_id: leadId,
      consent_text: data.consent_text,
      consent_timestamp: data.consent_timestamp,
      ip_address: lead.ip_address,
      user_agent: lead.user_agent,
      disclosed_buyers: data.disclosed_buyers || "Progressive, GEICO, State Farm, Allstate, Liberty Mutual, Nationwide, and partners",
    });

    // 5. Distribute to buyers
    // Add consent info to lead object for posting
    lead.consent_text = data.consent_text;
    lead.consent_timestamp = data.consent_timestamp;

    var distribution = await distributeLead(lead);

    // 6. Return result to chatbot
    res.json({
      success: true,
      lead_id: leadId,
      distribution: {
        mode: distribution.mode,
        total_revenue: distribution.total_revenue,
        accepted_buyers: distribution.accepted_buyers.map(function (b) {
          return { name: b.name, payout: b.payout };
        }),
        rejected_count: distribution.rejected_buyers.length,
      },
      // Redirect URL — send user to the highest-paying accepted buyer
      redirect_url: distribution.accepted_buyers.length > 0
        ? null // In production, buyers return redirect URLs in their post response
        : null,
      message: distribution.accepted_buyers.length > 0
        ? "Lead sold to " + distribution.accepted_buyers.length + " buyer(s) for $" + distribution.total_revenue.toFixed(2)
        : distribution.error || "No buyers accepted this lead",
    });
  } catch (err) {
    console.error("Lead submission error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ============================================================
// GET /api/leads/:id — Get lead status and buyer responses
// ============================================================
router.get("/:id", function (req, res) {
  var lead = queries.getLeadById.get(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  var buyers = queries.getBuyerResponses.all(req.params.id);

  res.json({
    lead: {
      id: lead.id,
      status: lead.status,
      created_at: lead.created_at,
      total_revenue: lead.total_revenue,
      buyers_accepted: lead.buyers_accepted,
      distribution_mode: lead.distribution_mode,
    },
    buyers: buyers.map(function (b) {
      return {
        buyer: b.buyer_name,
        ping_bid: b.ping_bid,
        ping_accepted: !!b.ping_accepted,
        post_accepted: !!b.post_accepted,
        payout: b.final_payout,
        status: b.status,
        reject_reason: b.post_reject_reason,
      };
    }),
  });
});

// ============================================================
// POST /api/leads/:id/callback — Buyer conversion callback
// Used when a buyer confirms a lead converted (user bought policy)
// ============================================================
router.post("/:id/callback", function (req, res) {
  var data = req.body;
  // Log conversion for revenue optimization
  // In production: update buyer_responses with conversion data
  console.log("Conversion callback for lead:", req.params.id, data);
  res.json({ success: true });
});

module.exports = router;
