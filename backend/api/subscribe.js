// api/subscribe.js: optional email sign-up from the chat (our own emails only; never sold or shared).
//   POST /api/subscribe {email, consent_text, consent_timestamp, source, state?, ...answers}
// Keeps the exact consent wording and time. One record per email (latest answers win).
const crypto = require("crypto");
const { kv, kvConfigured } = require("../lib/kv");
const { cors, ip } = require("../lib/http");

var hits = {};
function rateLimited(who) {
  var now = Date.now();
  hits[who] = (hits[who] || []).filter(function (t) { return now - t < 600000; });
  if (hits[who].length >= 5) return true;
  hits[who].push(now);
  return false;
}
function text(v, n) { return v == null ? null : String(v).trim().slice(0, n) || null; }

module.exports = async function handler(req, res) {
  cors(req, res, "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!kvConfigured()) return res.status(503).json({ error: "Storage is not set up." });
  var who = ip(req);
  if (rateLimited(who)) return res.status(429).json({ error: "Too many requests." });

  var b = req.body || {};
  var email = String(b.email || "").trim().toLowerCase().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) return res.status(400).json({ error: "A valid email is required." });
  if (!b.consent_text || !b.consent_timestamp) return res.status(400).json({ error: "Consent is required." });

  var existing = await kv(["GET", "sub:" + email]);
  var prev = null; try { prev = existing ? JSON.parse(existing) : null; } catch (e) {}
  var rec = {
    id: prev ? prev.id : crypto.randomUUID(),
    email: email,
    created_at: prev ? prev.created_at : new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source: text(b.source, 20), lang: b.lang === "es" ? "es" : "en",
    state: text(b.state, 2), zip: text(b.zip, 5), vehicle_year: text(b.vehicle_year, 10), vehicle_make: text(b.vehicle_make, 40),
    driving_record: text(b.driving_record, 20), priority: text(b.priority, 20), session_id: text(b.session_id, 32),
    consent_text: text(b.consent_text, 600), consent_timestamp: text(b.consent_timestamp, 40),
    landing_page: text(b.landing_page, 300), ip_address: who, user_agent: text(req.headers["user-agent"], 200),
    unsubscribed: false, unsub_token: prev && prev.unsub_token ? prev.unsub_token : crypto.randomBytes(12).toString("hex")
  };
  try {
    await kv(["SET", "sub:" + email, JSON.stringify(rec)]);
    if (!prev) await kv(["LPUSH", "subscribers", email]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("subscribe failed:", e && e.message);
    return res.status(500).json({ error: "Could not save." });
  }
};
