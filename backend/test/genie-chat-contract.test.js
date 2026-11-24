// Regression checks for critical Genie advisor-to-quote invariants.
// These protect against inadvertent changes; they do not replace browser E2E tests.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.resolve(__dirname, "../../chatbot/src/App.jsx"), "utf8");

test("unconfirmed question facts remain pending until confirmation", () => {
  assert.match(app, /qa\.candidate = merge/);
  assert.match(app, /var confirmed = cur\.qa && cur\.qa\.candidate/);
  assert.match(app, /onClick=\{rejectCandidate\}/);
  assert.match(app, /Object\.keys\(confirmed\)\.length \? nextStage\(merged\)/);
});
test("advisor does not assume SR-22 equals DUI or assign imaginary age", () => {
  assert.match(app, /p\.driving = sits\.indexOf\("dui"\)/);
  assert.match(app, /p\.requiresSR22 = sits\.indexOf\("sr22"\)/);
  assert.doesNotMatch(app, /p\.age\s*=\s*22/);
  assert.doesNotMatch(app, /p\.vehicleYear\s*=\s*"2012"/);
});
test("resume storage is limited to confirmed fields and respects opt-out", () => {
  const start = app.indexOf("// Only confirmed qualification fields are persisted.");
  const end = app.indexOf("setResumeCookie(s);", start);
  assert.ok(start > 0 && end > start);
  const storage = app.slice(start, end);
  for (const field of ["stage", "st", "sits", "sitDone", "make", "model", "year", "cov", "when", "pri", "carAge"]) assert.match(storage, new RegExp("\\b" + field + ": s\\." + field + "\\b"));
  for (const field of ["hist", "said", "note", "qa", "results", "email", "phone"]) assert.doesNotMatch(storage, new RegExp("\\b" + field + ":"));
  assert.match(storage, /if \(DO_NOT_SELL\)/);
  assert.match(storage, /localStorage\.removeItem\(SAVE_KEY\)/);
});
test("no heuristic premium is presented as carrier quote", () => {
  const start = app.indexOf("function calcPremium(ins, p)");
  const end = app.indexOf("function matchInsurers(", start);
  assert.ok(start > 0 && end > start);
  assert.match(app.slice(start,end), /return null/);
  assert.doesNotMatch(app.slice(start,end), /return Math\.round/);
});
