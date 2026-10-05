// lib/kv.js: tiny client for the Upstash Redis REST API (what Vercel's Storage tab creates).
// No npm packages needed. Works with either pair of variable names Vercel/Upstash may set.

function conf() {
  var url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  var token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token: token } : null;
}

exports.kvConfigured = function () { return !!conf(); };

// Run one Redis command, e.g. kv(["GET", "key"]) or kv(["SET", "key", "value", "EX", "60"])
exports.kv = async function (cmd) {
  var c = conf();
  if (!c) throw new Error("Storage is not configured");
  var r = await fetch(c.url, {
    method: "POST",
    headers: { Authorization: "Bearer " + c.token, "Content-Type": "application/json" },
    body: JSON.stringify(cmd)
  });
  var j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || "Storage error " + r.status);
  return j.result;
};
