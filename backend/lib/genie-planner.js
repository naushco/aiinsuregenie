// Genie 2.0 deterministic question planner. No network calls, storage or PII logging.
"use strict";
const FIELD_ORDER = ["state", "situation", "vehicle_status", "coverage_goal", "urgency"];
const DEFAULT_REQUIRED = ["state", "situation", "urgency", "vehicle_status", "coverage_goal"];
const QUESTIONS = {
  state: "Which US state do you need auto insurance in?",
  situation: "Is there anything about your driving or insurance history we should account for?",
  urgency: "When do you need coverage to start?",
  vehicle_status: "Do you own, finance, or lease a vehicle, or need non-owner coverage?",
  coverage_goal: "Are you looking for minimum required coverage, broader coverage, or are you unsure?"
};
const ALLOWED = {
  urgency: ["today", "within_week", "later", "unknown"],
  vehicle_status: ["owned", "financed", "leased", "no_vehicle", "unknown"],
  coverage_goal: ["minimum", "full", "unsure"]
};
function isPresent(field, value, facts) {
  if (value === null || value === undefined || value === "") return false;
  if (field === "situation") return (facts && facts.situation_confirmed === true) || (Array.isArray(value) && value.length > 0);
  if (field === "state") return typeof value === "string" && /^[A-Z]{2}$/.test(value);
  if (field === "coverage_goal") return (facts && facts.coverage_goal_confirmed === true) || value === "minimum" || value === "full";
  if (ALLOWED[field]) return ALLOWED[field].includes(value) && value !== "unknown";
  return false;
}
function nextQuestion(facts, options) {
  const f = facts && typeof facts === "object" ? facts : {};
  const required = options && Array.isArray(options.required) ? options.required.filter(x => FIELD_ORDER.includes(x)) : DEFAULT_REQUIRED;
  for (const field of FIELD_ORDER) {
    if (required.includes(field) && !isPresent(field, f[field], f)) return { field, text: QUESTIONS[field], complete: false };
  }
  return { field: null, text: null, complete: true };
}
module.exports = { FIELD_ORDER, QUESTIONS, isPresent, nextQuestion };
