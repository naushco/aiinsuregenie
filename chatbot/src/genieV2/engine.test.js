import test from "node:test";
import assert from "node:assert/strict";
import { initialAssessment, detectScenario, normalizeState, applyAnswer, nextQuestion, assessmentResult } from "./engine.js";

test("recognizes high-risk scenarios", () => {
  assert.equal(detectScenario("I had a DUI"), "dui");
  assert.equal(detectScenario("Need SR-22"), "sr22");
  assert.equal(detectScenario("I don't own a car"), "nonowner");
  assert.equal(detectScenario("My policy was cancelled"), "lapse");
});
test("normalizes state and rejects unsupported inputs", () => {
  assert.equal(normalizeState("Texas"), "TX");
  assert.equal(normalizeState("tx"), "TX");
  assert.equal(normalizeState("not a state"), null);
});
test("completes DUI assessment without requesting personal information", () => {
  let p = initialAssessment();
  for (const [id, answer] of [
    ["scenario","I got a DUI"],["state","Texas"],["ownsVehicle","No"],
    ["filingRequired","Not sure"],["currentlyInsured","No"],["timing","Today"]
  ]) {
    assert.equal(nextQuestion(p).id, id);
    const result = applyAnswer(p,id,answer);
    assert.equal(result.error,null);
    p = result.profile;
  }
  assert.equal(p.completed,true);
  assert.equal(assessmentResult(p).routeStatus,"pending_verified_partner");
  assert.equal(assessmentResult(p).needsFilingVerification,true);
});
test("invalid answers do not mutate state", () => {
  const p = initialAssessment();
  const r = applyAnswer(p,"state","Atlantis");
  assert.ok(r.error);
  assert.deepEqual(r.profile,p);
});
