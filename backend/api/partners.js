// api/partners.js: the list of insurance partners shown in the chatbot.
//   GET  /api/partners             -> public: enabled partners only, with private fields removed
//   GET  /api/partners?admin=1     -> admin: full list (needs the admin password)
//   POST /api/partners             -> admin: save the full list (needs the admin password)
const { kv, kvConfigured } = require("../lib/kv");
const { cors } = require("../lib/http");
const { adminGate } = require("../lib/auth");

var KEY = "aig:partners";

function validUrl(s) {
  try { var u = new URL(String(s || "")); return (u.protocol === "http:" || u.protocol === "https:") ? String(s) : ""; } catch (e) { return ""; }
}
function validLogo(s) {
  s = String(s || "");
  if (/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+\/=]+$/.test(s)) return s;
  return validUrl(s);
}

// What the public chatbot may see. Payouts, lead counts and revenue are NEVER included.
function publicView(p) {
  return {
    id: String(p.id),
    name: String(p.name || "").slice(0, 80),
    logo: String(p.logo || "").slice(0, 8),
    logoUrl: validLogo(p.logoUrl),
    badge: String(p.badge || "").slice(0, 30),
    bc: /^#[0-9a-fA-F]{6}$/.test(p.bc) ? p.bc : "#0F766E",
    rating: Number(p.rating) || 4,
    features: String(p.features || "").slice(0, 200),
    bestFor: String(p.bestFor || "budget").slice(0, 20),
    link: validUrl(p.link),
    supportsPrefill: p.supportsPrefill === true,
    customTag: String(p.customTag || "").slice(0, 30),
    featured: p.featured === true,
    pinned: p.pinned === true,
    priority: Number(p.priority) || 3,
    boost: Number(p.boost) || 0,
    enabled: true,
    base: Math.round(60 + (Number(p.payout) || 5) * 3) // used only for the on-screen estimate
  };
}

module.exports = async function handler(req, res) {
  cors(req, res, "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      var wantsAdmin = req.query && req.query.admin;
      if (wantsAdmin && !adminGate(req, res)) return;
      if (!kvConfigured()) {
        if (wantsAdmin) return res.status(200).json({ partners: null, storage: false });
        return res.status(200).json({ partners: [], storage: false });
      }
      var raw = await kv(["GET", KEY]);
      var list = raw ? JSON.parse(raw) : null;
      if (wantsAdmin) return res.status(200).json({ partners: list, storage: true });
      res.setHeader("Cache-Control", "public, s-maxage=5, stale-while-revalidate=30");
      var pub = (list || [])
        .filter(function (p) { return p && p.enabled === true && validUrl(p.link); })
        .map(publicView);
      return res.status(200).json({ partners: pub, storage: true });
    }

    if (req.method === "POST") {
      if (!adminGate(req, res)) return;
      if (!kvConfigured()) return res.status(503).json({ error: "Storage is not connected. Add the Upstash Redis store in Vercel." });
      var list2 = req.body && req.body.partners;
      if (!Array.isArray(list2) || list2.length > 50) return res.status(400).json({ error: "partners must be a list of up to 50 items." });
      for (var i = 0; i < list2.length; i++) {
        var p = list2[i];
        if (!p || typeof p.id !== "string" || typeof p.name !== "string") return res.status(400).json({ error: "Each partner needs an id and a name." });
      }
      var json = JSON.stringify(list2);
      if (json.length > 3000000) return res.status(400).json({ error: "That is too much data. Use smaller logos." });
      await kv(["SET", KEY, json]);
      return res.status(200).json({ ok: true, saved: list2.length });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("partners error:", err && err.message);
    return res.status(500).json({ error: "Something went wrong." });
  }
};
