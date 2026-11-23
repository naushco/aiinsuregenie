"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { processTurn } = require("../lib/genie-conversation");

test("free text supplies known facts and selects next missing question", () => {
  const result = processTurn({}, "My insurance expired in Texas. Need cheap coverage.");
  assert.equal(result.facts.state, "TX");
  assert.ok(result.facts.situation.includes("coverage_lapse"));
  assert.ok(result.facts.goal.includes("lower_price"));
  assert.equal(result.next.field, "urgency");
});

test("subsequent turn preserves earlier intent", () => {
  const first = processTurn({}, "My insurance expired in Texas");
  const second = processTurn(first.facts, "I need coverage today");
  assert.ok(second.facts.situation.includes("coverage_lapse"));
  assert.equal(second.facts.urgency, "today");
  assert.equal(second.next.field, "vehicle_status");
});

test("does not include raw user message or contact data", () => {
  const result = processTurn({}, "I am John, call 512-555-1234. Need SR22 in Texas.");
  const output = JSON.stringify(result);
  assert.ok(!output.includes("John"));
  assert.ok(!output.includes("512-555-1234"));
});
