const { test, expect } = require("@playwright/test");

// Browser-level smoke tests never send any leads to ActiveProspect or real buyers.
test.beforeEach(async ({ page }) => {
  await page.route(/trustedform\.com/, route => route.abort());
  await page.route(/\/api\//, route => {
    const url = new URL(route.request().url());
    // Forbid production and existing Worker API calls during local preview tests.
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      throw Error("Preview attempted to reach a remote API: " + url.origin);
    }
    if (url.pathname === "/api/partners") return route.fulfill({ json: { partners: [] } });
    if (url.pathname === "/api/chat") return route.fulfill({ json: { answer: "Insurance rules vary by state. Ask about available options." } });
    if (url.pathname === "/api/geo") return route.fulfill({ json: {} });
    return route.fulfill({ status: 204, body: "" });
  });
});

test("local preview never points at production API and retains TrustedForm field", async ({ page }) => {
  await page.goto("/");
  const config = await page.evaluate(() => window.AIG_CONFIG);
  expect(config.staging).toBe(true);
  expect(config.apiBase).toBe("http://127.0.0.1:4173");
  await expect(page.locator("#xxTrustedFormCertUrl")).toHaveCount(1);
  await expect(page.getByPlaceholder("Ask anything about car insurance")).toBeVisible();
});

test("hypothetical advisor question is not saved as personal driver history", async ({ page }) => {
  await page.goto("/#start=guide&topic=sr22");
  await page.getByPlaceholder("Ask anything about car insurance").fill("What happens if someone gets a DUI?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Insurance rules vary by state. Ask about available options.")).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem("aig-chat-v2"));
  if (saved) {
    const state = JSON.parse(saved).s;
    expect(state.sits || []).not.toContain("dui");
    expect(saved).not.toContain("What happens if someone gets a DUI?");
  }
});

test("quote progression is saved with structured facts only", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I need an SR-22" }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("aig-chat-v2"))).not.toBeNull();
  const stored = JSON.parse(await page.evaluate(() => localStorage.getItem("aig-chat-v2")));
  expect(stored.s.sits).toContain("sr22");
  for (const key of ["hist", "said", "qa", "note", "results"]) expect(stored.s).not.toHaveProperty(key);
  await page.reload();
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem("aig-chat-v2")).s)).sits).toContain("sr22");
});
