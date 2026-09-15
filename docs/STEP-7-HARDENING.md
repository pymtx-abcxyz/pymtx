# Step 7 — Hardening

## Privileged APIs (ADMIN session required)

| Route | Before | After |
|-------|--------|-------|
| `POST/GET /api/jobs/daily-debit` | Open | ADMIN |
| `POST /api/charges` | Open | ADMIN |
| `GET /api/admin/metrics` | Open | ADMIN |
| `POST /api/plans` | Open | ADMIN (legacy; clients use checkout) |

Client checkout / skip require the invite `token` and verify ownership.

## Webhooks

- Production refuses placeholder `STRIPE_WEBHOOK_SECRET` unless `ALLOW_DEMO_MODE=true`
- `StripeWebhookEvent` stores Stripe `event.id` for idempotent retries
- Handler failures do **not** write the idempotency row (Stripe can retry)

## Settlement

- `TransactionMetric.installmentId` is `@unique` (no double fee accounting)

## Auth

- Login rate limit: 10 attempts / 15 min per IP+email
- Login rotates sessions (one active session per user)

## HTTP

Security headers via `next.config.ts` (CSP, frame deny, nosniff, referrer, permissions).

## Ops

```bash
npm run db:seed
npm run smoke:hardening
npm run job:daily-debit   # authenticates as seeded admin, runs inline job
```

Demo still works locally. For production: set real Stripe keys and leave `ALLOW_DEMO_MODE` unset/false.
