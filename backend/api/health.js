// api/health.js: open this URL in a browser to see what is and isn't set up. Never shows secret values.
const { kvConfigured } = require("../lib/kv");
const { cors } = require("../lib/http");

module.exports = function handler(req, res) {
  cors(req, res, "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  res.status(200).json({
    status: "ok",
    service: "AI InsureGenie API",
    setup: {
      storage_connected: kvConfigured(),
      admin_password_set: !!process.env.ADMIN_PASSWORD,
      ai_chat_key_set: !!process.env.ANTHROPIC_API_KEY,
      lead_webhook_set: !!process.env.LEAD_WEBHOOK_URL,
      callback_webhook_set: !!(process.env.CALLBACK_WEBHOOK_URL || process.env.LEAD_WEBHOOK_URL)
    }
  });
};
