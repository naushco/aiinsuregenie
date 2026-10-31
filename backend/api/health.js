// api/health.js: open this URL in a browser to see what is and isn't set up. Never shows secret values.
const { kvConfigured, upstashConfigured } = require("../lib/kv");
const { migrationStatus } = require("../lib/migrate");
const { cors } = require("../lib/http");

module.exports = async function handler(req, res) {
  cors(req, res, "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  var onCloudflare = !!globalThis.__AIG_D1;
  var copied = null;
  if (onCloudflare) { try { copied = await migrationStatus(globalThis.__AIG_D1); } catch (e) { copied = null; } }
  res.status(200).json({
    status: "ok",
    service: "AI InsureGenie API",
    host: onCloudflare ? "cloudflare" : "vercel",
    setup: {
      storage_connected: kvConfigured(),
      storage: onCloudflare ? "cloudflare-d1" : (upstashConfigured() ? "upstash" : "none"),
      old_data_copied_at: onCloudflare ? copied : undefined,
      admin_password_set: !!process.env.ADMIN_PASSWORD,
      ai_chat_key_set: !!process.env.ANTHROPIC_API_KEY,
      lead_webhook_set: !!process.env.LEAD_WEBHOOK_URL,
      callback_webhook_set: !!(process.env.CALLBACK_WEBHOOK_URL || process.env.LEAD_WEBHOOK_URL)
    }
  });
};
