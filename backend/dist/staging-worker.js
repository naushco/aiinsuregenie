var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
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

// backend/lib/genie-intent.js
var require_genie_intent = __commonJS({
  "backend/lib/genie-intent.js"(exports, module) {
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
    module.exports = { TAXONOMY_VERSION, extractIntent };
  }
});

// backend/lib/genie-planner.js
var require_genie_planner = __commonJS({
  "backend/lib/genie-planner.js"(exports, module) {
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
    function nextQuestion2(facts, options) {
      const f = facts && typeof facts === "object" ? facts : {};
      const required = options && Array.isArray(options.required) ? options.required.filter((x) => FIELD_ORDER.includes(x)) : DEFAULT_REQUIRED;
      for (const field of FIELD_ORDER) {
        if (required.includes(field) && !isPresent(field, f[field])) return { field, text: QUESTIONS[field], complete: false };
      }
      return { field: null, text: null, complete: true };
    }
    module.exports = { FIELD_ORDER, QUESTIONS, isPresent, nextQuestion: nextQuestion2 };
  }
});

// backend/lib/genie-conversation.js
var require_genie_conversation = __commonJS({
  "backend/lib/genie-conversation.js"(exports, module) {
    "use strict";
    var { extractIntent } = require_genie_intent();
    var { nextQuestion: nextQuestion2 } = require_genie_planner();
    var SITUATIONS2 = /* @__PURE__ */ new Set(["coverage_lapse", "sr22", "fr44", "dui", "ticket", "accident", "non_owner", "rideshare", "new_driver"]);
    function mergeUnique(existing, incoming) {
      return [.../* @__PURE__ */ new Set([...Array.isArray(existing) ? existing : [], ...incoming])];
    }
    function processTurn2(previous, message, options) {
      const old = previous && typeof previous === "object" ? previous : {};
      const parsed = extractIntent(message);
      const facts = {
        state: parsed.state || old.state || null,
        situation: mergeUnique(old.situation, parsed.situation.filter((x) => SITUATIONS2.has(x))),
        goal: mergeUnique(old.goal, parsed.goal),
        obstacle: mergeUnique(old.obstacle, parsed.obstacle),
        urgency: parsed.urgency !== "unknown" ? parsed.urgency : old.urgency || "unknown",
        vehicle_status: old.vehicle_status || "unknown",
        coverage_goal: old.coverage_goal || "unsure"
      };
      const next = nextQuestion2(facts, options);
      return { version: parsed.version, facts, next, intelligence: { situation: facts.situation, goal: facts.goal, obstacle: facts.obstacle, urgency: facts.urgency, state: facts.state } };
    }
    module.exports = { processTurn: processTurn2 };
  }
});

