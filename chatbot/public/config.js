// API routing for the AI InsureGenie chatbot.
// Staging is intentionally fail-closed until a separately provisioned API and D1
// are connected. Never route staging or local browser tests to the production API.
(function () {
  var host = (typeof location !== "undefined" && location.hostname) || "";
  var staging = /(^|[.-])staging([.-]|$)|(^|[.-])preview([.-]|$)|^localhost$|^127\.0\.0\.1$/.test(host)
    || /^aiinsuregenie-chat-staging\./.test(host);
  var stagingApi = /^aiinsuregenie-chat-staging\.in-naushco\.workers\.dev$/.test(host)
    ? "https://aiinsuregenie-api-staging.in-naushco.workers.dev"
    : (typeof location !== "undefined" ? location.origin : "");
  var apiBase = staging
    ? (window.AIG_STAGING_API_BASE || stagingApi)
    : (/\.workers\.dev$/.test(host)
      ? "https://aiinsuregenie-api.in-naushco.workers.dev"
      : "https://api.aiinsuregenie.com");
  // Production rollout is disabled. Only an operator deployment edit may enable
  // Genie 2.0; URL parameters, cookies, and localStorage cannot turn it on.
  // Staging remains enabled for isolated preview tests.
  window.AIG_CONFIG = { apiBase: apiBase, staging: staging, genieV2Enabled: staging };
})();
