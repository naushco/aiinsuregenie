const test = require("node:test");
const assert = require("node:assert");
const ins = require("../lib/insights.js");

test("topic labels, never raw text", () => {
  assert.equal(ins.topicOf("How long do I need an SR-22 in Ohio?"), "sr22_duration");
  assert.equal(ins.topicOf("how much does sr22 cost"), "sr22_cost");
  assert.equal(ins.topicOf("I don't own a car, can I get insurance?"), "non_owner");
  assert.equal(ins.topicOf("Do I need full coverage?"), "full_coverage");
  assert.equal(ins.topicOf("will my rental be covered"), "rental");
  assert.equal(ins.topicOf("hello there"), "other");
});

test("answered flag detects deferrals", () => {
  assert.equal(ins.answeredOf("SR-22 is usually 3 years."), 1);
  assert.equal(ins.answeredOf("I'm not sure about that; contact your state DMV."), 0);
  assert.equal(ins.answeredOf(""), 0);
});

test("clean drops unknown or personal values", () => {
  const c = ins.clean({ st: "OH", sits: ["sr22", "x", "new"], vs: "financed", when: "today", cov: "full", name: "John", phone: "5551234567" });
  assert.deepEqual(c, { state: "OH", situations: "new,sr22", vehicle_status: "financed", start_when: "today", coverage: "full" });
  assert.deepEqual(ins.clean({ st: "ohio", vs: "boat" }), { state: null, situations: null, vehicle_status: null, start_when: null, coverage: null });
});

// Minimal fake D1 to check storage wiring and the 50+ threshold.
function fakeD1() {
  const rows = { s: {}, q: [] };
  const stmt = (sql) => ({ sql, args: [], bind(...a) { this.args = a; return this; },
    async run() {
      if (/INSERT INTO session_insights \(session_id, day, state/.test(sql)) {
        const [id, day, state, situations, vs, when, cov, lang, source, journey, partner, m, nm, cl, call] = this.args;
        const r = rows.s[id] || { session_id: id, day, questions: 0, matched: 0, no_match: 0, clicked: 0, call_request: 0 };
        Object.assign(r, Object.fromEntries(Object.entries({ state, situations, vehicle_status: vs, start_when: when, coverage: cov, lang, journey, matched_partner: partner }).filter(([, v]) => v != null)));
        if (!r.source && source) r.source = source;
        r.matched = Math.max(r.matched, m); r.clicked = Math.max(r.clicked, cl);
        rows.s[id] = r;
      } else if (/INSERT INTO question_topics/.test(sql)) rows.q.push(this.args);
      return {};
    }, async all() { return { results: [] }; } });
  return { rows, prepare: stmt, async batch() { return []; } };
}

test("records session with no PII and merges events", async () => {
  const d = fakeD1(); globalThis.__AIG_D1 = d;
  await ins.recordSession("sabc1234", { st: "TX", sits: ["sr22"], vs: "owned", phone: "555" }, { type: "match_shown", lang: "en", source: "meta", partner_id: "p1" });
  await ins.recordSession("sabc1234", { st: "TX" }, { type: "partner_click" });
  const r = d.rows.s.sabc1234;
  assert.equal(r.state, "TX"); assert.equal(r.situations, "sr22"); assert.equal(r.clicked, 1); assert.equal(r.matched, 1);
  assert.ok(!JSON.stringify(r).includes("555"));
  await ins.recordQuestion("sabc1234", "How long is SR-22 in Texas?", "Usually 2 years.", { state: "TX" });
  assert.equal(d.rows.q[0][3], "sr22_duration");
  assert.ok(!JSON.stringify(d.rows.q).includes("Texas?"));
  delete globalThis.__AIG_D1;
});
