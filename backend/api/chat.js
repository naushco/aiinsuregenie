// api/chat.js — Secure Claude proxy for AI InsureGenie
// The API key lives ONLY in Vercel environment variables (ANTHROPIC_API_KEY).
// The browser never sees it.

const { cors } = require("../lib/http");

const MODEL = process.env.CHAT_MODEL || "claude-haiku-4-5-20251001"; // fast + cheap. Use "claude-sonnet-5-5" for higher quality.
const MAX_MSG_CHARS = 600;
const MAX_HISTORY = 10;
const MAX_OUTPUT_TOKENS = 450;

// Basic per-instance rate limit (resets on cold start; fine for launch).
// For heavy traffic, move this to Upstash Redis or Vercel KV.
const hits = {};
function rateLimited(ip) {
  var now = Date.now();
  var windowMs = 60 * 1000;
  var max = 12; // 12 questions per minute per IP
  hits[ip] = (hits[ip] || []).filter(function (t) { return now - t < windowMs; });
  if (hits[ip].length >= max) return true;
  hits[ip].push(now);
  return false;
}

// Only these profile fields are ever sent to the model. NO name, phone, or email.
var SAFE_FIELDS = ["state", "age", "vehicleYear", "vehicleMake", "driving", "coverage", "insured", "homeowner", "military", "multiCar", "priority"];
function cleanProfile(p) {
  var out = [];
  if (!p || typeof p !== "object") return "";
  SAFE_FIELDS.forEach(function (k) {
    if (p[k] !== undefined && p[k] !== null) {
      out.push(k + ": " + String(p[k]).replace(/[^\w\s\-\.\/]/g, "").slice(0, 30));
    }
  });
  return out.length ? "\nKnown about this user (for context only): " + out.join(", ") + "." : "";
}

function cleanResults(r) {
  if (!Array.isArray(r)) return "";
  var names = r.slice(0, 6).map(function (x) {
    return String(x.n || "").replace(/[^\w\s\.\-&']/g, "").slice(0, 40);
  }).filter(Boolean);
  return names.length ? "\nInsurers currently shown to this user: " + names.join(", ") + "." : "";
}

var SYSTEM_PROMPT =
  "You are AI InsureGenie, a friendly assistant that helps people in the United States understand and shop for auto insurance.\n\n" +
  "SCOPE: Only discuss US auto insurance (coverage types, deductibles, claims, discounts, SR-22, rates, how to compare, how insurers work). " +
  "If asked about anything else, politely say you only help with auto insurance and offer to help with that.\n\n" +
  "STYLE: Warm, plain English, 2-3 short paragraphs max. Use **bold** sparingly for key terms. No long lists.\n\n" +
  "HONESTY RULES:\n" +
  "- Never guarantee a price, approval, or savings. Use words like 'typically' or 'often'.\n" +
  "- You are not a licensed agent and cannot give legal or financial advice. For policy-specific decisions, suggest confirming with the insurer or a licensed agent.\n" +
  "- Do not claim one insurer is definitively the best. Explain what each tends to be good for.\n" +
  "- If you are not sure about a specific fact (a current discount, a state rule), say so instead of guessing.\n" +
  "- If asked how this service makes money: say AI InsureGenie may earn a fee from insurance partners when users request quotes, and that it is free for the user.\n" +
  "- Never ask for or repeat personal details like phone number, email, or full address.\n" +
  "- If the user is frustrated or has a complex situation, offer to connect them with a licensed agent (the Agent button).\n\n" +
  "When it fits naturally, remind them they can say 'get my quotes' to compare personalized options. Do not push it every time.";

module.exports = async function handler(req, res) {
  cors(req, res, "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Chat is not configured yet." });
  }

  var ip = (req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  if (rateLimited(ip)) {
    return res.status(429).json({ error: "Too many questions. Please wait a moment." });
  }

  try {
    var body = req.body || {};
    var message = String(body.message || "").trim().slice(0, MAX_MSG_CHARS);
    if (!message) return res.status(400).json({ error: "Empty message" });

    // Conversation memory: last few turns only, validated.
    var history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];
    var messages = [];
    history.forEach(function (h) {
      if (h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string") {
        messages.push({ role: h.role, content: h.content.slice(0, MAX_MSG_CHARS * 2) });
      }
    });
    // The API requires the first message to be from the user and roles to alternate.
    while (messages.length && messages[0].role !== "user") messages.shift();
    var cleaned = [];
    messages.forEach(function (m) {
      if (cleaned.length && cleaned[cleaned.length - 1].role === m.role) {
        cleaned[cleaned.length - 1].content += "\n" + m.content;
      } else {
        cleaned.push(m);
      }
    });
    if (cleaned.length && cleaned[cleaned.length - 1].role === "user") {
      cleaned[cleaned.length - 1].content += "\n" + message;
    } else {
      cleaned.push({ role: "user", content: message });
    }

    var system = SYSTEM_PROMPT + cleanProfile(body.profile) + cleanResults(body.results);

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 15000);

    var apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: system,
        messages: cleaned,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!apiRes.ok) {
      var errText = await apiRes.text();
      console.error("Anthropic error:", apiRes.status, errText.slice(0, 300));
      return res.status(502).json({ error: "The assistant is unavailable right now." });
    }

    var data = await apiRes.json();
    var text = "";
    (data.content || []).forEach(function (b) { if (b.type === "text" && b.text) text += b.text; });
    if (!text) return res.status(502).json({ error: "No answer generated." });

    return res.status(200).json({ answer: text });
  } catch (err) {
    console.error("Chat error:", err && err.message);
    return res.status(500).json({ error: "Something went wrong." });
  }
};
