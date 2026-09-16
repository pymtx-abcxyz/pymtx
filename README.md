# Pymtx

Zero-custody B2C Accounts Receivable settlement SaaS for Ontario small businesses.

**Live:** [https://pymtx.com](https://pymtx.com) · [https://pymtx.vercel.app](https://pymtx.vercel.app)

## Compliance posture (Path B)

- **Business** remains legal creditor and Merchant of Record
- **Stripe Connect Direct Charges** (`stripeAccount: connectedAccountId`) — principal never touches Pymtx
- Pymtx monetizes via `application_fee_amount` only
- **ACSS Debit** (Canadian PAD / EFT) with Payments Canada Rule H1 Personal PAD mandates
- **CASL** white-labeled invites from the business trade name
- Designed to operate as pure SaaS under CDSSA first-party exemption (not legal advice)

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Prisma + **PostgreSQL** (Neon in production)
- Stripe Connect + ACSS Debit
- Optional Redis (distributed rate limits) and Resend (magic-link email)
- Inngest for daily debit jobs

## Portals

| Path | Role |
|------|------|
| `/admin` | Platform take-rate, onboarding health, pipeline |
| `/business` | Connect bank, upload invoices, aging |
| `/client?token=` | Plan selection, PAD mandate, skip engine |
| `/login` | Staff (OWNER / CLERK / ADMIN) |
| `/login/customer` | Customer magic link |

## Quick start

```bash
npm install
cp .env.example .env
# set DATABASE_URL to Postgres
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

See `.env.example`. Production (Vercel) should set:

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Neon Postgres (pooled) |
| `DATABASE_URL_UNPOOLED` | Direct URL for migrations |
| `NEXT_PUBLIC_APP_URL` | `https://pymtx.com` |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Live or test keys |
| `STRIPE_WEBHOOK_SECRET` | From Stripe webhook endpoint |
| `PLATFORM_FEE_BPS` | Default `250` (2.5%) |
| `ALLOW_DEMO_MODE` | `false` when Stripe is live |
| `REDIS_URL` | Optional; in-memory fallback if unset |
| `EMAIL_PROVIDER` | `resend` or `demo` |
| `RESEND_API_KEY` | Required when provider is `resend` |
| `EMAIL_FROM` | e.g. `noreply@pymtx.com` (verify domain in Resend) |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Production Inngest |

## Auth & invoice upload

Demo accounts (after seed):

- Owner: `billing@mapleridgedental.example` / `pymtx-business-demo`
- Clerk: `clerk@mapleridgedental.example` / `pymtx-clerk-demo`
- Admin: `admin@pymtx.example` / `pymtx-admin-demo`
- Customer magic link: `aisha.rahman@example.com` → `/login/customer`

## Hardening

- Privileged APIs require **ADMIN** (or OWNER where noted)
- Stripe webhooks signature-verified in non-demo mode
- Login / magic-link rate-limited (Redis when configured)
- Production refuses placeholder Stripe secrets unless `ALLOW_DEMO_MODE=true`

```bash
npm run smoke:hardening
npm run smoke:step8
npm test
```

## Docs

Step write-ups live under `docs/STEP-*.md` (Connect → Checkout → Inngest → Skip → Auth → Hardening → Roles/Magic-link).
