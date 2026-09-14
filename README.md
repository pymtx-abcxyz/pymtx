# Harbor

Zero-custody B2C Accounts Receivable settlement SaaS for Ontario small businesses.

## Compliance posture (Path B)

- **Business** remains legal creditor and Merchant of Record
- **Stripe Connect Direct Charges** (`stripeAccount: connectedAccountId`) — principal never touches Harbor
- Harbor monetizes via `application_fee_amount` only
- **ACSS Debit** (Canadian PAD / EFT) with Payments Canada Rule H1 Personal PAD mandates
- **CASL** white-labeled invites from the business trade name
- Designed to operate as pure SaaS under CDSSA first-party exemption (not legal advice)

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Prisma + SQLite (demo)
- Stripe Connect + ACSS Debit (demo mode without live keys)

## Portals

| Path | Role |
|------|------|
| `/admin` | Platform take-rate, onboarding health, pipeline |
| `/business` | Connect bank, upload invoices, aging |
| `/client?token=` | Plan selection, PAD mandate, skip engine |

## Quick start

```bash
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Seed prints invite tokens for the demo customer portal.

## Skip payment engine

- 1 skip every 180 days
- Request ≥ 3 business days before debit (Rule H1)
- Skipped installment marked `SKIPPED`; amount appended at end of schedule (+1 month)
- NSF: max 1 retry within 30 days (`FAILED_NSF`)

## Environment

Copy `.env` and set live Stripe keys for non-demo Connect / ACSS flows:

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PLATFORM_FEE_BPS` (default `250` = 2.5%)

## Auth & invoice upload

Portals `/admin` and `/business` require login (`/login`).

Demo (after seed):

- Business: `billing@mapleridgedental.example` / `harbor-business-demo`
- Admin: `admin@harbor.example` / `harbor-admin-demo`

Upload past-due invoices as CSV from the business portal (template download included). See `docs/STEP-6-AUTH-UPLOAD.md`.
