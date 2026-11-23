// Development-only Genie 2.0 conversation adapter.
// Not wired to any public route, chatbot or D1 storage.
"use strict";
const { extractIntent } = require("./genie-intent");
const { nextQuestion } = require("./genie-planner");
const SITUATIONS = new Set(["coverage_lapse","sr22","fr44","dui","ticket","accident","non_owner","rideshare","new_driver"]);
function mergeUnique(existing, incoming) { return [...new Set([...(Array.isArray(existing)?existing:[]), ...incoming])]; }
function processTurn(previous, message, options) {
  const old = previous && typeof previous === "object" ? previous : {};
  const parsed = extractIntent(message);
  const facts = {
    state: old.state || parsed.state || null,
    situation: mergeUnique(old.situation, parsed.situation.filter(x=>SITUATIONS.has(x))),
    goal: mergeUnique(old.goal, parsed.goal),
    obstacle: mergeUnique(old.obstacle, parsed.obstacle),
    urgency: old.urgency && old.urgency !== "unknown" ? old.urgency : parsed.urgency,
    vehicle_status: old.vehicle_status || "unknown",
    coverage_goal: old.coverage_goal || "unsure"
  };
  // Explicit selections and corrections must be validated by the caller before merging.
  const next = nextQuestion(facts, options);
  return { version: parsed.version, facts, next, intelligence: { situation: facts.situation, goal: facts.goal, obstacle: facts.obstacle, urgency: facts.urgency, state: facts.state } };
}
module.exports = { processTurn };
