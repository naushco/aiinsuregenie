// Production Genie 2.0 advisor qualification. No storage, buyer calls, or PII.
// The UI's confirmed quote selections are the only authoritative user facts.
"use strict";
const { processTurn } = require("./genie-conversation.js");
const { nextQuestion } = require("./genie-planner.js");
const SITUATIONS = new Set(["coverage_lapse","sr22","fr44","dui","ticket","accident","non_owner","rideshare","new_driver"]);
const GOALS = new Set(["lower_price","immediate_coverage","reinstatement","filing_help","comparison"]);
const VEHICLES = new Set(["owned","financed","leased","no_vehicle"]);
const COVERAGE = new Set(["minimum","full"]);
const URGENCY = new Set(["today","within_week","later"]);
function validatedConfirmed(input) {
  const s = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return {
    situation_confirmed: s.situation_confirmed === true || (Array.isArray(s.situation) && s.situation.length > 0),
    coverage_goal_confirmed: s.coverage_goal_confirmed === true,
    state: typeof s.state === "string" && /^[A-Z]{2}$/.test(s.state) ? s.state : null,
    situation: Array.isArray(s.situation) ? [...new Set(s.situation.filter(x => SITUATIONS.has(x)))].slice(0, 9) : [],
    goal: Array.isArray(s.goal) ? [...new Set(s.goal.filter(x => GOALS.has(x)))].slice(0, 5) : [],
    urgency: URGENCY.has(s.urgency) ? s.urgency : "unknown",
    vehicle_status: VEHICLES.has(s.vehicle_status) ? s.vehicle_status : "unknown",
    coverage_goal: COVERAGE.has(s.coverage_goal) ? s.coverage_goal : "unsure"
  };
}
function hypothetical(text) {
  // A message made only of questions ("How long do I need an SR-22?") states no personal facts.
  var sentences = text.split(/(?<=[.!?])\s+/).filter(function (x) { return x.trim(); });
  if (sentences.length && sentences.every(function (x) { return /\?\s*$/.test(x) || /^\s*(how|what|why|does|do|is|are|can|could|should|when|which|who|where)\b/i.test(x); })) return true;
  return /\b(what if|what happens if|if someone|suppose|hypothetically|for example|how does|what is|can someone)\b/i.test(text)
    && !/\b(i have|i had|i need|i live|i'm in|my car|my insurance)\b/i.test(text);
}
function buildIntelligence(confirmed, message) {
  const trusted = validatedConfirmed(confirmed);
  const text = typeof message === "string" ? message.slice(0, 600) : "";
  const candidate = hypothetical(text) ? validatedConfirmed({}) : processTurn({}, text).facts;
  // Candidates are unverified; never merge or store them automatically.
  const pending = validatedConfirmed(candidate);
  const hasCandidate = pending.state !== null || pending.situation.length > 0
    || pending.goal.length > 0 || pending.urgency !== "unknown";
  return {
    version: "2.0",
    confirmed: trusted,
    candidates: pending,
    requires_confirmation: hasCandidate,
    next: nextQuestion(trusted),
    buyer_routing: "not_in_advisor_engine"
  };
}
module.exports = { validatedConfirmed, hypothetical, buildIntelligence };
