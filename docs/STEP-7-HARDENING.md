# Step 7 — Hardening

## Privileged APIs (ADMIN session required)

| Route | Gate |
|-------|------|
| `POST/GET /api/jobs/daily-debit` | ADMIN + live Stripe (or demo allowed) |
| `POST /api/charges` | ADMIN + live Stripe (or demo allowed) |
| `GET /api/admin/metrics` | ADMIN |
| `POST /api/plans` | ADMIN (legacy; clients use checkout); PAD accept asserts live Stripe |

**Admin UI** (`/admin`) requires an ADMIN user session (not cookie presence alone). Business portal still requires login; APIs enforce role + business access.

Client checkout / skip / invite require the invite `token` and verify ownership. Responses are trimmed DTOs (no raw Prisma graphs; no Connect `stripeAccountId` on checkout preview).

## Demo / production lock

- `chargeInstallment`, `runDailyDebitJob` / Inngest `processDailyInstallments`, checkout PAD, Connect login, and legacy `acceptPadMandate` all call `assertLiveStripeOrDemoAllowed`
- Production refuses placeholder Stripe / webhook secrets unless `ALLOW_DEMO_MODE=true`
- `.env.example` defaults `ALLOW_DEMO_MODE=false` (local non-production still allows demo via `!isProduction()`)
- Webhook demo short-circuit only when demo is allowed; locked prod returns 503

## Webhooks

- Prefer `STRIPE_CONNECT_WEBHOOK_SECRET`, fall back to `STRIPE_WEBHOOK_SECRET`
- `StripeWebhookEvent` stores Stripe `event.id` for idempotent retries
- Handler failures do **not** write the idempotency row (Stripe can retry)

## Settlement

- `TransactionMetric.installmentId` is `@unique` (no double fee accounting)

## Auth

- Login rate limit: 10 attempts / 15 min per IP+email
- Magic-link request/verify rate limited; staff invites rate limited
- Checkout / skip / invite / PAD record rate limited per IP
- Rate-limit IP prefers `x-real-ip` / `x-vercel-forwarded-for` over spoofable first `X-Forwarded-For` hop
- Login rotates sessions (one active session per user)
- Magic-link rotates customer sessions (one active session per customer)
- Magic-link always returns a generic 200 body (no email enumeration on send failure)
- `demoUrl` is returned **only** when `allowDemoMode()` is true and send succeeded

## HTTP

Security headers via `next.config.ts` (CSP, HSTS, frame deny, nosniff, referrer, permissions).  
Session cookie: `httpOnly`, `sameSite=lax`, `secure` in production / on Vercel.  
`/api/health` returns `{ ok, app }` only in production (Redis detail is non-prod).

## Ops

```bash
npm run db:seed
npm run smoke:hardening
npm run smoke:step8
npm run job:daily-debit   # authenticates as seeded admin, runs inline job
```

Demo still works locally (`ALLOW_DEMO_MODE=true` or non-production).  
For locked production: real Stripe keys, Connect webhook secret, Redis for distributed rate limits, Resend, and `ALLOW_DEMO_MODE=false`.

See also [`docs/GO-LIVE.md`](GO-LIVE.md) for money-rails readiness (`assertMoneyRailsReady`, `/api/admin/golive`, health `rails` field).
