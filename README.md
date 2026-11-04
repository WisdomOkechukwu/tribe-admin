# Tribe Admin

Internal operations console for Tribe: customers, multi-leg transactions, provider inventory, markups, KYC review and the API trail.

Next 16 (App Router, Cache Components, Partial Prefetching) · React 19 · Tailwind v4 · Zustand · Zod.

## Run

```sh
export PATH=~/.nvm/versions/node/v24.21.0/bin:$PATH   # Homebrew Node is broken on this machine
npm install
cp .env.example .env.local                            # TRIBE_API_URL=http://localhost:8081
npm run dev                                           # http://localhost:3000
npm run lint && npx tsc --noEmit && npm run build
```

Sign-in goes through the Go admin API (`POST /admin-api/sessions` on `TRIBE_API_URL`). There are no local passwords. Seeded admins (local backend only) use `Tribe@2026`:

| Email | Role |
|---|---|
| super@tribe.africa | Super admin (everything) |
| ops@tribe.africa | Operations |
| support@tribe.africa | Support |
| compliance@tribe.africa | Compliance |
| finance@tribe.africa | Finance |
| viewer@tribe.africa | Read-only |

Set `ADMIN_SESSION_SECRET` (32+ chars) in production; it encrypts the session cookie that holds the API token.

## Pages
| Route | What it does |
|---|---|
| `/` | KPIs, 30-day volume, category split, items needing attention, API health, low liquidity, recent failures |
| `/customers` | One search for name, email, @tag, phone or ID, plus tag chips (@handles or labels, all must match) and filters (`/customers/find` redirects here) |
| `/customers/[id]` | Profile: identity, KYC limits, wallets, security, devices, cards, recurring bills, Token Vault, beneficiaries, referrals, tickets |
| `/customers/[id]/verifications` | QoreID checks tier by tier, with approve and reject |
| `/customers/[id]/transactions` | The customer's transactions, with category tabs |
| `/customers/[id]/api-trail` | The customer's API requests |
| `/transactions` | Tabs: Currency · Virtual cards · Cashpoints · Utilities · Gift cards; filters by type, status, asset, date, reference, code, meter or card |
| `/transactions/[id]` | Leg timeline (e.g. GBP → NGN → BTC), each leg with base and applied rate, markup, fee, and inventory before → change → after; net inventory impact; linked API requests |
| `/team` | Team & access: add teammates (3-step editor: who → access → review), role presets, per-permission toggles with live sidebar preview, suspend/reactivate, reset password, remove; plus an access matrix of everyone × every permission |
| `/support` | Live inbox for app tickets and in-app chats: chat bubbles, quick replies, resolve/reopen, linked transaction (with legs), plus **Simulate** buttons (new ticket, customer reply, auto every 15s) |
| `/currencies` | Every fiat and crypto as wallet-style cards: brand look, rate, holders, customer balances vs provider liquidity (cover), 7-day volume |
| `/api-trail` | Global request log; expand any row for the redacted request and response |
| `/inventory` | Seven **NGN books** (Local, Fiat, Crypto, Virtual card, Utilities, Gift card, Cashpoint) plus read-only crypto/fiat asset pools. Add naira to any book except Cashpoint NGN (escrow). Ledger of every movement |
| `/audit` | Expandable rows: full summary, who, when, target, and a before → after diff (field table / added & removed chips / numeric delta) |
| `/verifications` | KYC review queue |
| `/audit` | Every admin action, with before and after values |

Every transaction row has a **legs** button that opens a quick-view drawer. It shows the legs, "paid with", and the customer and system balances (previous, after, live now), fetched on demand. KYC checks show their images (selfie, liveness frames, ID front and back, proof of address) in a lightbox with zoom and side-by-side compare against the BVN/NIN record photo. Images come from the sign-in-protected `/kyc-media/[id]` route. Today they are generated SAMPLE illustrations; swap that route for the QoreID/storage file.

**Live support alerts:** `app/api/support/stream` is a sign-in-protected Server-Sent Events stream fed by an in-process bus (`lib/support/bus.ts`). Every dashboard tab listens (`SupportListener`). A new ticket plays a three-note chime, a customer chat reply plays a soft double pop (synthesised with Web Audio in `lib/sound.ts`, no audio files), shows a toast with an Open link, and updates the unread badge on Support. The bell in the top bar mutes sounds (persisted). Browsers only allow audio after the first click on the page. In production, swap the in-process bus for Redis pub/sub or the chat provider's webhooks so it works across multiple server instances.

**Money model (NGN books):** customers' naira sits in **Local NGN** (deposits in, withdrawals and bank sends out). Every conversion passes through the desk's NGN book, and products pay out of their own:
- BTC → GBP: `BTC → Crypto NGN` · `Fiat NGN → GBP`
- Airtime paid in GBP: `GBP → Fiat NGN` · `Utilities NGN → airtime`
- Card funding: `X → desk NGN` · `Virtual card NGN → card`
- Gift cards: `Gift card NGN → code` (buy), `card → Gift card NGN` (sell)
- Cashpoints: `NGN → Cashpoint NGN` (escrow) → redeemer

Each conversion leg carries a **1% rate markup** and a **0.1% fee of its from-asset** (configurable per type in Markups); flat fees apply once per transaction. Every transaction stores its `route`, shown as chips on lists, the quick view and the detail page, and every leg shows the book and pool balances before and after.

**Permissions:** `lib/domain/permissions.ts` is the single catalog of **23 permissions in 11 areas**, each tagged View / Action / Sensitive, plus the role presets. Enforcement is server-side at three layers:
- page `<Gate perm>` shows a friendly "No access" card;
- every `repo.ts` read calls `requirePerm`, and masks personal data without `customers.pii`, hides KYC images without `kyc.media`, and strips API bodies without `api.bodies`;
- every server action calls `authorize(perm)`. The KYC image and support-stream routes check too.

Permissions are read fresh on each request, so edits and suspensions apply on the teammate's next click (a suspended session is signed out via `/api/auth/signout`). Guardrails: you can't suspend, remove or demote yourself, and the team always keeps at least one active manager. The client only mirrors permissions for padlocks in the sidebar and tabs.

**UI rule:** anything with a hard shadow is clickable (buttons, tabs, filters, cards and tiles that go somewhere). Underlined text is a link. Flat outlined panels are information only.

The **Markups** button (top bar and Transactions) opens a modal. Each transaction type has a rate markup %, a fee markup %, a flat fee, and an active toggle.

## Architecture
- **Backend:** every read and write goes to the Go admin API (`TRIBE_API_URL`, `/admin-api`) through `lib/api/client.ts` (server-only). The API token lives in the AES-GCM encrypted httpOnly session cookie; 401 or a suspended account signs the admin out; every write sends an `Idempotency-Key`.
- **`lib/data/repo.ts`** maps Go resources onto `lib/domain/types.ts` (money as decimal strings). **`lib/data/writes.ts`** is the write side. Server actions (`lib/actions/*`): authorise → zod-validate → API write (the API audits it) → `refresh()`.
- **Permissions** come from `GET /admin-api/me` on each request; `lib/domain/permissions.ts` mirrors the backend catalog for labels, presets and padlocks.
- **Pricing:** rate margins per asset and fees per transaction type (`/rates`, or the Fees & margins modal).
- **Treasury:** funding is a two-person check: one admin requests, a different admin approves (posts Dr Company Vault / Cr Treasury Funding) or rejects.
- **Live support:** `/api/support/stream` proxies the API's SSE stream (`event: support`).
- **Not from the API yet:** KYC images (a placeholder is shown).
- **Zustand** (`stores/`) holds client UI state only.
