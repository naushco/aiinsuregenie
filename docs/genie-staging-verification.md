# Genie 2.0 staging preview and release gates

## Isolated live preview

- URL: https://aiinsuregenie-chat-staging.in-naushco.workers.dev/
- Separate Cloudflare Worker: `aiinsuregenie-chat-staging`; **never** replace `aiinsuregenie-chat`.
- No production D1, KV, service bindings, or API secrets. The staging Worker has an empty bindings list.
- Frontend build is built by the `publish-staging-assets` GitHub Actions job after backend, dashboard, frontend, and Chromium smoke checks pass. Output lives on the `genie-staging-assets` GitHub branch under `chatbot/dist/`.
- Current bootstrap staging deployment serves assets from a specific Git commit of that branch, avoiding GitHub branch-cache inconsistency. To see a newer build, update the staging Worker to reference the new commit or replace this bootstrap proxy with a standard Wrangler static-assets deployment from `chatbot/wrangler.staging.jsonc`.
- `config.js` selects the preview origin as the API for staging. The preview Worker responds with isolated test responses for `/api/chat`, `/api/partners`, and `/api/geo`.
- **All real lead submission endpoints** (including callback, subscribe, leads) return HTTP 403 and do not reach real partners; event requests return 204 without tracking.
- TrustedForm's browser SDK remains enabled so certificate-generation behavior can be observed, but no real buyer is contacted.
- Responses carry `X-Robots-Tag: noindex, nofollow`. This is a **public test URL**, not a private access-controlled environment: do not enter actual PII.

## Browser verification

Cloudflare Browser Run verified that the React UI renders, `AIG_CONFIG.staging` is true, the API base is the preview origin, the TrustedForm field receives a real certificate URL, no production API requests were observed, and a callback POST is refused with status 403.

GitHub Actions runs Playwright Chromium smoke tests in `chatbot/e2e/genie.spec.cjs`, with mocked network routes preventing production submissions.

## Remaining release gates

1. Successful latest Chromium suite, including educational-guide confirmation and correction; confirm browser resume after reload and local opt-out.
2. Verify the actual staged asset hash corresponds to the current feature-branch build.
3. Confirm lead-disclosure text, TrustedForm certificate URL, consent/partner field mapping and partner-specific schema in a separate non-production buyer sandbox, if available.
4. Validate a real partner postback only after authorization with test leads and appropriate compliance controls.
5. Only after explicit approval, consider merging PR #26 into `cloudflare` and deploying production. Do not auto-deploy.

This preview does not test real insurance prices or actual partner leads. No carrier quote API has been connected; no prices should be invented.
