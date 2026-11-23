"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { extractIntent } = require("../lib/genie-intent");

test("coverage lapse and affordable coverage in Texas", () => {
  const x = extractIntent("My insurance expired two months ago and I need cheap coverage in Texas.");
  assert.deepEqual(x.situation, ["coverage_lapse"]);
  assert.deepEqual(x.goal, ["lower_price"]);
  assert.equal(x.state, "TX");
  assert.equal(x.urgency, "unknown");
});

test("SR-22 filing and urgent coverage", () => {
  const x = extractIntent("I need SR-22 insurance today after a DUI in Florida");
  assert.ok(x.situation.includes("sr22"));
  assert.ok(x.situation.includes("dui"));
  assert.ok(x.goal.includes("filing_help"));
  assert.equal(x.urgency, "today");
  assert.equal(x.state, "FL");
});

test("rideshare and rejected coverage", () => {
  const x = extractIntent("I drive for Uber and was denied insurance");
  assert.ok(x.situation.includes("rideshare"));
  assert.ok(x.obstacle.includes("denied"));
});

test("does not include raw text or PII in extraction", () => {
  const x = extractIntent("My phone is 512-555-1234, email me@example.com. Need cheap coverage.");
  assert.ok(x.goal.includes("lower_price"));
  assert.ok(!JSON.stringify(x).includes("512-555-1234"));
  assert.ok(!JSON.stringify(x).includes("me@example.com"));
});

test("handles invalid input without throwing", () => {
  assert.deepEqual(extractIntent(null).situation, []);
});
