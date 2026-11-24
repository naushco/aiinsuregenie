var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// lib/kv.js
var require_kv = __commonJS({
  "lib/kv.js"(exports) {
    function upstashConf() {
      var url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
      var token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
      return url && token ? { url: url.replace(/\/$/, ""), token } : null;
    }
    __name(upstashConf, "upstashConf");
    function d1() {
      return globalThis.__AIG_D1 || null;
    }
    __name(d1, "d1");
    exports.upstashConfigured = function() {
      return !!upstashConf();
    };
    exports.kvConfigured = function() {
      return !!(d1() || upstashConf());
    };
    async function upstash(cmd) {
      var c = upstashConf();
      if (!c) throw new Error("Storage is not configured");
      var r = await fetch(c.url, {
        method: "POST",
        headers: { Authorization: "Bearer " + c.token, "Content-Type": "application/json" },
        body: JSON.stringify(cmd)
      });
      var j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "Storage error " + r.status);
      return j.result;
    }
    __name(upstash, "upstash");
    exports.upstash = upstash;
    var schemaReady = null;
    function ensureSchema(db) {
      if (!schemaReady) {
        schemaReady = db.batch([
          db.prepare("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL, exp INTEGER)"),
          db.prepare("CREATE TABLE IF NOT EXISTS list_items (seq INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, v TEXT NOT NULL)"),
          db.prepare("CREATE INDEX IF NOT EXISTS list_items_name ON list_items (name, seq)")
        ]).catch(function(e) {
          schemaReady = null;
          throw e;
        });
      }
      return schemaReady;
    }
    __name(ensureSchema, "ensureSchema");
    exports.ensureSchema = function() {
      return d1() ? ensureSchema(d1()) : Promise.resolve();
    };
    function now() {
      return Math.floor(Date.now() / 1e3);
    }
    __name(now, "now");
    async function d1kv(db, cmd) {
      await ensureSchema(db);
      var op = String(cmd[0]).toUpperCase();
      var t = now();
      if (op === "GET") {
        var row = await db.prepare("SELECT v FROM kv WHERE k = ? AND (exp IS NULL OR exp > ?)").bind(cmd[1], t).first();
        return row ? row.v : null;
      }
      if (op === "SET") {
        var key = cmd[1], val = String(cmd[2]);
        var opts = cmd.slice(3).map(String);
        var nx = opts.some(function(o) {
          return o.toUpperCase() === "NX";
        });
        var exIdx = opts.findIndex(function(o) {
          return o.toUpperCase() === "EX";
        });
        var exp = exIdx >= 0 ? t + parseInt(opts[exIdx + 1], 10) : null;
        if (nx) {
          var r = await db.prepare(
            "INSERT INTO kv (k, v, exp) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, exp = excluded.exp WHERE kv.exp IS NOT NULL AND kv.exp <= ?"
          ).bind(key, val, exp, t).run();
          return r.meta && r.meta.changes > 0 ? "OK" : null;
        }
        await db.prepare("INSERT INTO kv (k, v, exp) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, exp = excluded.exp").bind(key, val, exp).run();
        return "OK";
      }
      if (op === "MGET") {
        var keys = cmd.slice(1), found = {};
        for (var i = 0; i < keys.length; i += 90) {
          var chunk = keys.slice(i, i + 90);
          var q = "SELECT k, v FROM kv WHERE k IN (" + chunk.map(function() {
            return "?";
          }).join(",") + ") AND (exp IS NULL OR exp > ?)";
          var res = await db.prepare(q).bind(...chunk, t).all();
          (res.results || []).forEach(function(row2) {
            found[row2.k] = row2.v;
          });
        }
        return keys.map(function(k) {
          return k in found ? found[k] : null;
        });
      }
      if (op === "LPUSH") {
        var stmts = cmd.slice(2).map(function(v) {
          return db.prepare("INSERT INTO list_items (name, v) VALUES (?, ?)").bind(cmd[1], String(v));
        });
        await db.batch(stmts);
        var c = await db.prepare("SELECT COUNT(*) AS n FROM list_items WHERE name = ?").bind(cmd[1]).first();
        return c ? c.n : 0;
      }
      if (op === "LRANGE") {
        var start = parseInt(cmd[2], 10), stop = parseInt(cmd[3], 10);
        var limit = stop < 0 ? -1 : stop - start + 1;
        var rows = await db.prepare("SELECT v FROM list_items WHERE name = ? ORDER BY seq DESC LIMIT ? OFFSET ?").bind(cmd[1], limit, start).all();
        return (rows.results || []).map(function(row2) {
          return row2.v;
        });
      }
      if (op === "LTRIM") {
        var keep = parseInt(cmd[3], 10) + 1;
        await db.prepare(
          "DELETE FROM list_items WHERE name = ? AND seq NOT IN (SELECT seq FROM list_items WHERE name = ? ORDER BY seq DESC LIMIT ?)"
        ).bind(cmd[1], cmd[1], keep).run();
        return "OK";
      }
      throw new Error("Unsupported storage command: " + op);
    }
    __name(d1kv, "d1kv");
    exports.kv = async function(cmd) {
      var db = d1();
      if (db) return d1kv(db, cmd);
      return upstash(cmd);
    };
  }
});

// lib/http.js
var require_http = __commonJS({
  "lib/http.js"(exports) {
    exports.cors = function(req, res, methods) {
      var allow = (process.env.ALLOWED_ORIGIN || "*").split(",").map(function(s) {
        return s.trim();
      }).filter(Boolean);
      var origin = req.headers.origin;
      if (allow.indexOf("*") !== -1) {
        res.setHeader("Access-Control-Allow-Origin", "*");
      } else if (origin && allow.indexOf(origin) !== -1) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
      }
      res.setHeader("Access-Control-Allow-Methods", methods);
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    };
    exports.ip = function(req) {
      return String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
    };
  }
});

// node-built-in-modules:crypto
import libDefault from "crypto";
var require_crypto = __commonJS({
  "node-built-in-modules:crypto"(exports, module) {
    module.exports = libDefault;
  }
});

// lib/auth.js
var require_auth = __commonJS({
  "lib/auth.js"(exports) {
    var crypto = require_crypto();
    var { ip } = require_http();
    var fails = {};
    function sha(s) {
      return crypto.createHash("sha256").update(String(s)).digest();
    }
    __name(sha, "sha");
    exports.adminGate = function(req, res) {
      var pw = process.env.ADMIN_PASSWORD;
      if (!pw) {
        res.status(503).json({ error: "Admin is not set up. Add ADMIN_PASSWORD in your Vercel project settings." });
        return false;
      }
      var who = ip(req), now = Date.now();
      fails[who] = (fails[who] || []).filter(function(t) {
        return now - t < 10 * 60 * 1e3;
      });
      if (fails[who].length >= 8) {
        res.status(429).json({ error: "Too many wrong attempts. Try again in 10 minutes." });
        return false;
      }
      var h = String(req.headers.authorization || "");
      var tok = h.indexOf("Bearer ") === 0 ? h.slice(7) : "";
      if (!crypto.timingSafeEqual(sha(tok), sha(pw))) {
        fails[who].push(now);
        res.status(401).json({ error: "Wrong password." });
        return false;
      }
      return true;
    };
  }
});

