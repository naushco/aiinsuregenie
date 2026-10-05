// api/callback.js: receives "Talk to an agent" requests from the chatbot.
//
// Nothing is stored on this server (Vercel's disk is temporary). Instead each request is
// forwarded to a webhook YOU control, so it lands somewhere durable and somebody sees it:
//   - Slack:  create an "Incoming Webhook" and paste its URL
//   - Zapier / Make: create a "Catch Hook" and route to email, SMS, Google Sheets, your CRM...
// Set the URL in Vercel as the environment variable CALLBACK_WEBHOOK_URL.

const { cors } = require("../lib/http");

const hits = {};
function rateLimited(ip) {
  var now = Date.now(), windowMs = 10 * 60 * 1000, max = 5; // 5 requests per 10 min per IP
  hits[ip] = (hits[ip] || []).filter(function (t) { return now - t < windowMs; });
  if (hits[ip].length >= max) return true;
  hits[ip].push(now);
  return false;
}

module.exports = async function handler(req, res) {
  cors(req, res, "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  var hook = process.env.CALLBACK_WEBHOOK_URL || process.env.LEAD_WEBHOOK_URL;
  if (!hook) return res.status(503).json({ error: "Callback requests are not configured." });

  var ip = (req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  if (rateLimited(ip)) return res.status(429).json({ error: "Too many requests. Please try again later." });

  var b = req.body || {};
  var name = String(b.name || "").trim().slice(0, 40);
  var digits = String(b.phone || "").replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "1") digits = digits.slice(1);
  if (name.length < 2) return res.status(400).json({ error: "Name is required." });
  if (digits.length !== 10 || "01".indexOf(digits[0]) !== -1) return res.status(400).json({ error: "A valid US phone number is required." });
  if (!b.consent_text || !b.consent_timestamp) return res.status(400).json({ error: "Consent is required." });

  var when = String(b.preferred_time || "As soon as possible").slice(0, 40);
  var formatted = "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6);

  var payload = {
    // "text" makes this display nicely if the webhook is a Slack Incoming Webhook
    text: "New callback request: " + name + ", " + formatted + ", best time: " + when +
      (b.state ? ", " + b.state : "") + (b.zip ? " " + String(b.zip).slice(0, 5) : ""),
    name: name,
    phone: digits,
    phone_formatted: formatted,
    preferred_time: when,
    zip: b.zip ? String(b.zip).slice(0, 5) : null,
    state: b.state ? String(b.state).slice(0, 2) : null,
    consent_text: String(b.consent_text).slice(0, 600),
    consent_timestamp: String(b.consent_timestamp).slice(0, 40),
    ip_address: ip,
    user_agent: String(req.headers["user-agent"] || "").slice(0, 200),
    landing_page: b.landing_page ? String(b.landing_page).slice(0, 300) : null,
    received_at: new Date().toISOString()
  };

  try {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 8000);
    var r = await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!r.ok) {
      console.error("Webhook responded", r.status);
      return res.status(502).json({ error: "Could not deliver the request." });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err && err.message);
    return res.status(502).json({ error: "Could not deliver the request." });
  }
};
