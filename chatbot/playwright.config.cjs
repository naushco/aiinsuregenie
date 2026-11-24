const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  use: { baseURL: "http://127.0.0.1:4173", browserName: "chromium" },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 60000
  }
});
