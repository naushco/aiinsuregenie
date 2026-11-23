"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { nextQuestion } = require("../lib/genie-planner");

test("asks state first if no facts", () => assert.equal(nextQuestion({}).field, "state"));
test("skips already known state and situation", () => {
  const q = nextQuestion({ state: "TX", situation: ["coverage_lapse"] });
  assert.equal(q.field, "urgency");
});
test("requires explicit urgency rather than treating unknown as complete", () => {
  assert.equal(nextQuestion({state:"TX",situation:["sr22"],urgency:"unknown"}).field,"urgency");
});
test("buyer-specific required fields", () => {
  assert.equal(nextQuestion({state:"TX"},{required:["state","coverage_goal"]}).field,"coverage_goal");
});
test("returns complete when required fields exist", () => {
  assert.equal(nextQuestion({state:"TX",situation:["sr22"],urgency:"today",vehicle_status:"owned",coverage_goal:"minimum"}).complete,true);
});
