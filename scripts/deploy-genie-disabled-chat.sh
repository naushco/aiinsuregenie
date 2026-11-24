#!/usr/bin/env bash
# Controlled Genie 2.0 code deployment: production chatbot defaults to original UI.
# Run with authorized Cloudflare credentials and after reviewing production release gate.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ "$(git branch --show-current)" != "feature/genie-2-intelligence" ]]; then
  echo "Refusing to deploy from an unexpected branch." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Refusing to deploy from a dirty working tree." >&2
  exit 1
fi

echo "Validating current API baseline without using buyer endpoints..."
for host in "https://api.aiinsuregenie.com" "https://aiinsuregenie-api.in-naushco.workers.dev"; do
  result="$(curl --fail-with-body --silent --show-error --max-time 20 "$host/api/health")"
  RESPONSE="$result" node -e 'const r = JSON.parse(process.env.RESPONSE); if (r.status !== "ok") process.exit(1)'
done

echo "Verifying Genie remains disabled for visitors on the live domain..."
node --input-type=module <<'NODE'
import fs from 'node:fs';
const config = fs.readFileSync('chatbot/public/config.js','utf8');
const main = fs.readFileSync('chatbot/src/main.jsx','utf8');
const legacy = fs.readFileSync('chatbot/src/LegacyApp.jsx','utf8');
if (!config.includes('genieV2Enabled: staging')) throw new Error('Genie flag is not explicitly limited to staging');
if (!main.includes("window.AIG_CONFIG?.genieV2Enabled === true")) throw new Error('Unexpected UI switch');
if (!main.includes("import LegacyApp from './LegacyApp.jsx'")) throw new Error('Legacy UI missing');
if (!legacy.includes('TrustedForm') && !fs.readFileSync('chatbot/index.html','utf8').includes('trustedform')) {
  throw new Error('TrustedForm integration is missing');
}
const host='chat.aiinsuregenie.com';
const staging=/(^|[.-])staging([.-]|$)|(^|[.-])preview([.-]|$)|^localhost$|^127\.0\.0\.1$/.test(host);
if (staging) throw new Error('The live chatbot hostname unexpectedly matches staging');
console.log('Live hostname remains on LegacyApp');
NODE

cd chatbot
npm ci
npm run build
test -s dist/index.html
test -s dist/config.js
if ! grep -q 'genieV2Enabled: staging' dist/config.js; then
  echo 'Refusing to deploy: built config does not force Genie off on live hostname' >&2
  exit 1
fi

echo "Built and verified. Uploading assets to aiinsuregenie-chat with Wrangler..."
# Requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID or authorized Wrangler login.
npx --yes wrangler@4.167.0 deploy -c wrangler.jsonc
echo "Deployment uploaded with Genie flag OFF. Verify legacy chatbot, TrustedForm and links in a real browser."
