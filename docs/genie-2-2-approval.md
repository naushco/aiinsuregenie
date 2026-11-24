# Genie 2.2 — Approval and acceptance checklist

**Release status:** Development branch only; **not deployed**. Production Genie 2.1 must remain unchanged until the owner explicitly approves a production rollout.

**Owner goal:** Two separate visitor journeys that use one confirmed, privacy-aware insurance profile. Natural advice should build relevant qualification signals quietly; urgent and paid visitors should enter a fast quote funnel without having to chat.

## Journey A — Talk to Genie (conversation-first)
- Direct visitors can describe an insurance problem naturally. Insurance advice is generated through the existing secure AI backend.
- Advice instructions explain tradeoffs, do not over-push quote forms, ask at most one helpful follow-up, avoid invented prices and avoid collecting phone/email in chat.
- Only explicit visitor statements and confirmed AI-extracted candidates become structured insurance facts. Hypotheticals do not count as personal facts.
- Confirmation keeps the visitor in the advisor journey. Temporary displayed conversation history stays in memory; raw chat, email and phone are not persisted in quote resume storage.
- If the user requests quotes, show a review of **already confirmed** facts. If nothing is confirmed, begin quote questions immediately instead.

## Journey B — Get Quote (conversion-first)
- Existing `#start=quote` links continue to enter the guided quote funnel directly, including paid-ad and affiliate entry points.
- Choosing **Get quote now** with no prior confirmed facts skips an empty review and asks the first qualification question.
- Previously confirmed fields are not asked again. Visitors may switch to **Ask Genie** and return without losing confirmed details.
- The quote journey presents an editable structured summary **before** any quoting partner is shown. The profile labels missing values clearly and does not pretend to be a carrier quote.
- No buyer link is opened or contact lead submitted by the review itself. Clicking a real partner remains a separate user action.
- Non-owner visitor profiles are **not** matched to unverified vehicle-policy partners.

## Shared profile and internal lead readiness
- Confirmed state, risk situation (including SR-22, DUI, lapse, rideshare), vehicle/ownership status, coverage goals, timing, and price priorities.
- A completeness indicator marks required confirmed details and missing fields. It is **not** an insurance rate, underwriting approval, lead price, or conversion probability.
- The API's existing deterministic planner stays a safe fallback, with no additional direct browser model API call.
- Sponsor/partner eligibility must be verified independently before creating buyer-specific routing.

## Attribution and privacy
- Preserve safe, allowlisted first-party `utm_*`, `pub`, `source_id`, `subid`, `gclid`, `fbclid`, `msclkid`, and `ttclid` across both journeys in session storage.
- Never attach raw conversation text, contact fields, names, or arbitrary URL parameters to attribution events.
- Respect existing opt-out/GPC; remove attribution and saved progress when opt-out is active.
- Keep the production TrustedForm script, certificate field, existing call consent flow, existing tracking and SEO site unchanged.
- **Transparent consent is still mandatory** for contact collection, calls, or disclosure of data to third-party buyers. Tracking certificates alone do not replace user consent.

## Acceptance tests before production approval
1. Visitor asks two insurance questions and receives a coherent conversation, not a forced form.
2. Visitor describes a DUI and lapse in Texas; Genie recognizes candidates, explains options, asks for confirmation and does not silently record or assume an SR-22.
3. Visitor clicks Get Quote immediately and enters the first missing quote question without an empty summary.
4. Visitor confirms details in the advisor flow, switches to Get Quote, reviews and edits state or coverage, and sees previously confirmed fields pre-filled.
5. Non-owner SR-22 path skips inappropriate owned-vehicle questions and never claims a verified buyer match.
6. Existing quote-session progress survives a Genie 2.1 → 2.2 upgrade.
7. Meta/Google/affiliate UTM and click IDs survive the full journey without collecting PII in attribution.
8. Quote results do not appear until the visitor accepts the profile review.
9. Verify TrustedForm, buyer contact consent, database binding, API response, error fallback, health and rollback.
10. The SEO website and all public custom hostnames remain unchanged until separately approved.

## Explicitly outside Genie 2.2
- Real-time carrier premiums, live underwriting, buyer-specific lead POST/ping tree, or unverified partner claims.
- Automated outbound contact, automated SMS/email consent, data sharing triggered only by viewing the review.
- A fully optimized paid-ad Get Quote funnel: conversion UX experimentation is planned separately after this safe shared architecture.
- Native ChatGPT connector and new SEO distribution channel; separate roadmap items.

## Controlled release after written owner approval
1. Pin a reviewed commit and confirm CI is green; re-check real production Worker bindings and current rollback IDs.
2. Deploy **API first**, verify read-only health and advisor response. No lead test submissions.
3. Deploy **chat frontend second**, verify both journeys against live hostname, TrustedForm, consent, session attribution, and ability to load the old chatbot.
4. If any production acceptance check fails, restore the prior independently pinned API/chat Worker versions.
5. Do not enable buyer-specific lead delivery or large paid traffic until end-to-end consent and conversion/reconciliation checks pass.

**Approval is required separately for production deployment. Opening the draft PR, running tests, or viewing the review does not grant approval.**
