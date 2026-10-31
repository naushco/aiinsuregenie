// Address of the AI InsureGenie API. No slash at the end.
// On Cloudflare test addresses (*.workers.dev) it uses the API's test address;
// everywhere else it uses https://api.aiinsuregenie.com.
(function () {
  var host = (typeof location !== "undefined" && location.hostname) || "";
  var apiBase = /\.workers\.dev$/.test(host)
    ? "https://aiinsuregenie-api.in-naushco.workers.dev"
    : "https://api.aiinsuregenie.com";
  window.AIG_CONFIG = { apiBase: apiBase };
})();
