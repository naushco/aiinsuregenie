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
  for (const pathname of ["/api/chat", "/api/leads", "/api/callback"]) {
    const res = await request(pathname, "OPTIONS");
    assert.equal(res.status, 200, pathname + ": " + await res.text());
  }
});

test("the compiled production Worker still serves geo route", async () => {
  const res = await request("/api/geo");
  assert.equal(res.status, 200);
  assert.equal((await res.json()).state, null);
});

test("unknown paths return an intentional 404", async () => {
  const res = await request("/api/unknown___");
  assert.equal(res.status, 404);
});
