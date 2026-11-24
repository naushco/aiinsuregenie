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
  await expect(page.getByRole("button", { name: "Confirm details and keep talking" })).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Confirm details and keep talking" })).toBeVisible();
  expect(messages[0]?.confirmed?.state || null).toBeNull();
  await page.getByRole("button", { name: "Confirm details and keep talking" }).click();
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

test("Genie 2.1 skips irrelevant car questions for a confirmed non-owner", async ({page}) => {
  await page.goto("/");
  await page.getByRole("button",{name:"I need an SR-22"}).click();
  await page.getByRole("button",{name:/Texas/}).first().click();
  await expect(page.getByText(/Do you own, finance, or lease a vehicle/)).toBeVisible();
  await page.getByRole("button",{name:"I need non-owner coverage"}).click();
  await expect(page.getByText("What coverage do you need?")).toBeVisible();
  await page.getByRole("button",{name:"I don't know"}).click();
  await expect(page.getByText("When do you need it to start?")).toBeVisible();
  await page.getByRole("button",{name:"Just comparing"}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("aig-chat-v2")||"null")?.s?.stage)).toBe("done");
  const saved=JSON.parse(await page.evaluate(()=>localStorage.getItem("aig-chat-v2")));
  expect(saved.s.st).toBe("TX");
  expect(saved.s.vehicleStatus).toBe("no_vehicle");
  expect(saved.s.make).toBe("");
  expect(saved.s.cov).toBe("unsure");
  expect(saved.s.when).toBe("compare");
  await page.reload();
  expect((await page.evaluate(()=>JSON.parse(localStorage.getItem("aig-chat-v2")))).s.vehicleStatus).toBe("no_vehicle");
});
test("Genie 2.1 permits interruption without forgetting qualification state", async ({page}) => {
  await page.goto("/");
  await page.getByRole("button",{name:"I need an SR-22"}).click();
  await page.getByRole("button",{name:/Texas/}).first().click();
  await expect(page.getByText(/Do you own, finance, or lease a vehicle/)).toBeVisible();
  await page.getByPlaceholder("Ask anything about car insurance").fill("What is non-owner insurance?");
  await page.getByRole("button",{name:"Send"}).click();
  await expect(page.getByText("Insurance rules vary by state. Ask about available options.")).toBeVisible();
  await page.getByRole("button",{name:"Continue my match"}).click();
  await expect(page.getByText(/Do you own, finance, or lease a vehicle/)).toBeVisible();
  expect((await page.evaluate(()=>JSON.parse(localStorage.getItem("aig-chat-v2")))).s.sits).toContain("sr22");
});

test("advisor-first conversation preserves multiple answers and never forces quote form",async({page})=>{
  await page.goto("/");
  await expect(page.getByRole("button",{name:"Get quote now"})).toBeVisible();
  await page.getByPlaceholder("Ask anything about car insurance").fill("What is an SR-22?");
  await page.getByRole("button",{name:"Send"}).click();
  await expect(page.getByText("Insurance rules vary by state. Ask about available options.")).toBeVisible();
  await page.getByPlaceholder("Ask anything about car insurance").fill("How does collision insurance work?");
  await page.getByRole("button",{name:"Send"}).click();
  await expect(page.getByText("What is an SR-22?")).toBeVisible();
  await expect(page.getByText("How does collision insurance work?")).toBeVisible();
  await expect(page.getByRole("button",{name:"I need non-owner coverage"})).toHaveCount(0);
  const stored=await page.evaluate(()=>localStorage.getItem("aig-chat-v2"));
  expect(stored||"").not.toContain("What is an SR-22?");
});
test("advisor confirms inferred details then reviews before quote questions",async({page})=>{
  await page.goto("/#start=guide&topic=coverage");
  await page.getByPlaceholder("Ask anything about car insurance").fill("I'm in Texas and need insurance this week.");
  await page.getByRole("button",{name:"Send"}).click();
  await expect(page.getByRole("button",{name:"Confirm details and keep talking"})).toBeVisible();
  await page.getByRole("button",{name:"Confirm details and keep talking"}).click();
  await expect(page.getByRole("button",{name:"Explore quotes whenever you're ready"})).toBeVisible();
  await page.getByRole("button",{name:"Explore quotes whenever you're ready"}).click();
  await expect(page.getByRole("region",{name:"Review your insurance profile"})).toBeVisible();
  await expect(page.getByRole("region",{name:"Review your insurance profile"}).getByText("Texas",{exact:true})).toBeVisible();
  await expect(page.getByText("Within a week")).toBeVisible();
  await page.getByRole("button",{name:"Continue with quote questions"}).click();
  await expect(page.getByText("Anything special about your situation?")).toBeVisible();
});
test("immediate get quote waits for review before displaying partner options",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:"Get quote now"}).click();
  // Fast quote entry should skip an empty profile review for paid visitors.
  await expect(page.getByRole("region",{name:"Review your insurance profile"})).toHaveCount(0);
  await expect(page.getByText("Which state do you live in?")).toBeVisible();
  await page.getByRole("button",{name:"Texas"}).click();
  await page.getByRole("button",{name:"Need an SR-22"}).click();
  await page.getByRole("button",{name:"Continue",exact:true}).click();
  await page.getByRole("button",{name:"I need non-owner coverage"}).click();
  await page.getByRole("button",{name:"I don't know"}).click();
  await page.getByRole("button",{name:"Just comparing"}).click();
  await expect(page.getByRole("region",{name:"Review your insurance profile"})).toBeVisible();
  await expect(page.getByRole("region",{name:"Review your insurance profile"}).getByText("Non-owner coverage",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Confirm and view quoting options"})).toBeVisible();
  await expect(page.locator(".mcard")).toHaveCount(0);
  await page.getByRole("button",{name:"Confirm and view quoting options"}).click();
  await expect(page.getByRole("region",{name:"Review your insurance profile"})).toHaveCount(0);
  expect((await page.evaluate(()=>JSON.parse(localStorage.getItem("aig-chat-v2")))).s.vehicleStatus).toBe("no_vehicle");
});
test("first-party campaign metadata survives quote -> advisor switch, without contact fields",async({page})=>{
  await page.goto("/?utm_source=meta&utm_campaign=SR22_2026&pub=aff12&fbclid=valid123&email=someone%40example.com");
  await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem("aig-attribution-v1"))).not.toBeNull();
  const initial=await page.evaluate(()=>JSON.parse(sessionStorage.getItem("aig-attribution-v1")));
  expect(initial.utm_source).toBe("meta");
  expect(initial.utm_campaign).toBe("SR22_2026");
  expect(initial.pub).toBe("aff12");
  expect(initial.fbclid).toBe("valid123");
  expect(initial).not.toHaveProperty("email");
  await page.getByRole("button",{name:"Get quote now"}).click();
  await page.getByRole("button",{name:"Ask Genie"}).click();
  await expect(page.getByPlaceholder("Ask anything about car insurance")).toBeVisible();
  await page.reload();
  const later=await page.evaluate(()=>JSON.parse(sessionStorage.getItem("aig-attribution-v1")));
  expect(later).toEqual(initial);
});
