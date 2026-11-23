// Genie 2.0: deterministic, privacy-conscious intent extraction.
// This module does not store raw text or personal information.
// Extracted values are candidate user statements, NOT verified eligibility facts.
"use strict";

const TAXONOMY_VERSION = "1.0.0";
const RULES = {
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

const STATES = { texas: "TX", california: "CA", florida: "FL" };
function extractIntent(input) {
  if (typeof input !== "string") return { version: TAXONOMY_VERSION, situation: [], goal: [], obstacle: [], urgency: "unknown", state: null };
  // Bound processing and discard input immediately after extracting codes.
  const text = input.slice(0, 4000);
  const result = { version: TAXONOMY_VERSION, situation: [], goal: [], obstacle: [], urgency: "unknown", state: null };
  for (const [category, rules] of Object.entries(RULES)) {
    for (const [code, pattern] of Object.entries(rules)) if (pattern.test(text)) result[category].push(code);
  }
  if (/\b(today|right now|immediately|asap|tonight)\b/i.test(text)) result.urgency = "today";
  else if (/\b(this week|next few days|within (?:a )?week)\b/i.test(text)) result.urgency = "within_week";
  else if (/\b(next month|later|just researching|not yet)\b/i.test(text)) result.urgency = "later";
  for (const [name, code] of Object.entries(STATES)) {
    if (new RegExp("\\b" + name + "\\b", "i").test(text)) { result.state = code; break; }
  }
  return result;
}
module.exports = { TAXONOMY_VERSION, extractIntent };
