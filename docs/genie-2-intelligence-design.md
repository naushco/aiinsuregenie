# Genie 2.0 — Conversational Qualification & Demand Intelligence (draft)

Status: DESIGN ONLY. No production deployment or schema migration is authorized by this document.
Base branch: `cloudflare`; development branch: `feature/genie-2-intelligence`.

## Goal
Turn the existing chatbot into a buyer-ready, consented lead funnel while retaining partner referrals, existing tracking, Cloudflare Workers/D1, and SEO pages. Collect privacy-conscious aggregate intelligence on why drivers shop and where they struggle.

## Design principles
1. Conversation first: infer information from the user's own words, ask only for missing fields, allow corrections and skip nonessential questions.
2. AI extracts candidate facts and writes friendly replies; deterministic rules validate required fields, eligibility, consent, and buyer delivery. Never let the model invent rates, eligibility or buyer acceptance.
3. Separate consumer PII from demand analytics. Avoid raw chat transcript storage in analytics. Retention, deletion, access controls and consent must be defined before live data collection.
4. No buyer delivery until a buyer-specific field mapping, traffic approval, API credentials and consent language are verified. No synthetic leads sent to live endpoints.
5. Keep existing partner referral path as a fallback. Never show synthetic premium estimates based on advertiser payouts.

## Proposed canonical conversation fields
- `session_id` (pseudonymous), `locale`, `state`, `zip` (only if necessary)
- `situation[]`: lapse, SR-22, FR-44, DUI, tickets, accidents, non-owner, rideshare, new-driver, other
- `shopper_goal[]`: lower-price, immediate-coverage, reinstatement, filing, comparison, other
- `shopping_obstacle[]`: unaffordable, denied, cancelled, confusing, limited-options, other
- `urgency`: today, within-week, later, unknown
- `vehicle_status`: owned, financed, leased, no-vehicle, unknown
- `coverage_goal`: minimum, full, unsure
- `attribution`: campaign and permitted source identifiers, landing page, session ID
- `lead_contact`: buyer-required contact fields in restricted storage, not intelligence tables
- `consent`: exact disclosure version, affirmative action, timestamp, source URL, certificate reference where applicable
- `buyer_outcome`: eligible, submitted, accepted, rejected, paid, with reason codes and confirmed amount

Each inferred fact must include `source` (user_statement, explicit_selection, verified), `confidence`, and `confirmed` status. Do not infer protected or sensitive traits.

## Conversation state machine
`welcome -> understand_need -> qualify -> contact_and_consent -> match_and_submit -> result`.
An informational question can temporarily interrupt any state and then resume. Qualification requirements are derived from configured buyer schemas, not a single hard-coded form. An unknown answer is not a rejection unless a verified buyer rule requires it.

## Proposed intelligence events
`conversation_started`, `intent_detected`, `field_confirmed`, `question_asked`, `question_skipped`, `qualification_completed`, `consent_granted`, `lead_submitted`, `buyer_accepted`, `buyer_rejected`, `partner_clicked`, `session_abandoned` (derived from inactivity), `revenue_confirmed`.
Each event should have a stable event ID, session ID, timestamp, coarse taxonomy codes and source attribution. No name, phone, email or full free-text answer in event payloads. Deduplicate ingestion and avoid double-counting retries.

## Dashboard questions
- Which stated insurance problems and goals are most common by state and traffic source?
- Where do users abandon the chat, and which questions create friction?
- What percentage of conversations become consented, qualified, buyer-accepted and paid leads?
- What is buyer-confirmed revenue, cost per accepted lead, and gross margin by campaign and segment?
- Which buyer rejection reasons should inform routing changes?

## Implementation stages (separate reviewable PRs)
1. Audit current chatbot, API, D1 migrations, analytics and privacy controls. Map existing fields and identify fabricated estimates/eligibility claims.
2. Add versioned intent taxonomy, schema validator and deterministic question planner with unit tests; no UI or live data changes.
3. Wire chatbot to planner behind a disabled feature flag, preserve current flow and session resume.
4. Add minimal, consent-appropriate event schema and D1 migrations with explicit retention and opt-out behavior; test in isolated environment.
5. Add buyer configuration and mocked delivery adapter; only integrate real buyer endpoints after credentials, field specs and approval.
6. Dashboard aggregate insights, QA, then explicit production approval.

## Acceptance criteria
- Existing chatbot, partner clicks, dashboard, API and SEO remain operational.
- Free-text lapse/SR-22/price concerns map to the correct taxonomy without losing user wording in the visible conversation.
- Already supplied facts are not asked again; user can edit them.
- No fabricated insurance premiums or carrier promises.
- No personal contact fields enter aggregate intelligence events.
- Test buyer submission is idempotent and records accepted/rejected outcomes.
- No live buyer delivery or production merge without founder approval.
