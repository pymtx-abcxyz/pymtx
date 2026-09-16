# Step 7 — Hardening

## Privileged APIs (ADMIN session required)

| Route | Gate |
|-------|------|
| `POST/GET /api/jobs/daily-debit` | ADMIN |
| `POST /api/charges` | ADMIN |
| `GET /api/admin/metrics` | ADMIN |
| `POST /api/plans` | ADMIN (legacy; clients use checkout) |

**Admin UI** (`/admin`) requires an ADMIN user session (not cookie presence alone). Business portal still requires login; APIs enforce role + business access.

Client checkout / skip / invite require the invite `token` and verify ownership. Responses are trimmed DTOs (no raw Prisma graphs).

## Webhooks

- Production refuses placeholder `STRIPE_WEBHOOK_SECRET` unless `ALLOW_DEMO_MODE=true`
- Checkout + Connect call `assertLiveStripeOrDemoAllowed` (no silent demo PADs in locked prod)
- `StripeWebhookEvent` stores Stripe `event.id` for idempotent retries
- Handler failures do **not** write the idempotency row (Stripe can retry)

## Settlement

- `TransactionMetric.installmentId` is `@unique` (no double fee accounting)

## Auth

- Login rate limit: 10 attempts / 15 min per IP+email
- Magic-link request/verify rate limited; staff invites rate limited
- Checkout / skip / invite lookup rate limited per IP
- Login rotates sessions (one active session per user)
- Magic-link rotates customer sessions (one active session per customer)
- `demoUrl` is returned **only** when `allowDemoMode()` is true

## HTTP

Security headers via `next.config.ts` (CSP, HSTS, frame deny, nosniff, referrer, permissions).  
Session cookie: `httpOnly`, `sameSite=lax`, `secure` in production / on Vercel.

## Ops

```bash
npm run db:seed
npm run smoke:hardening
npm run smoke:step8
npm run job:daily-debit   # authenticates as seeded admin, runs inline job
```

Demo still works locally (`ALLOW_DEMO_MODE=true` or non-production).  
For locked production: real Stripe keys and `ALLOW_DEMO_MODE=false`.
