// API routing for the AI InsureGenie chatbot.
// Staging is intentionally fail-closed until a separately provisioned API and D1
// are connected. Never route staging or local browser tests to the production API.
(function () {
  var host = (typeof location !== "undefined" && location.hostname) || "";
  var staging = /(^|[.-])staging([.-]|$)|(^|[.-])preview([.-]|$)|^localhost$|^127\.0\.0\.1$/.test(host)
    || /^aiinsuregenie-chat-staging\./.test(host);
  var apiBase = staging
    ? (window.AIG_STAGING_API_BASE || (typeof location !== "undefined" ? location.origin : ""))
    : (/\.workers\.dev$/.test(host)
      ? "https://aiinsuregenie-api.in-naushco.workers.dev"
      : "https://api.aiinsuregenie.com");
  window.AIG_CONFIG = { apiBase: apiBase, staging: staging };
})();
