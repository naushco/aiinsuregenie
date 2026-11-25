"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildIntelligence } = require("../lib/genie-runtime.js");
const { FACTS, factsBlock } = require("../lib/facts.js");

test("every event the chatbot sends is accepted by /api/event", () => {
  const app = fs.readFileSync(path.join(__dirname, "../../chatbot/src/App.jsx"), "utf8");
  const sent = [...new Set([...app.matchAll(/track\("([a-z_]+)"/g)].map(m => m[1]))];
  const api = fs.readFileSync(path.join(__dirname, "../api/event.js"), "utf8");
  const types = api.slice(api.indexOf("var TYPES"), api.indexOf("];", api.indexOf("var TYPES")));
  for (const t of sent) assert.ok(types.includes('"' + t + '"'), "event.js rejects " + t);
});

test("a question is never turned into a candidate fact", () => {
  const r = buildIntelligence({}, "How long do I need an SR-22 in Texas?");
  assert.equal(r.requires_confirmation, false);
  assert.deepEqual(r.candidates.situation, []);
});

test("checked facts carry the corrected SR-22 rules", () => {
  const all = FACTS.join(" ");
  assert.match(all, /Texas 2 years/);
  assert.match(all, /\$15 to \$50/);
  assert.match(all, /NOT free/);
  assert.match(factsBlock(), /Never contradict/);
});

test("3.1 high-impact rules and new vocabulary", () => {
  const { RULES } = require("../lib/facts.js");
  const all = RULES.join(" ");
  assert.match(all, /OHIO SR-22/); assert.match(all, /HOUSEHOLD/); assert.match(all, /RENTAL CARS/);
  assert.match(all, /insurance\.ky\.gov/); assert.match(all, /LATEST DETAILS/);
  const r = buildIntelligence({ vehicle_status: "buying", urgency: "within_week" }, "");
  assert.ok(r);
});