// api/admin.js
var require_admin = __commonJS({
  "api/admin.js"(exports, module) {
    var { kv, kvConfigured } = require_kv();
    var { cors } = require_http();
    var { adminGate } = require_auth();
    module.exports = /* @__PURE__ */ __name(async function handler(req, res) {
      cors(req, res, "GET, OPTIONS");
      if (req.method === "OPTIONS") return res.status(200).end();
      if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      if (!adminGate(req, res)) return;
      try {
        var action = req.query && req.query.action || "dashboard";
        var days = Math.min(Math.max(parseInt(req.query && req.query.days) || 30, 1), 365);
        if (!kvConfigured()) {
          return res.status(200).json({ storage: false, stats: { total_leads: 0, last_period: 0 }, recent_leads: [] });
        }
        if (action === "funnel") {
          var raw = await kv(["LRANGE", "events", "0", "49999"]) || [];
          var since0 = new Date(Date.now() - days * 864e5).toISOString();
          var steps = ["chat_started", "match_shown", "no_match", "partner_click", "call_request", "email_signup", "question_asked", "chat_left"];
          var bySteps = {};
          var sess = {}, byDay = {}, byCampaign = {}, byPartner = {}, byState = {};
          steps.forEach(function(t) {
            sess[t] = {};
          });
          raw.forEach(function(v) {
            var e;
            try {
              e = JSON.parse(v);
            } catch (x) {
              return;
            }
            if (e && e.at >= since0 && e.type === "step_answered" && e.step) {
              bySteps[e.step] = bySteps[e.step] || {};
              bySteps[e.step][e.session_id] = 1;
            }
            if (!e || e.at < since0 || !sess[e.type]) return;
            sess[e.type][e.session_id] = 1;
            var d = e.at.slice(0, 10);
            byDay[d] = byDay[d] || {};
            byDay[d][e.type] = (byDay[d][e.type] || 0) + 1;
            var c = e.utm_campaign || "(none)";
            byCampaign[c] = byCampaign[c] || {};
            byCampaign[c][e.type] = byCampaign[c][e.type] || {};
            byCampaign[c][e.type][e.session_id] = 1;
            if (e.type === "partner_click" && e.partner_id) {
              byPartner[e.partner_id] = byPartner[e.partner_id] || {};
              byPartner[e.partner_id][e.session_id] = 1;
            }
            if (e.type === "no_match") byState[e.state || "?"] = (byState[e.state || "?"] || 0) + 1;
          });
          var totals = {};
          steps.forEach(function(t) {
            totals[t] = Object.keys(sess[t]).length;
          });
          Object.keys(byCampaign).forEach(function(c) {
            Object.keys(byCampaign[c]).forEach(function(t) {
              byCampaign[c][t] = Object.keys(byCampaign[c][t]).length;
            });
          });
          Object.keys(byPartner).forEach(function(k) {
            byPartner[k] = Object.keys(byPartner[k]).length;
          });
          var stepTotals = {};
          Object.keys(bySteps).forEach(function(k) {
            stepTotals[k] = Object.keys(bySteps[k]).length;
          });
          return res.status(200).json({ period_days: days, sessions: totals, by_day: byDay, by_campaign: byCampaign, clicks_by_partner: byPartner, no_match_by_state: byState, steps_passed: stepTotals });
        }
        if (action === "subscribers") {
          var emails = await kv(["LRANGE", "subscribers", "0", "9999"]) || [];
          var recs = emails.length ? await kv(["MGET"].concat(emails.map(function(e) {
            return "sub:" + e;
          }))) : [];
          var list = (recs || []).map(function(v) {
            try {
              return JSON.parse(v);
            } catch (e) {
              return null;
            }
          }).filter(Boolean).map(function(r) {
            delete r.unsub_token;
            delete r.ip_address;
            delete r.user_agent;
            return r;
          });
          return res.status(200).json({ total: list.length, subscribers: list });
        }
        if (action === "optouts") {
          var oids = await kv(["LRANGE", "optouts", "0", "4999"]) || [];
          var ovals = oids.length ? await kv(["MGET"].concat(oids.map(function(i) {
            return "optreq:" + i;
          }))) : [];
          return res.status(200).json({ optouts: (ovals || []).map(function(v) {
            try {
              return JSON.parse(v);
            } catch (e) {
              return null;
            }
          }).filter(Boolean) });
        }
        var ids = await kv(["LRANGE", "leads", "0", "999"]) || [];
        var vals = ids.length ? await kv(["MGET"].concat(ids.map(function(i) {
          return "lead:" + i;
        }))) : [];
        var leads2 = (vals || []).filter(Boolean).map(function(v) {
          try {
            return JSON.parse(v);
          } catch (e) {
            return null;
          }
        }).filter(Boolean);
        if (action === "leads") return res.status(200).json({ total: leads2.length, leads: leads2.slice(0, 50) });
        var since = new Date(Date.now() - days * 864e5).toISOString();
        var inPeriod = leads2.filter(function(l) {
          return l.created_at >= since;
        });
        var byState = {}, byPublisher = {};
        inPeriod.forEach(function(l) {
          byState[l.state || "?"] = (byState[l.state || "?"] || 0) + 1;
          byPublisher[l.publisher_id || "direct"] = (byPublisher[l.publisher_id || "direct"] || 0) + 1;
        });
        return res.status(200).json({
          storage: true,
          period_days: days,
          stats: { total_leads: leads2.length, last_period: inPeriod.length },
          by_state: byState,
          by_publisher: byPublisher,
          recent_leads: leads2.slice(0, 20).map(function(l) {
            return { id: l.id, name: l.first_name, state: l.state, zip: l.zip, publisher: l.publisher_id, created: l.created_at };
          })
        });
      } catch (err) {
        console.error("admin error:", err && err.message);
        return res.status(500).json({ error: "Something went wrong." });
      }
    }, "handler");
  }
});

// api/privacy.js
var require_privacy = __commonJS({
  "api/privacy.js"(exports, module) {
    var crypto = require_crypto();
    var { kv, kvConfigured } = require_kv();
    var { cors, ip } = require_http();
    var hits = {};
    function rateLimited(who) {
      var now = Date.now();
      hits[who] = (hits[who] || []).filter(function(t) {
        return now - t < 6e5;
      });
      if (hits[who].length >= 5) return true;
      hits[who].push(now);
      return false;
    }
    __name(rateLimited, "rateLimited");
    exports = module.exports = /* @__PURE__ */ __name(async function handler(req, res) {
      cors(req, res, "POST, OPTIONS");
      if (req.method === "OPTIONS") return res.status(200).end();
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      if (!kvConfigured()) return res.status(503).json({ error: "Storage is not set up." });
      var who = ip(req);
      if (rateLimited(who)) return res.status(429).json({ error: "Too many requests." });
      var b = req.body || {};
      var email = String(b.email || "").trim().toLowerCase().slice(0, 120);
      var phone = String(b.phone || "").replace(/\D/g, "");
      if (phone.length === 11 && phone[0] === "1") phone = phone.slice(1);
      var okEmail = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email), okPhone = phone.length === 10;
      if (!okEmail && !okPhone) return res.status(400).json({ error: "Enter the email or phone number you gave us." });
      var rec = {
        id: crypto.randomUUID(),
        at: (/* @__PURE__ */ new Date()).toISOString(),
        email: okEmail ? email : null,
        phone: okPhone ? phone : null,
        gpc: b.gpc === true,
        ip_address: who,
        user_agent: String(req.headers["user-agent"] || "").slice(0, 200)
      };
      try {
        if (okEmail) await kv(["SET", "optout:e:" + email, rec.at]);
        if (okPhone) await kv(["SET", "optout:p:" + phone, rec.at]);
        await kv(["SET", "optreq:" + rec.id, JSON.stringify(rec)]);
        await kv(["LPUSH", "optouts", rec.id]);
        return res.status(200).json({ ok: true });
      } catch (e) {
        console.error("opt-out failed:", e && e.message);
        return res.status(500).json({ error: "Could not save your request." });
      }
    }, "handler");
    exports.isOptedOut = async function(email, phone) {
      if (!kvConfigured()) return false;
      var keys = [];
      if (email) keys.push("optout:e:" + String(email).toLowerCase());
      if (phone) keys.push("optout:p:" + phone);
      if (!keys.length) return false;
      var vals = await kv(["MGET"].concat(keys));
      return (vals || []).some(Boolean);
    };
  }
});