// backend/staging-worker.js
var import_genie_conversation = __toESM(require_genie_conversation());
var import_genie_planner = __toESM(require_genie_planner());
var { processTurn } = import_genie_conversation.default;
var { nextQuestion } = import_genie_planner.default;
var SITUATIONS = /* @__PURE__ */ new Set(["coverage_lapse", "sr22", "fr44", "dui", "ticket", "accident", "non_owner", "rideshare", "new_driver"]);
var GOALS = /* @__PURE__ */ new Set(["lower_price", "immediate_coverage", "reinstatement", "filing_help", "comparison"]);
var ALLOWED_STATES = /* @__PURE__ */ new Set(["TX", "CA", "FL"]);
var VALID_CERT = /^https:\/\/cert\.trustedform\.com\/[A-Za-z0-9]+$/;
var ORIGIN = "https://aiinsuregenie-chat-staging.in-naushco.workers.dev";
var respond = (body, status = 200, origin = "") => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    ...origin === ORIGIN ? { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" } : {}
  }
});
function confirmedFacts(input) {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return {
    state: ALLOWED_STATES.has(raw.state) ? raw.state : null,
    situation: Array.isArray(raw.situation) ? [...new Set(raw.situation.filter((x) => SITUATIONS.has(x)))].slice(0, 8) : [],
    goal: Array.isArray(raw.goal) ? [...new Set(raw.goal.filter((x) => GOALS.has(x)))].slice(0, 5) : [],
    urgency: ["today", "within_week", "later"].includes(raw.urgency) ? raw.urgency : "unknown",
    vehicle_status: ["owned", "financed", "leased", "no_vehicle"].includes(raw.vehicle_status) ? raw.vehicle_status : "unknown",
    coverage_goal: ["minimum", "full"].includes(raw.coverage_goal) ? raw.coverage_goal : "unsure"
  };
}
function answerTo(message) {
  const text = message.toLowerCase();
  if (/sr[ -]?22|fr[ -]?44/.test(text)) return "An SR-22 or FR-44 is typically proof of financial responsibility, not an insurance policy. Requirements vary by state and personal circumstances. Check with your state's licensing authority or a licensed agent before purchasing.";
  if (/dui|dwi/.test(text)) return "A DUI can affect insurance availability and pricing, but options depend on the state and your driving history. Compare options with a licensed agent, and verify any filing requirements with the state.";
  if (/coverage|deductible|liability/.test(text)) return "Liability insurance covers certain harm you cause to others, while collision and comprehensive generally address different types of damage to your own vehicle. Limits, deductibles, and exclusions matter; review your policy and local requirements.";
  return "I can help you understand auto insurance and prepare questions for a licensed quoting partner. This is a staging demonstration using real Genie intent parsing and deterministic educational responses, not a carrier quote.";
}
function isHypothetical(message) {
  return /\b(what if|if someone|suppose|hypothetically|for example|how does|what happens if|what is|can someone)\b/i.test(message) && !/\b(i have|i had|i need|i live|i'm in|my car|my insurance)\b/i.test(message);
}
var staging_worker_default = {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin") || "";
    if (request.method === "OPTIONS" && origin === ORIGIN) {
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": ORIGIN,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "600"
      } });
    }
    if (url.pathname === "/_health" && request.method === "GET")
      return respond({
        status: "ok",
        environment: "genie-staging-api",
        engine: "deterministic-genie-v2",
        d1: false,
        secrets: false,
        live_buyers: false,
        lead_persistence: false
      }, 200, origin);
    if (url.pathname === "/api/geo" && request.method === "GET") return respond({ state: null }, 200, origin);
    if (url.pathname === "/api/partners" && request.method === "GET") return respond({ partners: [], storage: false, test_only: true }, 200, origin);
    if (url.pathname === "/api/event") return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    if (url.pathname === "/api/chat" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return respond({ error: "Invalid JSON" }, 400, origin);
      }
      const message = typeof body.message === "string" ? body.message.trim().slice(0, 600) : "";
      if (!message) return respond({ error: "A message is required" }, 400, origin);
      const current = confirmedFacts(body.confirmed);
      const inferred = isHypothetical(message) ? { facts: confirmedFacts({}) } : processTurn({}, message);
      return respond({ answer: answerTo(message), genie_v2: {
        candidates: inferred.facts,
        confirmed: current,
        next: nextQuestion(current),
        requires_confirmation: !!inferred.facts.state || inferred.facts.situation.length > 0,
        buyer_routing: "disabled_in_staging"
      } }, 200, origin);
    }
    if (url.pathname === "/__test/partner-route" && request.method === "POST") {
      let b;
      try {
        b = await request.json();
      } catch {
        return respond({ error: "Invalid JSON" }, 400, origin);
      }
      const keys = b && typeof b === "object" && !Array.isArray(b) ? Object.keys(b) : [];
      const allowed = /* @__PURE__ */ new Set(["fixture", "state", "situation", "demo_buyers"]);
      if (b?.fixture !== "SYNTHETIC_ONLY" || keys.some((k) => !allowed.has(k)))
        return respond({ error: "Only explicitly allowed synthetic routing fields are accepted" }, 400, origin);
      const state = b.state, situation = b.situation;
      if (!ALLOWED_STATES.has(state) || !SITUATIONS.has(situation) || !Array.isArray(b.demo_buyers) || b.demo_buyers.length > 8)
        return respond({ error: "Invalid synthetic routing fixture" }, 400, origin);
      if (b.demo_buyers.some((x) => !x || typeof x !== "object" || !/^DEMO_[A-Z0-9_]{1,30}$/.test(x.id) || !Array.isArray(x.states) || !Array.isArray(x.situations) || x.states.some((st) => !ALLOWED_STATES.has(st)) || x.situations.some((si) => !SITUATIONS.has(si))))
        return respond({ error: "Only DEMO buyer rules are allowed" }, 400, origin);
      const eligible = b.demo_buyers.filter((x) => x.states.includes(state) && x.situations.includes(situation)).map((x) => x.id);
      return respond({
        fixture: true,
        state,
        situation,
        eligible_demo_buyers: eligible,
        recommended_demo_buyer: eligible[0] || null,
        eligible_for_real_insurance: null,
        buyer_delivery: false,
        database_writes: false,
        simulated_only: true
      }, 200, origin);
    }
    if (url.pathname === "/__test/consent-handoff" && request.method === "POST") {
      let b;
      try {
        b = await request.json();
      } catch {
        return respond({ error: "Invalid JSON" }, 400, origin);
      }
      if (b.fixture !== "SYNTHETIC_ONLY" || ["name", "first_name", "last_name", "email", "phone", "address", "zip", "ip_address"].some((k) => b[k] != null))
        return respond({ error: "Synthetic fixtures only; personal data forbidden" }, 400, origin);
      const cert = typeof b.trustedform_cert_url === "string" && VALID_CERT.test(b.trustedform_cert_url);
      const consent = b.consent_opt_in === true && typeof b.consent_text === "string" && b.consent_text.trim().length >= 12 && /^20\d{2}-\d\d-\d\dT/.test(b.consent_timestamp || "");
      if (!cert || !consent) return respond({
        accepted: false,
        error: "Valid consent evidence and synthetic certificate required",
        consent_present: consent,
        certificate_present: cert,
        buyer_delivery: false
      }, 422, origin);
      return respond({
        accepted: true,
        route: "DEMO_BUYER_NOT_REAL",
        mapped_fields: [
          "state",
          "consent_text",
          "consent_timestamp",
          "trustedform_cert_url",
          "publisher_id",
          "sub_id"
        ],
        certificate_present: true,
        consent_present: true,
        buyer_delivery: false,
        database_writes: false,
        simulated_only: true
      }, 200, origin);
    }
    return respond({ error: "No real leads or partner requests are permitted in staging" }, 403, origin);
  }
};
export {
  staging_worker_default as default
};
