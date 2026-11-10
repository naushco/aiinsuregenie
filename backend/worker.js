// Cloudflare Workers entry for the AI InsureGenie API.
// Runs the same handlers in api/*.js that Vercel runs, through a small request/response adapter,
// so the API code stays identical on both platforms during the move.
import admin from "./api/admin.js";
import callback from "./api/callback.js";
import chat from "./api/chat.js";
import health from "./api/health.js";
import leads from "./api/leads.js";
import partners from "./api/partners.js";
import event from "./api/event.js";
import subscribe from "./api/subscribe.js";
import privacy from "./api/privacy.js";
import { migrateIfNeeded } from "./lib/migrate.js";

const ROUTES = { admin, callback, chat, health, leads, partners, event, subscribe, privacy };
const USES_STORAGE = { admin: true, leads: true, partners: true, health: true, event: true, subscribe: true, privacy: true, callback: true };

// Builds the Vercel-style req object the handlers expect.
async function toReq(request, url) {
  const headers = {};
  for (const [k, v] of request.headers) headers[k.toLowerCase()] = v;
  // Handlers read the visitor IP from x-forwarded-for (Vercel's header).
  headers["x-forwarded-for"] = request.headers.get("cf-connecting-ip") || headers["x-forwarded-for"] || "unknown";

  const query = {};
  for (const [k, v] of url.searchParams) query[k] = v;

  let body = undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const text = await request.text();
    const type = (headers["content-type"] || "").toLowerCase();
    if (type.includes("application/json")) {
      try { body = text ? JSON.parse(text) : {}; } catch { body = undefined; }
    } else if (type.includes("application/x-www-form-urlencoded")) {
      body = Object.fromEntries(new URLSearchParams(text));
    } else {
      body = text;
    }
  }
  return { method: request.method, headers, query, body, url: url.pathname + url.search };
}

// Builds a Vercel-style res object and resolves with a real Response when the handler finishes.
function toRes() {
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  const headers = new Headers();
  let statusCode = 200;
  let sent = false;
  const finish = (r) => { sent = true; resolve(r); };
  const res = {
    get headersSent() { return sent; },
    setHeader(k, v) { headers.set(k, String(v)); return res; },
    getHeader(k) { return headers.get(k); },
    status(code) { statusCode = code; return res; },
    json(obj) {
      if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
      finish(new Response(JSON.stringify(obj), { status: statusCode, headers }));
      return res;
    },
    send(data) {
      const isObj = data !== null && typeof data === "object";
      if (isObj) return res.json(data);
      finish(new Response(data == null ? null : String(data), { status: statusCode, headers }));
      return res;
    },
    end(data) {
      finish(new Response(data == null ? null : String(data), { status: statusCode, headers }));
      return res;
    },
  };
  return { res, done, isSent: () => sent };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Same as Vercel's rewrite: the bare address shows the health check.
    const path = url.pathname === "/" ? "/api/health" : url.pathname.replace(/\/+$/, "");
    // Best guess of the visitor's US state from Cloudflare's location data, for the chat's
    // "Are you in Texas?" question. Nothing is stored or logged.
    if (path === "/api/geo") {
      const origin = request.headers.get("origin") || "";
      const ok = /^https:\/\/([a-z0-9-]+\.)?aiinsuregenie\.com$/.test(origin) || /\.workers\.dev$/.test(origin);
      const cf = request.cf || {};
      const state = cf.country === "US" && /^[A-Z]{2}$/.test(cf.regionCode || "") ? cf.regionCode : null;
      return new Response(JSON.stringify({ state }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...(ok ? { "access-control-allow-origin": origin, "vary": "Origin" } : {}) },
      });
    }
    const m = path.match(/^\/api\/([a-z]+)$/);
    const name = m && m[1];
    const handler = name && ROUTES[name];
    if (!handler) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    globalThis.__AIG_D1 = env.DB || null;
    if (USES_STORAGE[name] && env.DB) await migrateIfNeeded(env.DB);

    const req = await toReq(request, url);
    const { res, done, isSent } = toRes();
    try {
      await handler(req, res);
    } catch (err) {
      console.error(name + " crashed:", err && err.message);
      if (!isSent()) res.status(500).json({ error: "Something went wrong." });
    }
    if (!isSent()) res.status(500).json({ error: "No response." });
    return done;
  },
};
