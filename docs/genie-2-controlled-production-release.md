# Genie 2.0 controlled production rollout — release gate

Updated: 2026-11-24. **Do not turn on visitor traffic without explicit approval.**

## Product implementation

- Legacy visitor interface preserved exactly as `chatbot/src/LegacyApp.jsx`, sourced from the `cloudflare` branch. Verified by a Git blob SHA-1 check in CI.
- `chatbot/src/main.jsx` renders `LegacyApp` by default. It dynamically loads `App.jsx` (Genie 2.0) only if `window.AIG_CONFIG.genieV2Enabled === true`. Query params/cookies/localStorage cannot enable it.
- `chatbot/public/config.js` sets `genieV2Enabled: staging`, **false on `chat.aiinsuregenie.com`**, true on isolated staging.
- The existing production ActiveProspect TrustedForm SDK and callback/lead mappings are preserved; CI regression-checks them.
- `backend/worker.js` reads **only** the Cloudflare Worker env binding `GENIE_V2_ENABLED === "true"`; it sets `req.genieV2Enabled`. Request parameters cannot turn this on.
- `backend/api/chat.js` returns Genie intelligence **only** if `req.genieV2Enabled === true` AND `body.genie_v2 === true`. Otherwise the API returns its previous `{answer}` schema. `backend/lib/genie-runtime.js` never upgrades unverified extracted candidates to confirmed visitor profile.
- No buyer API, real premiums, or purchase guarantee is added.
- CI: `Genie 2.0 validation` checks backend contract, exact legacy snapshot, chatbot bundle, Chromium both flag states, TrustedForm mapping, dashboard build, and Wrangler production API dry-run.
- Verified successful GitHub Actions workflow run: https://github.com/naushco/aiinsuregenie/actions/runs/45366118644

## Current production deployment state and rollback safety

**The new frontend is not deployed to the running chatbot. No live visitor is opted into Genie 2.0.**

The feature-gated production API bundle is uploaded as a **non-deployed Worker version**:
- Candidate API version: `59346416-420d-41a0-b9f0-b394694ef2fa`
- Preserves bindings: `DB`, `ANTHROPIC_API_KEY`, `ADMIN_PASSWORD`, using Cloudflare `inherit` on version upload; `nodejs_compat` retained.
- No `GENIE_V2_ENABLED` binding is currently present. The operator switch is therefore OFF.
- Existing production API active version after rollback: `8aa60c47-5d40-4072-b1ee-2844f1b4f390`. Confirmed via Cloudflare Deployments GET.
- The candidate was briefly deployed with Genie off, but a live API smoke test returned unexpected HTTP 404 for `/api/health` and `/api/chat`. The API was **immediately rolled back** to the prior production version.
- A subsequent read-only check saw HTTP 404 for `/api/health` on both the custom domain and Workers.dev even after rollback. The issue requires investigation; do **not** assume the candidate caused it.
- A separate isolated candidate Worker was created for further diagnosis and then removed, without binding production secrets or D1.
- **Important:** Cloudflare `/scripts/{name}/content/v2` may represent latest uploaded code, not active deployed version. Use `/scripts/{name}/deployments` to verify active versions.

## Release blockers

1. Diagnose the unexpected 404 responses on the **currently active** production API path. Verify route selection, Worker custom-domain mapping, and live Worker routing. Investigate carefully without sending real leads or changing production D1.
2. Revalidate `/api/health` and `/api/chat` read-only/synthetic behavior on the current production baseline. API response should retain legacy `{answer}` shape while the flag is off.
3. Upload the **validated frontend assets** using the official Wrangler static-assets deployment flow. Cloudflare's connected API tool supports asset-session creation but its upload request lacked the required session JWT authorization and returned 401, so the frontend was **not** replaced by an incomplete or proxy deployment.
4. After production API baseline health is confirmed, deploy the already uploaded feature-gated API version with flag OFF; verify API works. Roll back immediately if health or legacy response checks fail.
5. Deploy the tested chatbot build with `genieV2Enabled: false` using Cloudflare Wrangler. Check current ActiveProspect/TrustedForm script, certificate field, existing partner links, callback, and user journey. Inspect live asset hash.
6. Only on further explicit approval, enable the frontend and backend operator flags for internal testing, then controlled visitor rollout. Buyer integrations remain separate.

## Commands for an operator with the repository and Cloudflare Wrangler credentials

From the verified feature branch:

```sh
cd chatbot
npm ci
npm run build
# Deploy only AFTER readiness checks and explicit approval to change the production chatbot:
npx wrangler deploy --config wrangler.jsonc
```

Rollback the chatbot from Cloudflare's Deployments page by selecting the previous known-good version. The API rollback version ID is recorded above; do not attempt to restore secrets manually.

The isolated staging chatbot is available at `https://aiinsuregenie-chat-staging.in-naushco.workers.dev/`. Use fictional test data only.

## Non-negotiable constraints

- Never write raw advisor transcripts or sensitive risk history to D1 automatically.
- Do not submit test leads to live partners; ActiveProspect TrustedForm certificate generation alone is not permission to call/text.
- Never fabricate carrier premiums, savings, approval, or eligibility.
- Keep optional email-save consent separate from marketing email, phone, and SMS permission.
- No automatic merge to `cloudflare`, no production site changes, and no activation of Genie 2.0 without explicit operator approval.

## 2026-11-24 API 404 investigation (read-only + isolated tests)

- Cloudflare custom domain map confirms `api.aiinsuregenie.com` points to `aiinsuregenie-api`, and the Workers.dev subdomain is enabled. The zone's separate Worker Routes list is empty, consistent with use of a Worker Custom Domain rather than a classic route.
- Active API deployment version remains `8aa60c47-5d40-4072-b1ee-2844f1b4f390` (previous known-good). No `GENIE_V2_ENABLED` binding is configured; live visitors cannot enable the new brain.
- The Cloudflare Browser Rendering client previously received an application-style `{"error":"Not found"}` on `/api/health` from both the custom domain and Workers.dev, **including after rollback**. External network verification from other tools was unavailable. This does not establish an outage for all users; the exact edge request-path or client-specific behavior remains unresolved.
- The GitHub test suite now starts the **actual Wrangler-bundled production Worker** in a local Cloudflare runtime with local-only D1. Verified `/` and `/api/health` return HTTP 200, chat/leads/callback OPTIONS route correctly, `/api/geo` returns HTTP 200, and truly unknown paths return HTTP 404.
- The local runtime may synthesize a US state for `/api/geo`, so tests assert a null state or two-letter US state rather than always null.
- Automated check: `production-api-dry-run` in Genie validation; no live endpoint or partner lead is contacted by these tests.
- **No new production deployment was performed during this investigation.** The chatbot and API active versions remain unchanged. Before attempting another disabled-code rollout, verify the live API response using an independent browser/client and inspect the actual request URL/hostname, URL rewrites, and Cloudflare observability for 404s.