// api/callback.js
var require_callback = __commonJS({
  "api/callback.js"(exports, module) {
    var crypto = require_crypto();
    var { cors } = require_http();
    var { kv, kvConfigured } = require_kv();
    var { isOptedOut } = require_privacy();
    var hits = {};
    function rateLimited(ip) {
      var now = Date.now(), windowMs = 10 * 60 * 1e3, max = 5;
      hits[ip] = (hits[ip] || []).filter(function(t) {
        return now - t < windowMs;
      });
      if (hits[ip].length >= max) return true;
      hits[ip].push(now);
      return false;
    }
    __name(rateLimited, "rateLimited");
    function tfUrl(v) {
      var u = v == null ? "" : String(v).trim().slice(0, 200);
      return /^https:\/\/cert\.trustedform\.com\/[A-Za-z0-9]+$/.test(u) ? u : null;
    }
    __name(tfUrl, "tfUrl");
    module.exports = /* @__PURE__ */ __name(async function handler(req, res) {
      cors(req, res, "POST, OPTIONS");
      if (req.method === "OPTIONS") return res.status(200).end();
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      var hook = process.env.CALLBACK_WEBHOOK_URL || process.env.LEAD_WEBHOOK_URL;
      if (!hook && !kvConfigured()) return res.status(503).json({ error: "Callback requests are not configured." });
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
        id: crypto.randomUUID(),
        // "text" makes this display nicely if the webhook is a Slack Incoming Webhook
        text: "New callback request: " + name + ", " + formatted + ", best time: " + when + (b.state ? ", " + b.state : "") + (b.zip ? " " + String(b.zip).slice(0, 5) : ""),
        name,
        phone: digits,
        phone_formatted: formatted,
        preferred_time: when,
        zip: b.zip ? String(b.zip).slice(0, 5) : null,
        state: b.state ? String(b.state).slice(0, 2) : null,
        consent_text: String(b.consent_text).slice(0, 600),
        consent_timestamp: String(b.consent_timestamp).slice(0, 40),
        trustedform_cert_url: tfUrl(b.trustedform_cert_url),
        ip_address: ip,
        user_agent: String(req.headers["user-agent"] || "").slice(0, 200),
        landing_page: b.landing_page ? String(b.landing_page).slice(0, 300) : null,
        session_id: b.session_id ? String(b.session_id).slice(0, 32) : null,
        // The person asked for this call, so it is still delivered, but must not be resold or shared further.
        do_not_sell: b.do_not_sell === true,
        received_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      try {
        if (!payload.do_not_sell && await isOptedOut(null, digits)) payload.do_not_sell = true;
      } catch (e) {
      }
      if (payload.do_not_sell) payload.text += " [DO NOT SELL/SHARE]";
      var stored = false, forwarded = false;
      if (kvConfigured()) {
        try {
          await kv(["SET", "cb:" + payload.id, JSON.stringify(payload)]);
          await kv(["LPUSH", "callbacks", payload.id]);
          await kv(["LTRIM", "callbacks", "0", "4999"]);
          stored = true;
        } catch (err) {
          console.error("callback store failed:", err && err.message);
        }
      }
      if (hook) {
        try {
          var controller = new AbortController();
          var timer = setTimeout(function() {
            controller.abort();
          }, 8e3);
          var r = await fetch(hook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal
          });
          clearTimeout(timer);
          forwarded = r.ok;
          if (!r.ok) console.error("Webhook responded", r.status);
        } catch (err) {
          console.error("Webhook error:", err && err.message);
        }
      }
      if (!stored && !forwarded) return res.status(502).json({ error: "Could not save the request." });
      return res.status(200).json({ ok: true, id: payload.id });
    }, "handler");
  }
});

// lib/minimums.js
var require_minimums = __commonJS({
  "lib/minimums.js"(exports, module) {
    module.exports = { "checked": "2026-11-04", "limits": { "AL": "25/50/25", "AK": "50/100/25", "AZ": "25/50/15", "AR": "25/50/25", "CA": "30/60/15", "CO": "25/50/15", "CT": "25/50/25", "DE": "25/50/10", "DC": "25/50/10", "FL": "0/0/10", "GA": "25/50/25", "HI": "40/80/20", "ID": "25/50/15", "IL": "25/50/20", "IN": "25/50/25", "IA": "20/40/15", "KS": "25/50/25", "KY": "25/50/25", "LA": "15/30/25", "ME": "50/100/25", "MD": "30/60/15", "MA": "25/50/30", "MI": "50/100/10", "MN": "30/60/10", "MS": "25/50/25", "MO": "25/50/25", "MT": "25/50/20", "NE": "25/50/25", "NV": "25/50/20", "NH": "25/50/25", "NJ": "35/70/25", "NM": "25/50/10", "NY": "25/50/10", "NC": "50/100/50", "ND": "25/50/25", "OH": "25/50/25", "OK": "25/50/25", "OR": "25/50/20", "PA": "15/30/5", "RI": "25/50/25", "SC": "25/50/25", "SD": "25/50/25", "TN": "25/50/25", "TX": "30/60/25", "UT": "30/65/25", "VT": "25/50/10", "VA": "50/100/25", "WA": "25/50/10", "WV": "25/50/25", "WI": "25/50/10", "WY": "25/50/20" }, "notes": { "FL": ["Florida requires $10,000 of personal injury protection (PIP) and $10,000 of property damage liability; bodily injury liability is not required for most drivers.", "Florida exige $10,000 de protecci\xF3n contra lesiones personales (PIP) y $10,000 de responsabilidad por da\xF1os a la propiedad; la mayor\xEDa de los conductores no est\xE1 obligada a tener responsabilidad por lesiones."], "MI": ["$50,000/$100,000 is the lowest bodily injury limit a driver can choose in writing; Michigan policies default to $250,000/$500,000.", "$50,000/$100,000 es el l\xEDmite m\xE1s bajo que se puede elegir por escrito; las p\xF3lizas de Michigan vienen por defecto con $250,000/$500,000."], "NH": ["New Hampshire does not require car insurance, but drivers who buy it must carry at least these limits, and uninsured drivers must still prove they can pay for damage they cause.", "New Hampshire no exige seguro de auto, pero quien lo compra debe tener al menos estos l\xEDmites, y quien no tiene seguro debe demostrar que puede pagar los da\xF1os que cause."] }, "sources": ["Insurance Research Council / III, Automobile financial responsibility limits by state (July 2024)", "MoneyGeek state minimum table (verified May 2026)", "State updates: California SB 1107, New Jersey DOBI Bulletin 25-06, Massachusetts DOI, North Carolina DOI, Utah HB 113, Hawaii DCCA, Virginia (Jan 1, 2025)"] };
  }
});

