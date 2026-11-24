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
  // Public Genie 2.0 rollout explicitly approved by the site owner.
  // Retain operator-controlled configuration (no URL parameter, cookie or
  // localStorage overrides). Revert this switch to false for immediate
  // frontend rollback without affecting SEO routes or TrustedForm.
  window.AIG_CONFIG = { apiBase: apiBase, staging: staging, genieV2Enabled: true };
})();
