// api/leads.js: receives a finished lead from the chatbot and stores it.
//
// Where a lead goes (use either or both):
//   - Storage (Upstash Redis from Vercel's Storage tab): kept so you can see it in the dashboard
//   - LEAD_WEBHOOK_URL (Zapier, Make, Slack, Google Sheets...): sent to wherever you work
// If NEITHER is set up this endpoint refuses leads, so a lead is never silently lost.
const crypto = require("crypto");
const { kv, kvConfigured } = require("../lib/kv");
const { cors, ip } = require("../lib/http");

var hits = {};
function rateLimited(who) {
  var now = Date.now();
  hits[who] = (hits[who] || []).filter(function (t) { return now - t < 60000; });
  if (hits[who].length >= 20) return true;
  hits[who].push(now);
  return false;
}
function text(v, n) { return v == null ? null : String(v).trim().slice(0, n); }

module.exports = async function handler(req, res) {
  cors(req, res, "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  var webhook = process.env.LEAD_WEBHOOK_URL;
  if (!kvConfigured() && !webhook) {
    return res.status(503).json({ success: false, error: "Lead storage is not set up yet." });
  }
  var who = ip(req);
  if (rateLimited(who)) return res.status(429).json({ success: false, error: "Too many requests." });

  var d = req.body || {};
  var errors = [];
  var first = text(d.first_name, 40) || "";
  var phone = String(d.phone || "").replace(/\D/g, "");
  if (phone.length === 11 && phone[0] === "1") phone = phone.slice(1);
  var email = (text(d.email, 120) || "").toLowerCase();
  if (first.length < 2) errors.push("first_name is required");
  if (phone.length !== 10 || "01".indexOf(phone[0]) !== -1) errors.push("a valid US phone is required");
  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) errors.push("a valid email is required");
  if (!d.consent_text || !d.consent_timestamp) errors.push("consent is required");
  if (errors.length) return res.status(400).json({ success: false, errors: errors });

  var id = crypto.randomUUID();
  var lead = {
    id: id,
    created_at: new Date().toISOString(),
    first_name: first, phone: phone, email: email,
    zip: text(d.zip, 5), state: text(d.state, 2), age: d.age || null,
    vehicle_year: text(d.vehicle_year, 10), vehicle_make: text(d.vehicle_make, 40),
    coverage: text(d.coverage, 20), driving_record: text(d.driving_record, 20),
    currently_insured: text(d.currently_insured, 5), current_insurer: text(d.current_insurer, 60),
    homeowner: text(d.homeowner, 5), military: text(d.military, 5), multi_car: text(d.multi_car, 5), priority: text(d.priority, 20),
    publisher_id: text(d.publisher_id, 60) || "direct", sub_id: text(d.sub_id, 80),
    utm_source: text(d.utm_source, 60), utm_medium: text(d.utm_medium, 60), utm_campaign: text(d.utm_campaign, 80),
    landing_page: text(d.landing_page, 300),
    // Consent record: the exact wording the person saw, when, and from where
    consent_text: text(d.consent_text, 1200), consent_timestamp: text(d.consent_timestamp, 40),
    disclosed_partners: text(d.disclosed_buyers, 600),
    ip_address: who, user_agent: text(req.headers["user-agent"], 200)
  };

  try {
    // Duplicate check (same phone or email within 72 hours)
    if (kvConfigured()) {
      var ttl = String(72 * 3600);
      var p = await kv(["SET", "dup:p:" + phone, id, "NX", "EX", ttl]);
      var e = await kv(["SET", "dup:e:" + email, id, "NX", "EX", ttl]);
      if (p === null || e === null) return res.status(409).json({ success: false, error: "duplicate" });
    }

    var stored = false, forwarded = false;
    if (kvConfigured()) {
      try {
        await kv(["SET", "lead:" + id, JSON.stringify(lead)]);
        await kv(["LPUSH", "leads", id]);
        await kv(["LTRIM", "leads", "0", "4999"]);
        stored = true;
      } catch (err) { console.error("store failed:", err && err.message); }
    }
    if (webhook) {
      try {
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, 8000);
        var r = await fetch(webhook, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.assign({ text: "New lead: " + first + ", " + phone + ", " + (lead.state || "") + " " + (lead.zip || "") }, lead)),
          signal: controller.signal
        });
        clearTimeout(timer);
        forwarded = r.ok;
        if (!r.ok) console.error("lead webhook responded", r.status);
      } catch (err) { console.error("lead webhook failed:", err && err.message); }
    }

    if (!stored && !forwarded) return res.status(502).json({ success: false, error: "Could not save the lead." });
    return res.status(200).json({ success: true, lead_id: id });
  } catch (err) {
    console.error("lead error:", err && err.message);
    return res.status(500).json({ success: false, error: "Something went wrong." });
  }
};