// lib/genie-intent.js
var require_genie_intent = __commonJS({
  "lib/genie-intent.js"(exports, module) {
    "use strict";
    var TAXONOMY_VERSION = "1.0.0";
    var RULES = {
      situation: {
        coverage_lapse: /\b(laps(?:e|ed)|expir(?:ed|y)|uninsured|without insurance|no insurance|policy ran out)\b/i,
        sr22: /\bsr[ -]?22\b/i,
        fr44: /\bfr[ -]?44\b/i,
        dui: /\b(dui|dwi|drunk driving)\b/i,
        ticket: /\b(ticket|speeding|traffic violation)\b/i,
        accident: /\b(accident|collision|crash)\b/i,
        non_owner: /\b(non[ -]?owner|don't own a car|do not own a car|no car of my own)\b/i,
        rideshare: /\b(uber|lyft|rideshar(?:e|ing)|delivery driver)\b/i,
        new_driver: /\b(new driver|first[ -]?time driver|just got my license)\b/i
      },
      goal: {
        lower_price: /\b(cheap(?:er|est)?|affordable|lower (?:my )?(?:rate|premium|price)|save money|too expensive|price went up)\b/i,
        immediate_coverage: /\b(today|right now|immediately|asap|urgent|tonight)\b/i,
        reinstatement: /\b(reinstat(?:e|ement)|get (?:my )?policy back)\b/i,
        filing_help: /\b(sr[ -]?22|fr[ -]?44|filing)\b/i,
        comparison: /\b(compare|comparison|shop around|different quotes)\b/i
      },
      obstacle: {
        unaffordable: /\b(too expensive|can't afford|cannot afford|price went up|premium increased)\b/i,
        denied: /\b(denied|rejected|won't insure|refused coverage|turned me down)\b/i,
        cancelled: /\b(cancelled|canceled|dropped (?:my )?policy|nonrenew(?:ed|al))\b/i,
        confusing: /\b(confus(?:ed|ing)|don't understand|not sure what)\b/i
      }
    };
    var STATES = { texas: "TX", california: "CA", florida: "FL" };
    function extractIntent(input) {
      if (typeof input !== "string") return { version: TAXONOMY_VERSION, situation: [], goal: [], obstacle: [], urgency: "unknown", state: null };
      const text = input.slice(0, 4e3);
      const result = { version: TAXONOMY_VERSION, situation: [], goal: [], obstacle: [], urgency: "unknown", state: null };
      for (const [category, rules] of Object.entries(RULES)) {
        for (const [code, pattern] of Object.entries(rules)) if (pattern.test(text)) result[category].push(code);
      }
      if (/\b(today|right now|immediately|asap|tonight)\b/i.test(text)) result.urgency = "today";
      else if (/\b(this week|next few days|within (?:a )?week)\b/i.test(text)) result.urgency = "within_week";
      else if (/\b(next month|later|just researching|not yet)\b/i.test(text)) result.urgency = "later";
      for (const [name, code] of Object.entries(STATES)) {
        if (new RegExp("\\b" + name + "\\b", "i").test(text)) {
          result.state = code;
          break;
        }
      }
      return result;
    }
    __name(extractIntent, "extractIntent");
    module.exports = { TAXONOMY_VERSION, extractIntent };
  }
});

// lib/genie-planner.js
var require_genie_planner = __commonJS({
  "lib/genie-planner.js"(exports, module) {
    "use strict";
    var FIELD_ORDER = ["state", "situation", "urgency", "vehicle_status", "coverage_goal"];
    var DEFAULT_REQUIRED = ["state", "urgency", "vehicle_status", "coverage_goal"];
    var QUESTIONS = {
      state: "Which US state do you need auto insurance in?",
      situation: "Is there anything about your driving or insurance history we should account for?",
      urgency: "When do you need coverage to start?",
      vehicle_status: "Do you own, finance, or lease a vehicle, or need non-owner coverage?",
      coverage_goal: "Are you looking for minimum required coverage, broader coverage, or are you unsure?"
    };
    var ALLOWED = {
      urgency: ["today", "within_week", "later", "unknown"],
      vehicle_status: ["owned", "financed", "leased", "no_vehicle", "unknown"],
      coverage_goal: ["minimum", "full", "unsure"]
    };
    function isPresent(field, value) {
      if (value === null || value === void 0 || value === "") return false;
      if (field === "situation") return Array.isArray(value) && (value.length > 0 || value.none === true);
      if (field === "state") return typeof value === "string" && /^[A-Z]{2}$/.test(value);
      if (ALLOWED[field]) return ALLOWED[field].includes(value) && value !== "unknown";
      return false;
    }
    __name(isPresent, "isPresent");
    function nextQuestion(facts, options) {
      const f = facts && typeof facts === "object" ? facts : {};
      const required = options && Array.isArray(options.required) ? options.required.filter((x) => FIELD_ORDER.includes(x)) : DEFAULT_REQUIRED;
      for (const field of FIELD_ORDER) {
        if (required.includes(field) && !isPresent(field, f[field])) return { field, text: QUESTIONS[field], complete: false };
      }
      return { field: null, text: null, complete: true };
    }
    __name(nextQuestion, "nextQuestion");
    module.exports = { FIELD_ORDER, QUESTIONS, isPresent, nextQuestion };
  }
});

// lib/genie-conversation.js
var require_genie_conversation = __commonJS({
  "lib/genie-conversation.js"(exports, module) {
    "use strict";
    var { extractIntent } = require_genie_intent();
    var { nextQuestion } = require_genie_planner();
    var SITUATIONS = /* @__PURE__ */ new Set(["coverage_lapse", "sr22", "fr44", "dui", "ticket", "accident", "non_owner", "rideshare", "new_driver"]);
    function mergeUnique(existing, incoming) {
      return [.../* @__PURE__ */ new Set([...Array.isArray(existing) ? existing : [], ...incoming])];
    }
    __name(mergeUnique, "mergeUnique");
    function processTurn(previous, message, options) {
      const old = previous && typeof previous === "object" ? previous : {};
      const parsed = extractIntent(message);
      const facts = {
        state: parsed.state || old.state || null,
        situation: mergeUnique(old.situation, parsed.situation.filter((x) => SITUATIONS.has(x))),
        goal: mergeUnique(old.goal, parsed.goal),
        obstacle: mergeUnique(old.obstacle, parsed.obstacle),
        urgency: parsed.urgency !== "unknown" ? parsed.urgency : old.urgency || "unknown",
        vehicle_status: old.vehicle_status || "unknown",
        coverage_goal: old.coverage_goal || "unsure"
      };
      const next = nextQuestion(facts, options);
      return { version: parsed.version, facts, next, intelligence: { situation: facts.situation, goal: facts.goal, obstacle: facts.obstacle, urgency: facts.urgency, state: facts.state } };
    }
    __name(processTurn, "processTurn");
    module.exports = { processTurn };
  }
});

// lib/genie-runtime.js
var require_genie_runtime = __commonJS({
  "lib/genie-runtime.js"(exports, module) {
    "use strict";
    var { processTurn } = require_genie_conversation();
    var { nextQuestion } = require_genie_planner();
    var SITUATIONS = /* @__PURE__ */ new Set(["coverage_lapse", "sr22", "fr44", "dui", "ticket", "accident", "non_owner", "rideshare", "new_driver"]);
    var GOALS = /* @__PURE__ */ new Set(["lower_price", "immediate_coverage", "reinstatement", "filing_help", "comparison"]);
    var VEHICLES = /* @__PURE__ */ new Set(["owned", "financed", "leased", "no_vehicle"]);
    var COVERAGE = /* @__PURE__ */ new Set(["minimum", "full"]);
    var URGENCY = /* @__PURE__ */ new Set(["today", "within_week", "later"]);
    function validatedConfirmed(input) {
      const s = input && typeof input === "object" && !Array.isArray(input) ? input : {};
      return {
        state: typeof s.state === "string" && /^[A-Z]{2}$/.test(s.state) ? s.state : null,
        situation: Array.isArray(s.situation) ? [...new Set(s.situation.filter((x) => SITUATIONS.has(x)))].slice(0, 9) : [],
        goal: Array.isArray(s.goal) ? [...new Set(s.goal.filter((x) => GOALS.has(x)))].slice(0, 5) : [],
        urgency: URGENCY.has(s.urgency) ? s.urgency : "unknown",
        vehicle_status: VEHICLES.has(s.vehicle_status) ? s.vehicle_status : "unknown",
        coverage_goal: COVERAGE.has(s.coverage_goal) ? s.coverage_goal : "unsure"
      };
    }
    __name(validatedConfirmed, "validatedConfirmed");
    function hypothetical(text) {
      return /\b(what if|what happens if|if someone|suppose|hypothetically|for example|how does|what is|can someone)\b/i.test(text) && !/\b(i have|i had|i need|i live|i'm in|my car|my insurance)\b/i.test(text);
    }
    __name(hypothetical, "hypothetical");
    function buildIntelligence(confirmed, message) {
      const trusted = validatedConfirmed(confirmed);
      const text = typeof message === "string" ? message.slice(0, 600) : "";
      const candidate = hypothetical(text) ? validatedConfirmed({}) : processTurn({}, text).facts;
      const pending = validatedConfirmed(candidate);
      const hasCandidate = pending.state !== null || pending.situation.length > 0 || pending.goal.length > 0 || pending.urgency !== "unknown";
      return {
        version: "2.0",
        confirmed: trusted,
        candidates: pending,
        requires_confirmation: hasCandidate,
        next: nextQuestion(trusted),
        buyer_routing: "not_in_advisor_engine"
      };
    }
    __name(buildIntelligence, "buildIntelligence");
    module.exports = { validatedConfirmed, hypothetical, buildIntelligence };
  }
});

// api/chat.js
var require_chat = __commonJS({
  "api/chat.js"(exports, module) {
    var { cors } = require_http();
    var MINIMUMS = require_minimums();
    var { buildIntelligence } = require_genie_runtime();
    function minimumsBlock() {
      var rows = Object.keys(MINIMUMS.limits).map(function(k) {
        return k + " " + MINIMUMS.limits[k];
      }).join(", ");
      var notes = Object.keys(MINIMUMS.notes).map(function(k) {
        return k + ": " + MINIMUMS.notes[k][0];
      }).join(" ");
      return "\n\nSTATE MINIMUM LIABILITY LIMITS (checked " + MINIMUMS.checked + "; format = bodily injury per person/per accident/property damage, in $ thousands): " + rows + ". Notes: " + notes;
    }
    __name(minimumsBlock, "minimumsBlock");
    var MODEL = process.env.CHAT_MODEL || "claude-haiku-4-5-20251001";
    var MAX_MSG_CHARS = 600;
    var MAX_HISTORY = 10;
    var MAX_OUTPUT_TOKENS = 300;
    var hits = {};
    function rateLimited(ip) {
      var now = Date.now();
      var windowMs = 60 * 1e3;
      var max = 12;
      hits[ip] = (hits[ip] || []).filter(function(t) {
        return now - t < windowMs;
      });
      if (hits[ip].length >= max) return true;
      hits[ip].push(now);
      return false;
    }
    __name(rateLimited, "rateLimited");
    var SAFE_FIELDS = ["state", "age", "vehicleYear", "vehicleMake", "driving", "coverage", "insured", "homeowner", "military", "multiCar", "priority"];
    function cleanProfile(p) {
      var out = [];
      if (!p || typeof p !== "object") return "";
      SAFE_FIELDS.forEach(function(k) {
        if (p[k] !== void 0 && p[k] !== null) {
          out.push(k + ": " + String(p[k]).replace(/[^\w\s\-\.\/]/g, "").slice(0, 30));
        }
      });
      return out.length ? "\nKnown about this user (for context only): " + out.join(", ") + "." : "";
    }
    __name(cleanProfile, "cleanProfile");
    function cleanResults(r) {
      if (!Array.isArray(r)) return "";
      var names = r.slice(0, 6).map(function(x) {
        return String(x.n || "").replace(/[^\w\s\.\-&']/g, "").slice(0, 40);
      }).filter(Boolean);
      return names.length ? "\nInsurers currently shown to this user: " + names.join(", ") + "." : "";
    }
    __name(cleanResults, "cleanResults");
    var SYSTEM_PROMPT = "You are AI InsureGenie, a friendly assistant that helps people in the United States understand and shop for auto insurance.\n\nSCOPE: Only discuss US auto insurance (coverage types, deductibles, claims, discounts, SR-22, rates, how to compare, how insurers work). If asked about anything else, politely say you only help with auto insurance and offer to help with that.\n\nSTYLE: Warm, plain English, 2-3 short paragraphs max. Use **bold** sparingly for key terms. No long lists.\n\nHONESTY RULES:\n- Never guarantee a price, approval, or savings. Use words like 'typically' or 'often'.\n- You are not a licensed agent and cannot give legal or financial advice. For policy-specific decisions, suggest confirming with the insurer or a licensed agent.\n- Do not claim one insurer is definitively the best. Explain what each tends to be good for.\n- If you are not sure about a specific fact (a current discount, a state rule), say so instead of guessing.\n- LEGAL FACTS: Never state a state's required limits, fines, penalties, filing periods or other legal requirements from memory. For minimum liability limits use ONLY the STATE MINIMUM LIABILITY LIMITS table below, and say they were last checked on its date. For any other legal requirement, say it varies by state and suggest checking the state DMV or insurance department.\n- If asked how this service makes money: say AI InsureGenie may earn a fee from the quoting partners it recommends when users visit them or request quotes, and that it is free for the user.\n- Do not quote specific savings amounts or percentages, and do not name specific insurance companies as cheapest or best for a group of drivers. Explain what tends to affect price instead.\n- Never ask for or repeat personal details like phone number, email, or full address.\n- If the user is frustrated or has a complex situation, offer to connect them with a licensed agent (the Agent button).\n\nHow the service works: the user answers a few quick questions and you recommend one quoting partner that fits them (their 'top pick'); they then fill in that partner's short form to see real quotes. When it fits naturally, remind them they can tap 'Get instant quote' to find their match. Do not push it every time.";
    module.exports = /* @__PURE__ */ __name(async function handler(req, res) {
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
        var history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];
        var messages = [];
        history.forEach(function(h) {
          if (h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string") {
            messages.push({ role: h.role, content: h.content.slice(0, MAX_MSG_CHARS * 2) });
          }
        });
        while (messages.length && messages[0].role !== "user") messages.shift();
        var cleaned = [];
        messages.forEach(function(m) {
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
        var system = SYSTEM_PROMPT + cleanProfile(body.profile) + cleanResults(body.results) + minimumsBlock();
        system += '\n\nSTYLE: Answer in under 120 words. No greetings like "Great question". If you use a number example, check the arithmetic (e.g. $3,000 damage with a $500 deductible: you pay $500, insurer pays $2,500).';
        if (body.lang === "es") system += '\n\nLANGUAGE: The user is browsing in Spanish. Always reply in clear, neutral Latin American Spanish, using "usted". Keep insurance terms like SR-22 as-is.';
        var controller = new AbortController();
        var timer = setTimeout(function() {
          controller.abort();
        }, 15e3);
        var apiRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: MAX_OUTPUT_TOKENS,
            system,
            messages: cleaned
          }),
          signal: controller.signal
        });
        clearTimeout(timer);
        if (!apiRes.ok) {
          var errText = await apiRes.text();
          console.error("Anthropic error:", apiRes.status, errText.slice(0, 300));
          return res.status(502).json({ error: "The assistant is unavailable right now." });
        }
        var data = await apiRes.json();
        var text = "";
        (data.content || []).forEach(function(b) {
          if (b.type === "text" && b.text) text += b.text;
        });
        if (!text) return res.status(502).json({ error: "No answer generated." });
        if (req.genieV2Enabled === true && body.genie_v2 === true) {
          return res.status(200).json({ answer: text, genie_v2: buildIntelligence(body.genie_facts, message) });
        }
        return res.status(200).json({ answer: text });
      } catch (err) {
        console.error("Chat error:", err && err.message);
        return res.status(500).json({ error: "Something went wrong." });
      }
    }, "handler");
  }
});

// lib/migrate.js
var require_migrate = __commonJS({
  "lib/migrate.js"(exports) {
    var { upstash, upstashConfigured, ensureSchema } = require_kv();
    var DONE_KEY = "_migrated_from_upstash";
    var running = null;
    var MAX_CHUNK_BYTES = 9e5;
    function chunkByBytes(items) {
      var out = [], cur = [], size = 2;
      items.forEach(function(it) {
        var n = JSON.stringify(it).length + 1;
        if (cur.length && size + n > MAX_CHUNK_BYTES) {
          out.push(cur);
          cur = [];
          size = 2;
        }
        cur.push(it);
        size += n;
      });
      if (cur.length) out.push(cur);
      return out;
    }
    __name(chunkByBytes, "chunkByBytes");
    async function copy(db) {
      await ensureSchema();
      var done = await db.prepare("SELECT v FROM kv WHERE k = ?").bind(DONE_KEY).first();
      if (done) return { already: true, copied_at: done.v };
      var partners2 = await upstash(["GET", "aig:partners"]);
      var ids = await upstash(["LRANGE", "leads", "0", "-1"]) || [];
      var leads2 = [];
      for (var i = 0; i < ids.length; i += 500) {
        var chunk = ids.slice(i, i + 500);
        var vals = await upstash(["MGET"].concat(chunk.map(function(id) {
          return "lead:" + id;
        })));
        chunk.forEach(function(id, j) {
          if (vals && vals[j]) leads2.push({ k: "lead:" + id, v: vals[j] });
        });
      }
      var cfRows = await db.prepare("SELECT v FROM list_items WHERE name = 'leads' ORDER BY seq ASC").all();
      var copied = {};
      ids.forEach(function(id) {
        copied[id] = true;
      });
      var cfIds = (cfRows.results || []).map(function(r) {
        return r.v;
      }).filter(function(id) {
        return !copied[id];
      });
      var listOldestFirst = ids.slice().reverse().concat(cfIds);
      var upsertJson = "INSERT INTO kv (k, v, exp) SELECT json_extract(value, '$.k'), json_extract(value, '$.v'), NULL FROM json_each(?) WHERE true ON CONFLICT(k) DO UPDATE SET v = excluded.v, exp = NULL";
      var stmts = [];
      if (partners2) stmts.push(db.prepare("INSERT INTO kv (k, v, exp) VALUES ('aig:partners', ?, NULL) ON CONFLICT(k) DO UPDATE SET v = excluded.v, exp = NULL").bind(partners2));
      chunkByBytes(leads2).forEach(function(c) {
        stmts.push(db.prepare(upsertJson).bind(JSON.stringify(c)));
      });
      stmts.push(db.prepare("DELETE FROM list_items WHERE name = 'leads'"));
      chunkByBytes(listOldestFirst).forEach(function(c) {
        stmts.push(db.prepare("INSERT INTO list_items (name, v) SELECT 'leads', value FROM json_each(?) ORDER BY key").bind(JSON.stringify(c)));
      });
      var at = (/* @__PURE__ */ new Date()).toISOString();
      stmts.push(db.prepare("INSERT INTO kv (k, v, exp) VALUES (?, ?, NULL) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(DONE_KEY, at));
      await db.batch(stmts);
      var summary = { copied_at: at, partners: partners2 ? JSON.parse(partners2).length : 0, leads: leads2.length, cloudflare_leads_kept: cfIds.length };
      console.log(JSON.stringify(Object.assign({ event: "upstash_migration" }, summary)));
      return summary;
    }
    __name(copy, "copy");
    exports.migrateIfNeeded = function(db) {
      if (!db || !upstashConfigured()) return Promise.resolve(null);
      if (!running) {
        running = copy(db).catch(function(e) {
          running = null;
          console.error("migration failed:", e && e.message);
          return { error: e && e.message };
        });
      }
      return running;
    };
    exports.migrationStatus = async function(db) {
      if (!db) return null;
      await ensureSchema();
      var row = await db.prepare("SELECT v FROM kv WHERE k = ?").bind(DONE_KEY).first();
      return row ? row.v : null;
    };
  }
});

// api/health.js
var require_health = __commonJS({
  "api/health.js"(exports, module) {
    var { kvConfigured, upstashConfigured } = require_kv();
    var { migrationStatus } = require_migrate();
    var { cors } = require_http();
    module.exports = /* @__PURE__ */ __name(async function handler(req, res) {
      cors(req, res, "GET, OPTIONS");
      if (req.method === "OPTIONS") return res.status(200).end();
      var onCloudflare = !!globalThis.__AIG_D1;
      var copied = null;
      if (onCloudflare) {
        try {
          copied = await migrationStatus(globalThis.__AIG_D1);
        } catch (e) {
          copied = null;
        }
      }
      res.status(200).json({
        status: "ok",
        service: "AI InsureGenie API",
        host: onCloudflare ? "cloudflare" : "vercel",
        setup: {
          storage_connected: kvConfigured(),
          storage: onCloudflare ? "cloudflare-d1" : upstashConfigured() ? "upstash" : "none",
          old_data_copied_at: onCloudflare ? copied : void 0,
          admin_password_set: !!process.env.ADMIN_PASSWORD,
          ai_chat_key_set: !!process.env.ANTHROPIC_API_KEY,
          lead_webhook_set: !!process.env.LEAD_WEBHOOK_URL,
          callback_webhook_set: !!(process.env.CALLBACK_WEBHOOK_URL || process.env.LEAD_WEBHOOK_URL)
        }
      });
    }, "handler");
  }
});

// api/leads.js
var require_leads = __commonJS({
  "api/leads.js"(exports, module) {
    var crypto = require_crypto();
    var { kv, kvConfigured } = require_kv();
    var { cors, ip } = require_http();
    var { isOptedOut } = require_privacy();
    var hits = {};
    function rateLimited(who) {
      var now = Date.now();
      hits[who] = (hits[who] || []).filter(function(t) {
        return now - t < 6e4;
      });
      if (hits[who].length >= 20) return true;
      hits[who].push(now);
      return false;
    }
    __name(rateLimited, "rateLimited");
    function tfUrl(v) {
      var u = v == null ? "" : String(v).trim().slice(0, 200);
      return /^https:\/\/cert\.trustedform\.com\/[A-Za-z0-9]+$/.test(u) ? u : null;
    }
    __name(tfUrl, "tfUrl");
    function text(v, n) {
      return v == null ? null : String(v).trim().slice(0, n);
    }
    __name(text, "text");
    module.exports = /* @__PURE__ */ __name(async function handler(req, res) {
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
      if (errors.length) return res.status(400).json({ success: false, errors });
      var id = crypto.randomUUID();
      var lead = {
        id,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        first_name: first,
        phone,
        email,
        zip: text(d.zip, 5),
        state: text(d.state, 2),
        age: d.age || null,
        vehicle_year: text(d.vehicle_year, 10),
        vehicle_make: text(d.vehicle_make, 40),
        coverage: text(d.coverage, 20),
        driving_record: text(d.driving_record, 20),
        currently_insured: text(d.currently_insured, 5),
        current_insurer: text(d.current_insurer, 60),
        homeowner: text(d.homeowner, 5),
        military: text(d.military, 5),
        multi_car: text(d.multi_car, 5),
        priority: text(d.priority, 20),
        publisher_id: text(d.publisher_id, 60) || "direct",
        sub_id: text(d.sub_id, 80),
        session_id: text(d.session_id, 32),
        utm_source: text(d.utm_source, 60),
        utm_medium: text(d.utm_medium, 60),
        utm_campaign: text(d.utm_campaign, 80),
        landing_page: text(d.landing_page, 300),
        // Consent record: the exact wording the person saw, when, and from where
        consent_text: text(d.consent_text, 1200),
        consent_timestamp: text(d.consent_timestamp, 40),
        disclosed_partners: text(d.disclosed_buyers, 600),
        trustedform_cert_url: tfUrl(d.trustedform_cert_url),
        ip_address: who,
        user_agent: text(req.headers["user-agent"], 200)
      };
      lead.do_not_sell = d.do_not_sell === true;
      try {
        if (!lead.do_not_sell && await isOptedOut(email, phone)) lead.do_not_sell = true;
      } catch (e2) {
        console.error("opt-out check failed:", e2 && e2.message);
      }
      try {
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
          } catch (err) {
            console.error("store failed:", err && err.message);
          }
        }
        if (webhook && !lead.do_not_sell) {
          try {
            var controller = new AbortController();
            var timer = setTimeout(function() {
              controller.abort();
            }, 8e3);
            var r = await fetch(webhook, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(Object.assign({ text: "New lead: " + first + ", " + phone + ", " + (lead.state || "") + " " + (lead.zip || "") }, lead)),
              signal: controller.signal
            });
            clearTimeout(timer);
            forwarded = r.ok;
            if (!r.ok) console.error("lead webhook responded", r.status);
          } catch (err) {
            console.error("lead webhook failed:", err && err.message);
          }
        }
        if (!stored && !forwarded) return res.status(502).json({ success: false, error: "Could not save the lead." });
        return res.status(200).json({ success: true, lead_id: id });
      } catch (err) {
        console.error("lead error:", err && err.message);
        return res.status(500).json({ success: false, error: "Something went wrong." });
      }
    }, "handler");
  }
});

// api/partners.js
var require_partners = __commonJS({
  "api/partners.js"(exports, module) {
    var { kv, kvConfigured } = require_kv();
    var { cors } = require_http();
    var { adminGate } = require_auth();
    var KEY = "aig:partners";
    function validUrl(s) {
      try {
        var u = new URL(String(s || ""));
        return u.protocol === "http:" || u.protocol === "https:" ? String(s) : "";
      } catch (e) {
        return "";
      }
    }
    __name(validUrl, "validUrl");
    function validLogo(s) {
      s = String(s || "");
      if (/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+\/=]+$/.test(s)) return s;
      return validUrl(s);
    }
    __name(validLogo, "validLogo");
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
        placement: p.placement === "other" ? "other" : "top",
        weight: Math.max(0, Math.min(100, p.weight == null ? 50 : Number(p.weight) || 0)),
        goals: Array.isArray(p.goals) ? p.goals.filter(function(g) {
          return ["price", "coverage", "service"].indexOf(g) >= 0;
        }) : [],
        states: String(p.states || "").toUpperCase().split(/[^A-Z]+/).filter(function(x) {
          return x.length === 2;
        }).slice(0, 60),
        base: Math.round(60 + (Number(p.payout) || 5) * 3)
        // used only for the on-screen estimate
      };
    }
    __name(publicView, "publicView");
    module.exports = /* @__PURE__ */ __name(async function handler(req, res) {
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
          var pub = (list || []).filter(function(p2) {
            return p2 && p2.enabled === true && p2.placement !== "hidden" && validUrl(p2.link);
          }).map(publicView);
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
          if (json.length > 3e6) return res.status(400).json({ error: "That is too much data. Use smaller logos." });
          await kv(["SET", KEY, json]);
          return res.status(200).json({ ok: true, saved: list2.length });
        }
        return res.status(405).json({ error: "Method not allowed" });
      } catch (err) {
        console.error("partners error:", err && err.message);
        return res.status(500).json({ error: "Something went wrong." });
      }
    }, "handler");
  }
});

