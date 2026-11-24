const { test, expect } = require("@playwright/test");

// Browser-level smoke tests never send any leads to ActiveProspect or real buyers.
test.beforeEach(async ({ page }) => {
  // CI exercises the gated Genie 2.0 interface without changing the checked-in
  // operator flag. The public production configuration remains disabled.
  await page.route("**/config.js", async route => {
    const response = await route.fetch();
    const body = (await response.text()) + "\nwindow.AIG_CONFIG.genieV2Enabled = true;\n";
    await route.fulfill({ response, body });
  });
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

test("guide statements require confirmation and can be corrected", async ({ page }) => {
  await page.goto("/#start=guide&topic=coverage");
  await page.getByPlaceholder("Ask anything about car insurance").fill("I'm in Texas and need insurance this week.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("button", { name: "Confirm details and continue" })).toBeVisible();
  const pending = await page.evaluate(() => JSON.parse(localStorage.getItem("aig-chat-v2") || "null"));
  expect(pending?.s?.st || "").not.toBe("TX");
  await page.getByRole("button", { name: "Correct these details" }).click();
  const corrected = await page.evaluate(() => JSON.parse(localStorage.getItem("aig-chat-v2") || "null"));
  expect(corrected?.s?.st || "").not.toBe("TX");
});

test("privacy opt-out clears stored quote progress", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I need an SR-22" }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("aig-chat-v2"))).not.toBeNull();
  await page.evaluate(() => localStorage.setItem("aig-dns", "1"));
  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("aig-chat-v2"))).toBeNull();
});

test("staging brain receives only confirmed facts, never unapproved candidates", async ({ page }) => {
  const messages = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/api/chat") messages.push(request.postDataJSON());
  });
  await page.goto("/#start=guide&topic=coverage");
  await page.getByPlaceholder("Ask anything about car insurance").fill("I'm in Texas and need insurance this week.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("button", { name: "Confirm details and continue" })).toBeVisible();
  expect(messages[0]?.confirmed?.state || null).toBeNull();
  await page.getByRole("button", { name: "Confirm details and continue" }).click();
  // The quote stage briefly shows a typing transition. Do not submit into that pause.
  await page.waitForTimeout(700);
  await page.getByPlaceholder("Ask anything about car insurance").fill("Why might insurance cost more for drivers who park outside?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect.poll(() => messages.length, { timeout: 10000 }).toBe(2);
  expect(messages[1].confirmed.state).toBe("TX");
  expect(messages[1].confirmed.urgency).toBe("within_week");
});

test("without operator flag, actual legacy chatbot loads instead of Genie 2.0", async ({ page }) => {
  await page.unroute("**/config.js");
  await page.route("**/config.js", async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()) + "\nwindow.AIG_CONFIG.genieV2Enabled = false;\n" });
  });
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => window.AIG_CONFIG?.genieV2Enabled)).toBe(false);
  await expect(page.getByPlaceholder("Ask anything about car insurance")).toBeVisible();
  const scripts = await page.locator("script[src]").evaluateAll(elements => elements.map(e => e.src));
  expect(scripts.some(url => url.includes("config.js"))).toBe(true);
  // The page offers no client-side flag override from query parameters.
  await page.goto("/?genie_v2=1#start=guide&topic=coverage");
  expect(await page.evaluate(() => window.AIG_CONFIG?.genieV2Enabled)).toBe(false);
});
