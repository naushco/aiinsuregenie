// Genie 2.0 staging-only API: actual deterministic intent planner, no live AI key,
// database bindings, partner HTTP calls, tracking, or personal-data persistence.
// Bundle with: npx esbuild backend/staging-worker.js --bundle --format=esm --platform=browser --outfile=backend/dist/staging-worker.js
import conversation from "./lib/genie-conversation.js";
import planner from "./lib/genie-planner.js";

const { processTurn } = conversation;
const { nextQuestion } = planner;
const SITUATIONS = new Set(["coverage_lapse", "sr22", "fr44", "dui", "ticket", "accident", "non_owner", "rideshare", "new_driver"]);
const GOALS = new Set(["lower_price", "immediate_coverage", "reinstatement", "filing_help", "comparison"]);
const ALLOWED_STATES = new Set(["TX", "CA", "FL"]);
const VALID_CERT = /^https:\/\/cert\.trustedform\.com\/[A-Za-z0-9]+$/;
const ORIGIN = "https://aiinsuregenie-chat-staging.in-naushco.workers.dev";
const respond = (body, status = 200, origin = "") => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    ...(origin === ORIGIN ? { "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" } : {}) }
});
function confirmedFacts(input) {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return {
    state: ALLOWED_STATES.has(raw.state) ? raw.state : null,
    situation: Array.isArray(raw.situation) ? [...new Set(raw.situation.filter(x => SITUATIONS.has(x)))].slice(0, 8) : [],
    goal: Array.isArray(raw.goal) ? [...new Set(raw.goal.filter(x => GOALS.has(x)))].slice(0, 5) : [],
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
  return /\b(what if|if someone|suppose|hypothetically|for example|how does|what happens if|what is|can someone)\b/i.test(message)
    && !/\b(i have|i had|i need|i live|i'm in|my car|my insurance)\b/i.test(message);
}
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin") || "";
    if (request.method === "OPTIONS" && origin === ORIGIN) {
      return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": ORIGIN,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "600" } });
    }
    if (url.pathname === "/_health" && request.method === "GET")
      return respond({ status: "ok", environment: "genie-staging-api", engine: "deterministic-genie-v2",
        d1: false, secrets: false, live_buyers: false, lead_persistence: false }, 200, origin);
    if (url.pathname === "/api/geo" && request.method === "GET") return respond({ state: null }, 200, origin);
    if (url.pathname === "/api/partners" && request.method === "GET") return respond({ partners: [], storage: false, test_only: true }, 200, origin);
    if (url.pathname === "/api/event") return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    if (url.pathname === "/api/chat" && request.method === "POST") {
      let body; try { body = await request.json(); } catch { return respond({ error: "Invalid JSON" }, 400, origin); }
      const message = typeof body.message === "string" ? body.message.trim().slice(0, 600) : "";
      if (!message) return respond({ error: "A message is required" }, 400, origin);
      const current = confirmedFacts(body.confirmed);
      // Conversation extraction is a CANDIDATE layer. No inferred personal facts are ever
      // promoted into the confirmed profile without the visitor explicitly confirming them.
      const inferred = isHypothetical(message) ? { facts: confirmedFacts({}) } : processTurn({}, message);
      return respond({ answer: answerTo(message), genie_v2: {
        candidates: inferred.facts, confirmed: current, next: nextQuestion(current),
        requires_confirmation: !!inferred.facts.state || inferred.facts.situation.length > 0,
        buyer_routing: "disabled_in_staging" } }, 200, origin);
    }
    if (url.pathname === "/__test/partner-route" && request.method === "POST") {
      let b; try { b = await request.json(); } catch { return respond({ error: "Invalid JSON" }, 400, origin); }
      // Synthetic buyer rules are submitted by the test. No real buyer inventory,
      // prices, payout values, personal details, or outbound network calls.
      const keys = b && typeof b === "object" && !Array.isArray(b) ? Object.keys(b) : [];
      const allowed = new Set(["fixture", "state", "situation", "demo_buyers"]);
      if (b?.fixture !== "SYNTHETIC_ONLY" || keys.some(k => !allowed.has(k)))
        return respond({ error: "Only explicitly allowed synthetic routing fields are accepted" }, 400, origin);
      const state = b.state, situation = b.situation;
      if (!ALLOWED_STATES.has(state) || !SITUATIONS.has(situation) || !Array.isArray(b.demo_buyers) || b.demo_buyers.length > 8)
        return respond({ error: "Invalid synthetic routing fixture" }, 400, origin);
      if (b.demo_buyers.some(x => !x || typeof x !== "object" || !/^DEMO_[A-Z0-9_]{1,30}$/.test(x.id)
        || !Array.isArray(x.states) || !Array.isArray(x.situations)
        || x.states.some(st => !ALLOWED_STATES.has(st))
        || x.situations.some(si => !SITUATIONS.has(si))))
        return respond({ error: "Only DEMO buyer rules are allowed" }, 400, origin);
      const eligible = b.demo_buyers.filter(x => x.states.includes(state) && x.situations.includes(situation))
        .map(x => x.id);
      return respond({ fixture: true, state, situation, eligible_demo_buyers: eligible,
        recommended_demo_buyer: eligible[0] || null, eligible_for_real_insurance: null,
        buyer_delivery: false, database_writes: false, simulated_only: true }, 200, origin);
    }
    if (url.pathname === "/__test/consent-handoff" && request.method === "POST") {
      let b; try { b = await request.json(); } catch { return respond({ error: "Invalid JSON" }, 400, origin); }
      // Explicit fixture marker and no real PII. This endpoint only assembles and validates
      // a simulated downstream payload; it NEVER saves it or sends it to a buyer.
      if (b.fixture !== "SYNTHETIC_ONLY" || ["name","first_name","last_name","email","phone","address","zip","ip_address"].some(k => b[k] != null))
        return respond({ error: "Synthetic fixtures only; personal data forbidden" }, 400, origin);
      const cert = typeof b.trustedform_cert_url === "string" && VALID_CERT.test(b.trustedform_cert_url);
      const consent = b.consent_opt_in === true && typeof b.consent_text === "string"
        && b.consent_text.trim().length >= 12 && /^20\d{2}-\d\d-\d\dT/.test(b.consent_timestamp || "");
      if (!cert || !consent) return respond({ accepted: false, error: "Valid consent evidence and synthetic certificate required",
        consent_present: consent, certificate_present: cert, buyer_delivery: false }, 422, origin);
      return respond({ accepted: true, route: "DEMO_BUYER_NOT_REAL", mapped_fields: [
        "state", "consent_text", "consent_timestamp", "trustedform_cert_url",
        "publisher_id", "sub_id"], certificate_present: true, consent_present: true,
        buyer_delivery: false, database_writes: false, simulated_only: true }, 200, origin);
    }
    // Callback, subscribe, lead, and all unknown submission endpoints are disabled.
    return respond({ error: "No real leads or partner requests are permitted in staging" }, 403, origin);
  }
};