// api/event.js
var require_event = __commonJS({
  "api/event.js"(exports, module) {
    var { kv, kvConfigured } = require_kv();
    var { cors, ip } = require_http();
    var TYPES = ["chat_started", "chat_resumed", "step_answered", "question_asked", "chat_left", "match_shown", "no_match", "partner_click", "call_request", "email_signup"];
    var META = { match_shown: "ViewContent", partner_click: "Lead", call_request: "Contact", email_signup: "Subscribe" };
    var hits = {};
    function rateLimited(who) {
      var now = Date.now();
      hits[who] = (hits[who] || []).filter(function(t) {
        return now - t < 6e4;
      });
      if (hits[who].length >= 60) return true;
      hits[who].push(now);
      return false;
    }
    __name(rateLimited, "rateLimited");
    function clean(v, n) {
      return v == null ? null : String(v).replace(/[^\w\-\. ]/g, "").slice(0, n) || null;
    }
    __name(clean, "clean");
    async function toMeta(ev, req) {
      var pixel = process.env.META_PIXEL_ID, token = process.env.META_CAPI_TOKEN;
      if (!pixel || !token || !META[ev.type] || ev.dns) return;
      try {
        await fetch("https://graph.facebook.com/v21.0/" + pixel + "/events?access_token=" + encodeURIComponent(token), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: [{
            event_name: META[ev.type],
            event_time: Math.floor(Date.now() / 1e3),
            event_id: ev.session_id + ":" + ev.type,
            action_source: "website",
            event_source_url: "https://chat.aiinsuregenie.com/",
            user_data: { client_ip_address: ip(req), client_user_agent: String(req.headers["user-agent"] || "").slice(0, 300) },
            custom_data: { content_category: "auto_insurance", content_ids: ev.partner_id ? [ev.partner_id] : void 0 }
          }] })
        });
      } catch (e) {
        console.error("meta capi failed:", e && e.message);
      }
    }
    __name(toMeta, "toMeta");
    module.exports = /* @__PURE__ */ __name(async function handler(req, res) {
      cors(req, res, "POST, OPTIONS");
      if (req.method === "OPTIONS") return res.status(200).end();
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      if (rateLimited(ip(req))) return res.status(429).json({ error: "Too many events." });
      var b = req.body;
      if (typeof b === "string") {
        try {
          b = JSON.parse(b);
        } catch (e) {
          b = null;
        }
      }
      if (!b || TYPES.indexOf(b.type) < 0 || !/^s[a-z0-9]{6,30}$/.test(String(b.session_id || ""))) {
        return res.status(400).json({ error: "Bad event." });
      }
      var ev = {
        type: b.type,
        session_id: String(b.session_id),
        at: (/* @__PURE__ */ new Date()).toISOString(),
        state: clean(b.state, 2),
        partner_id: clean(b.partner_id, 40),
        goal: clean(b.goal, 20),
        placement: clean(b.placement, 10),
        source: clean(b.source, 20),
        step: clean(b.step || b.stage, 20),
        mode: clean(b.mode, 12),
        lang: b.lang === "es" ? "es" : "en",
        dns: b.dns === true,
        utm_source: clean(b.utm_source, 60),
        utm_campaign: clean(b.utm_campaign, 80),
        utm_content: clean(b.utm_content, 80),
        pub: clean(b.pub, 40)
      };
      try {
        if (kvConfigured()) {
          await kv(["LPUSH", "events", JSON.stringify(ev)]);
          if (Math.random() < 0.02) await kv(["LTRIM", "events", "0", "49999"]);
        }
      } catch (e) {
        console.error("event store failed:", e && e.message);
      }
      await toMeta(ev, req);
      return res.status(200).json({ ok: true });
    }, "handler");
  }
});

