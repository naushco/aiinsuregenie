// Runs only against the compiled, isolated staging Worker. Never contacts a buyer.
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const content = fs.readFileSync(path.resolve(__dirname, "../dist/staging-worker.js"), "utf8");
const workerPromise = import("data:text/javascript;base64," + Buffer.from(content).toString("base64")).then(mod => mod.default);
const origin = "https://aiinsuregenie-chat-staging.in-naushco.workers.dev";
async function run(route, method = "GET", body) {
  const worker = await workerPromise;
  const req = new Request("https://aiinsuregenie-api-staging.in-naushco.workers.dev" + route, {
    method, headers: { Origin: origin, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const res = await worker.fetch(req);
  return { status: res.status, data: await res.json(), headers: res.headers };
}
test("staging API is isolated from production resources", async () => {
  const r = await run("/_health");
  assert.equal(r.status, 200);
  assert.equal(r.data.d1, false);
  assert.equal(r.data.secrets, false);
  assert.equal(r.data.live_buyers, false);
  assert.equal(r.data.lead_persistence, false);
});
test("hypothetical risk remains unconfirmed", async () => {
  const r = await run("/api/chat", "POST", { message: "What happens if someone gets a DUI?" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.genie_v2.candidates.situation, []);
  assert.equal(r.data.genie_v2.confirmed.state, null);
});
test("personal situation is a candidate, not a confirmed fact", async () => {
  const r = await run("/api/chat", "POST", { message: "I'm in Texas and I need an SR-22 this week" });
  assert.equal(r.status, 200);
  assert.equal(r.data.genie_v2.candidates.state, "TX");
  assert.ok(r.data.genie_v2.candidates.situation.includes("sr22"));
  assert.equal(r.data.genie_v2.confirmed.state, null);
  assert.equal(r.data.genie_v2.requires_confirmation, true);
});
test("synthetic consent handoff maps evidence but never delivers a lead", async () => {
  const fixture = {
    fixture: "SYNTHETIC_ONLY", consent_opt_in: true,
    consent_text: "Synthetic permission for a staging-only test.",
    consent_timestamp: "2026-11-24T08:00:00.000Z",
    trustedform_cert_url: "https://cert.trustedform.com/SYNTHETIC123"
  };
  const good = await run("/__test/consent-handoff", "POST", fixture);
  assert.equal(good.status, 200);
  assert.equal(good.data.simulated_only, true);
  assert.equal(good.data.buyer_delivery, false);
  assert.equal(good.data.database_writes, false);
  const missing = await run("/__test/consent-handoff", "POST", { ...fixture, consent_opt_in: false });
  assert.equal(missing.status, 422);
  const pii = await run("/__test/consent-handoff", "POST", { ...fixture, email: "nobody@example.invalid" });
  assert.equal(pii.status, 400);
});
test("all real lead endpoints are blocked", async () => {
  for (const url of ["/api/leads", "/api/callback", "/api/subscribe"]) {
    const r = await run(url, "POST", {});
    assert.equal(r.status, 403);
  }
});

test("mock partner rules route qualifying situations without sending a lead", async () => {
  const base = { fixture: "SYNTHETIC_ONLY", state: "TX", situation: "sr22", demo_buyers: [
    { id: "DEMO_GENERAL", states: ["TX", "CA"], situations: ["accident"] },
    { id: "DEMO_SPECIALTY", states: ["TX", "FL"], situations: ["sr22", "dui"] }
  ] };
  const matched = await run("/__test/partner-route", "POST", base);
  assert.equal(matched.status, 200);
  assert.deepEqual(matched.data.eligible_demo_buyers, ["DEMO_SPECIALTY"]);
  assert.equal(matched.data.buyer_delivery, false);
  assert.equal(matched.data.eligible_for_real_insurance, null);
  const unmatched = await run("/__test/partner-route", "POST", { ...base, state: "CA" });
  assert.equal(unmatched.status, 200);
  assert.equal(unmatched.data.recommended_demo_buyer, null);
  const rejected = await run("/__test/partner-route", "POST", { ...base, phone: "5555555555" });
  assert.equal(rejected.status, 400);
  const realBuyer = await run("/__test/partner-route", "POST", { ...base, demo_buyers: [{ id: "REAL_CARRIER", states: ["TX"], situations: ["sr22"] }] });
  assert.equal(realBuyer.status, 400);
});
