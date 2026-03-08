# AI InsureGenie — Lead Distribution System

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React Chatbot)                   │
│  User completes chatbot → PII collected → TCPA consent given    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ POST /api/leads
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js + Express)                │
│                                                                 │
│  1. Validate & Store Lead                                       │
│  2. Check Duplicates (phone + email)                            │
│  3. Log TCPA Consent                                            │
│  4. Run Distribution Logic:                                     │
│                                                                 │
│     ┌─── PING Phase (anonymous profile, no PII) ──────────┐    │
│     │  → SuperBudgetInsurance bids $6                      │    │
│     │  → QuoteWizard bids $12                              │    │
│     │  → LendingTree bids $18                              │    │
│     │  → SolvantAuto bids $5                               │    │
│     └──────────────────────────────────────────────────────┘    │
│                            │                                    │
│     ┌─── POST Phase (full PII to winners) ─────────────────┐   │
│     │  Mode A: Exclusive → highest bidder only ($18)       │    │
│     │  Mode B: Shared → top 3 buyers ($12+$6+$5 = $23)    │    │
│     │  Mode C: Hybrid → exclusive if bid>$15, else shared  │    │
│     └──────────────────────────────────────────────────────┘    │
│                                                                 │
│  5. Return accepted buyer(s) + redirect URL to frontend         │
│  6. Track conversions, payouts, publisher performance            │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DASHBOARD (Admin Panel)                       │
│  → Real-time lead feed        → Revenue per buyer               │
│  → Publisher performance      → Payout reports                  │
│  → Duplicate rate             → Accept/reject rates             │
│  → Consent audit log          → Daily/weekly/monthly P&L        │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** SQLite (dev) / PostgreSQL (production)
- **ORM:** better-sqlite3 (dev) / knex (production)
- **Queue:** Bull + Redis (for async buyer posting)
- **Auth:** JWT for admin dashboard
- **Logging:** Winston

## Quick Start

```bash
# 1. Clone and install
cd lead-system
npm install

# 2. Configure buyers
cp config/buyers.example.json config/buyers.json
# Edit with your buyer API endpoints and credentials

# 3. Set environment variables
cp .env.example .env
# Edit with your database URL, JWT secret, etc.

# 4. Run migrations
npm run migrate

# 5. Start server
npm run dev        # development with auto-reload
npm run start      # production
```

## API Endpoints

### Lead Submission (from chatbot)
```
POST /api/leads
Body: { lead data + consent }
Returns: { lead_id, accepted_buyers[], redirect_url }
```

### Lead Status
```
GET /api/leads/:id/status
Returns: { buyers: [{ name, status, payout }] }
```

### Publisher Tracking
```
GET /api/leads?publisher=pub123&from=2025-01-01&to=2025-01-31
Returns: { leads[], stats: { total, accepted, revenue } }
```

### Admin Dashboard
```
GET /api/admin/dashboard
GET /api/admin/buyers
GET /api/admin/publishers
GET /api/admin/revenue
```

## File Structure

```
lead-system/
├── README.md
├── package.json
├── .env.example
├── config/
│   ├── buyers.json          ← Buyer API configs
│   └── settings.json        ← Distribution rules
├── src/
│   ├── server.js            ← Express app entry
│   ├── database.js          ← DB schema + queries
│   ├── routes/
│   │   ├── leads.js         ← Lead submission + status
│   │   └── admin.js         ← Dashboard endpoints
│   ├── services/
│   │   ├── distributor.js   ← Ping-post + routing logic
│   │   ├── validator.js     ← Lead validation
│   │   └── consent.js       ← TCPA consent logging
│   └── utils/
│       ├── logger.js        ← Logging
│       └── helpers.js       ← Utilities
└── dashboard/               ← Admin UI (optional)
```

## Connecting Buyers

Each buyer needs 3 things configured in `config/buyers.json`:

1. **Ping URL** — where you send anonymous data to get a bid
2. **Post URL** — where you send full PII after they win
3. **Auth credentials** — API key, token, etc.

See `config/buyers.json` for the exact format with examples for your current partners.

## Distribution Modes

Configure in `config/settings.json`:

- **exclusive**: Always sell to highest single bidder
- **shared**: Sell to top N buyers simultaneously  
- **hybrid**: Exclusive if top bid > threshold, else shared
- **round-robin**: Rotate between buyers (simplest)
- **weighted**: Send more to higher-performing buyers

## TCPA Compliance

Every lead stores:
- Full consent text shown to user
- Timestamp of consent (ISO 8601)
- IP address of user
- User agent string
- Which buyers were disclosed in consent
- Proof the checkbox was actively checked (not pre-checked)

This data is immutable and retained for 5 years (industry standard).
