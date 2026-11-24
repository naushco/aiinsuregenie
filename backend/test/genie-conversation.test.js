"use strict";
const assert=require("node:assert/strict");
const {test}=require("node:test");
const {processTurn}=require("../lib/genie-conversation");
test("free-text candidate facts never imply confirmed situation completion",()=>{
  const a=processTurn({},"My insurance expired in Texas. Need cheap coverage.");
  assert.equal(a.facts.state,"TX");
  assert.ok(a.facts.situation.includes("coverage_lapse"));
  assert.ok(a.facts.goal.includes("lower_price"));
  assert.equal(a.next.field,"vehicle_status");
});
test("new turn remembers only structured candidates, not literal messages",()=>{
  const first=processTurn({},"My insurance expired in Texas");
  const second=processTurn(first.facts,"I need coverage today");
  assert.ok(second.facts.situation.includes("coverage_lapse"));
  assert.equal(second.facts.urgency,"today");
  assert.equal(second.next.field,"vehicle_status");
});
test("removes name and telephone from extracted result",()=>{
  const result=processTurn({},"I am John, call 512-555-1234. Need SR22 in Texas.");
  const output=JSON.stringify(result);
  assert.doesNotMatch(output,/John|512-555-1234/);
});
test("ordinary driver is not silently classified as clean record",()=>{
  const result=processTurn({},"I need affordable insurance in Texas today");
  assert.equal(result.facts.state,"TX");
  assert.deepEqual(result.facts.situation,[]);
  assert.equal(result.next.field,"situation");
});
test("later explicit state and urgency statements correct earlier candidates",()=>{
  const first=processTurn({},"I need insurance in Texas today");
  const corrected=processTurn(first.facts,"Actually I live in Florida and need it next month");
  assert.equal(corrected.facts.state,"FL");
  assert.equal(corrected.facts.urgency,"later");
});
