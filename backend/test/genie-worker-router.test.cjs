// Run against the ACTUAL wrangler-bundled Worker, not just handler mocks.
// Read-only or OPTIONS requests; no D1, secrets, partner calls, or external network.
const test = require("node:test");
const assert = require("node:assert/strict");
// This suite runs against wrangler dev --local (local D1 only), not production.
async function request(pathname, method = "GET") {
  return fetch("http://127.0.0.1:8799" + pathname, {
    method,
    headers: { Origin: "https://chat.aiinsuregenie.com" }
  });
}

test("the compiled production Worker resolves health and root routes", async () => {
  for (const pathname of ["/", "/api/health"]) {
    const res = await request(pathname);
    assert.equal(res.status, 200, pathname + ": " + await res.text());
  }
});

test("the compiled production Worker resolves safe preflight routes", async () => {
  for (const pathname of ["/api/chat", "/api/plan", "/api/leads", "/api/callback"]) {
    const res = await request(pathname, "OPTIONS");
    assert.equal(res.status, 200, pathname + ": " + await res.text());
  }
});

test("the compiled production Worker still serves geo route", async () => {
  const res = await request("/api/geo");
  assert.equal(res.status, 200);
  const state = (await res.json()).state;
  assert.ok(state === null || /^[A-Z]{2}$/.test(state)); // Wrangler may provide a local US location
});

test("unknown paths return an intentional 404", async () => {
  const res = await request("/api/unknown___");
  assert.equal(res.status, 404);
});

test("compiled Worker does not expose Genie planning when operator flag absent", async () => {
  const res = await fetch("http://127.0.0.1:8799/api/plan", {
    method:"POST", headers:{"Content-Type":"application/json",Origin:"https://chat.aiinsuregenie.com"},
    body:JSON.stringify({genie_v2:true,genie_facts:{state:"TX",situation_confirmed:true,vehicle_status:"no_vehicle"}})
  });
  assert.equal(res.status,404);
});
