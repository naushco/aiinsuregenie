"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildIntelligence } = require("../lib/genie-runtime.js");
const fs = require("node:fs");
const path = require("node:path");

test("no implicit promotion of candidate facts to confirmed facts", () => {
  const out = buildIntelligence({}, "I'm in Texas and need an SR-22 this week");
  assert.equal(out.confirmed.state, null);
  assert.equal(out.candidates.state, "TX");
  assert.ok(out.candidates.situation.includes("sr22"));
  assert.equal(out.candidates.urgency, "within_week");
  assert.equal(out.next.field, "state");
  assert.equal(out.requires_confirmation, true);
});
test("hypothetical insurance questions do not become visitor history", () => {
  const out = buildIntelligence({}, "What happens if someone gets a DUI in Florida?");
  assert.equal(out.candidates.state, null);
  assert.deepEqual(out.candidates.situation, []);
  assert.equal(out.requires_confirmation, false);
});
test("confirmed facts retain state, risk and timing, with a deterministic missing question", () => {
  const out = buildIntelligence({ state:"TX", situation:["sr22"], urgency:"within_week", coverage_goal:"minimum" }, "What is a deductible?");
  assert.equal(out.confirmed.state, "TX");
  assert.equal(out.confirmed.urgency, "within_week");
  assert.deepEqual(out.confirmed.situation, ["sr22"]);
  assert.equal(out.next.field, "vehicle_status");
  assert.equal(out.candidates.state, null);
  assert.equal(out.requires_confirmation, false);
});
test("reject unknown fields, invalid codes and raw PII", () => {
  const out = buildIntelligence({ state:"Texas", situation:["sr22","fake"], urgency:"tomorrow", email:"private@example.com", phone:"5550000000" }, "");
  assert.equal(out.confirmed.state, null);
  assert.deepEqual(out.confirmed.situation, ["sr22"]);
  assert.equal(out.confirmed.urgency, "unknown");
  assert.doesNotMatch(JSON.stringify(out), /private@example.com|5550000000/);
});
test("production UI deploys the exact original legacy implementation", () => {
  const original = fs.readFileSync(path.resolve(__dirname, "../../chatbot/src/LegacyApp.jsx"), "utf8");
  const expected = "889a8ea2103fdcfa81339956c11d23992c242127";
  // Original deployment's Git blob hash (Git SHA-1 includes a 'blob <length>\\0' prefix).
  const crypto = require("node:crypto");
  const blob = crypto.createHash("sha1").update("blob " + Buffer.byteLength(original) + "\0" + original).digest("hex");
  assert.equal(blob, expected);
});