// api/subscribe.js
var require_subscribe = __commonJS({
  "api/subscribe.js"(exports, module) {
    var crypto = require_crypto();
    var { kv, kvConfigured } = require_kv();
    var { cors, ip } = require_http();
    var hits = {};
    function rateLimited(who) {
      var now = Date.now();
      hits[who] = (hits[who] || []).filter(function(t) {
        return now - t < 6e5;
      });
      if (hits[who].length >= 5) return true;
      hits[who].push(now);
      return false;
    }
    __name(rateLimited, "rateLimited");
    function text(v, n) {
      return v == null ? null : String(v).trim().slice(0, n) || null;
    }
    __name(text, "text");
    function tfUrl(v) {
      var u = v == null ? "" : String(v).trim().slice(0, 200);
      return /^https:\/\/cert\.trustedform\.com\/[A-Za-z0-9]+$/.test(u) ? u : null;
    }
    __name(tfUrl, "tfUrl");
    module.exports = /* @__PURE__ */ __name(async function handler(req, res) {
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
      var prev = null;
      try {
        prev = existing ? JSON.parse(existing) : null;
      } catch (e) {
      }
      var rec = {
        id: prev ? prev.id : crypto.randomUUID(),
        email,
        created_at: prev ? prev.created_at : (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString(),
        source: text(b.source, 20),
        lang: b.lang === "es" ? "es" : "en",
        state: text(b.state, 2),
        zip: text(b.zip, 5),
        vehicle_year: text(b.vehicle_year, 10),
        vehicle_make: text(b.vehicle_make, 40),
        driving_record: text(b.driving_record, 20),
        priority: text(b.priority, 20),
        session_id: text(b.session_id, 32),
        consent_text: text(b.consent_text, 600),
        consent_timestamp: text(b.consent_timestamp, 40),
        trustedform_cert_url: tfUrl(b.trustedform_cert_url),
        landing_page: text(b.landing_page, 300),
        ip_address: who,
        user_agent: text(req.headers["user-agent"], 200),
        unsubscribed: false,
        unsub_token: prev && prev.unsub_token ? prev.unsub_token : crypto.randomBytes(12).toString("hex")
      };
      try {
        await kv(["SET", "sub:" + email, JSON.stringify(rec)]);
        if (!prev) await kv(["LPUSH", "subscribers", email]);
        return res.status(200).json({ ok: true });
      } catch (e) {
        console.error("subscribe failed:", e && e.message);
        return res.status(500).json({ error: "Could not save." });
      }
    }, "handler");
  }
});

// worker.js
var import_admin = __toESM(require_admin());
var import_callback = __toESM(require_callback());
var import_chat = __toESM(require_chat());
var import_health = __toESM(require_health());
var import_leads = __toESM(require_leads());
var import_partners = __toESM(require_partners());
var import_event = __toESM(require_event());
var import_subscribe = __toESM(require_subscribe());
var import_privacy = __toESM(require_privacy());
var import_migrate = __toESM(require_migrate());
var ROUTES = { admin: import_admin.default, callback: import_callback.default, chat: import_chat.default, health: import_health.default, leads: import_leads.default, partners: import_partners.default, event: import_event.default, subscribe: import_subscribe.default, privacy: import_privacy.default };
var USES_STORAGE = { admin: true, leads: true, partners: true, health: true, event: true, subscribe: true, privacy: true, callback: true };
async function toReq(request, url) {
  const headers = {};
  for (const [k, v] of request.headers) headers[k.toLowerCase()] = v;
  headers["x-forwarded-for"] = request.headers.get("cf-connecting-ip") || headers["x-forwarded-for"] || "unknown";
  const query = {};
  for (const [k, v] of url.searchParams) query[k] = v;
  let body = void 0;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const text = await request.text();
    const type = (headers["content-type"] || "").toLowerCase();
    if (type.includes("application/json")) {
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = void 0;
      }
    } else if (type.includes("application/x-www-form-urlencoded")) {
      body = Object.fromEntries(new URLSearchParams(text));
    } else {
      body = text;
    }
  }
  return { method: request.method, headers, query, body, url: url.pathname + url.search };
}
__name(toReq, "toReq");
function toRes() {
  let resolve;
  const done = new Promise((r) => {
    resolve = r;
  });
  const headers = new Headers();
  let statusCode = 200;
  let sent = false;
  const finish = /* @__PURE__ */ __name((r) => {
    sent = true;
    resolve(r);
  }, "finish");
  const res = {
    get headersSent() {
      return sent;
    },
    setHeader(k, v) {
      headers.set(k, String(v));
      return res;
    },
    getHeader(k) {
      return headers.get(k);
    },
    status(code) {
      statusCode = code;
      return res;
    },
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
    }
  };
  return { res, done, isSent: /* @__PURE__ */ __name(() => sent, "isSent") };
}
__name(toRes, "toRes");
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname === "/" ? "/api/health" : url.pathname.replace(/\/+$/, "");
    if (path === "/api/geo") {
      const origin = request.headers.get("origin") || "";
      const ok = /^https:\/\/([a-z0-9-]+\.)?aiinsuregenie\.com$/.test(origin) || /\.workers\.dev$/.test(origin);
      const cf = request.cf || {};
      const state = cf.country === "US" && /^[A-Z]{2}$/.test(cf.regionCode || "") ? cf.regionCode : null;
      return new Response(JSON.stringify({ state }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...ok ? { "access-control-allow-origin": origin, "vary": "Origin" } : {} }
      });
    }
    const m = path.match(/^\/api\/([a-z]+)$/);
    const name = m && m[1];
    const handler = name && ROUTES[name];
    if (!handler) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    }
    globalThis.__AIG_D1 = env.DB || null;
    if (USES_STORAGE[name] && env.DB) await (0, import_migrate.migrateIfNeeded)(env.DB);
    const req = await toReq(request, url);
    req.genieV2Enabled = env.GENIE_V2_ENABLED === "true";
    const { res, done, isSent } = toRes();
    try {
      await handler(req, res);
    } catch (err) {
      console.error(name + " crashed:", err && err.message);
      if (!isSent()) res.status(500).json({ error: "Something went wrong." });
    }
    if (!isSent()) res.status(500).json({ error: "No response." });
    return done;
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
