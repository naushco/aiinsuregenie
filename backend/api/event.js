// api/event.js: privacy-friendly conversion events from the chat.
//   POST /api/event  {type, session_id, state?, partner_id?, goal?, lang?, utm_*?, dns?}
// Stores only the event, a random chat session ID and non-personal context. No names, phones,
// emails or cookies. The dashboard reads these for the funnel (chat started -> match -> click).
// Optional: when META_PIXEL_ID and META_CAPI_TOKEN are set, also sends the event to Meta's
// Conversions API (skipped for visitors who opted out of sale/sharing or send Global Privacy Control).
const { kv, kvConfigured } = require("../lib/kv");
const { cors, ip } = require("../lib/http");

var TYPES = ["chat_started", "match_shown", "no_match", "partner_click", "call_request", "email_signup"];
var META = { match_shown: "ViewContent", partner_click: "Lead", call_request: "Contact", email_signup: "Subscribe" };
var hits = {};
function rateLimited(who) {
  var now = Date.now();
  hits[who] = (hits[who] || []).filter(function (t) { return now - t < 60000; });
  if (hits[who].length >= 60) return true;
  hits[who].push(now);
  return false;
}
function clean(v, n) { return v == null ? null : String(v).replace(/[^\w\-\. ]/g, "").slice(0, n) || null; }

async function toMeta(ev, req) {
  var pixel = process.env.META_PIXEL_ID, token = process.env.META_CAPI_TOKEN;
  if (!pixel || !token || !META[ev.type] || ev.dns) return;
  try {
    await fetch("https://graph.facebook.com/v21.0/" + pixel + "/events?access_token=" + encodeURIComponent(token), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [{
        event_name: META[ev.type], event_time: Math.floor(Date.now() / 1000), event_id: ev.session_id + ":" + ev.type,
        action_source: "website", event_source_url: "https://chat.aiinsuregenie.com/",
        user_data: { client_ip_address: ip(req), client_user_agent: String(req.headers["user-agent"] || "").slice(0, 300) },
        custom_data: { content_category: "auto_insurance", content_ids: ev.partner_id ? [ev.partner_id] : undefined }
      }] })
    });
  } catch (e) { console.error("meta capi failed:", e && e.message); }
}

module.exports = async function handler(req, res) {
  cors(req, res, "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (rateLimited(ip(req))) return res.status(429).json({ error: "Too many events." });

  var b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || TYPES.indexOf(b.type) < 0 || !/^s[a-z0-9]{6,30}$/.test(String(b.session_id || ""))) {
    return res.status(400).json({ error: "Bad event." });
  }
  var ev = {
    type: b.type, session_id: String(b.session_id), at: new Date().toISOString(),
    state: clean(b.state, 2), partner_id: clean(b.partner_id, 40), goal: clean(b.goal, 20), placement: clean(b.placement, 10),
    source: clean(b.source, 20), mode: clean(b.mode, 12), lang: b.lang === "es" ? "es" : "en", dns: b.dns === true,
    utm_source: clean(b.utm_source, 60), utm_campaign: clean(b.utm_campaign, 80), utm_content: clean(b.utm_content, 80), pub: clean(b.pub, 40)
  };
  try {
    if (kvConfigured()) {
      await kv(["LPUSH", "events", JSON.stringify(ev)]);
      if (Math.random() < 0.02) await kv(["LTRIM", "events", "0", "49999"]);
    }
  } catch (e) { console.error("event store failed:", e && e.message); }
  await toMeta(ev, req);
  return res.status(200).json({ ok: true });
};
