# Go-live lock & real money rails

## What “locked” means

With `NODE_ENV=production` and `ALLOW_DEMO_MODE` unset/`false`:

| Rail | Requirement |
|------|-------------|
| Stripe secret | Not placeholder (`sk_test_…` or `sk_live_…`) |
| Publishable | Not placeholder (`pk_test_…` or `pk_live_…`) |
| Webhooks | `STRIPE_CONNECT_WEBHOOK_SECRET` (preferred) or `STRIPE_WEBHOOK_SECRET` |
| Redis | `REDIS_URL` or `KV_URL` |
| Email | `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` + `EMAIL_FROM` |
| Inngest | `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` (daily ACSS presentment) |

Checkout, PAD accept, Direct Charges, and Inngest `processDailyInstallments` call `assertMoneyRailsReady` and **fail closed** when any of the above is missing under lock.

## What “live money” means

Set `REQUIRE_LIVE_STRIPE=true` only when charging real bank accounts:

- `STRIPE_SECRET_KEY=sk_live_…`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…` (and matching `STRIPE_PUBLISHABLE_KEY`)

Until then, test keys are allowed under lock (no placeholders, no demo settlement).

## Vercel checklist (production)

1. **Demo lock** — `ALLOW_DEMO_MODE=false` (or remove the var).
2. **Stripe Dashboard (Canada)**  
   - Live mode keys → paste into Vercel  
   - Connect webhook endpoint → `https://pymtx.com/api/webhooks/stripe`  
   - Events: `payment_intent.processing`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`  
   - Paste signing secret as `STRIPE_CONNECT_WEBHOOK_SECRET`
3. **Publishable** — replace any `pk_test_placeholder` with live/test `pk_…`
4. **Resend** — verify domain for `EMAIL_FROM`; set `RESEND_API_KEY`
5. **Redis / Inngest** — already expected for locked prod
6. **Redeploy** after env changes (Secrets do not hot-reload on all paths)

## Verify

```bash
curl -s https://pymtx.com/api/health
# → rails.locked, rails.readyForMoneyRails, rails.readyForLiveMoney,
#   rails.inngest, rails.connectWebhookDedicated, blockerCount

npm run ops:sanity
# → health + Inngest register + DebitJobRun / webhook / CASL coverage

# Admin session cookie required:
curl -s https://pymtx.com/api/admin/golive
```

## Stripe cutover (scripted)

From a machine that has your real keys (never commit them):

```bash
export STRIPE_SECRET_KEY=sk_test_…   # or sk_live_…
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…  # matching mode
export NEXT_PUBLIC_APP_URL=https://pymtx.com
export VERCEL_TOKEN=…               # for --apply-vercel
export VERCEL_ORG_ID=team_0E9QQc4gJv0zKV4Vt6OqspNy
export VERCEL_PROJECT_ID=prj_BYQ5OjJ9JmLNfRe7NJqKnaOgyf4t

npm run stripe:golive                 # validate + create Connect webhook
npm run stripe:golive -- --apply-vercel
# for live CAD PADs:
npm run stripe:golive -- --live-only --apply-vercel
```

Then redeploy production and confirm `curl -s https://pymtx.com/api/health` shows
`stripeSecret` / `stripePublishable` as `test` or `live` (not `placeholder`) and `webhook: ok`.

## First live Path B smoke

**Prerequisite:** Stripe Dashboard → [Connect](https://dashboard.stripe.com/test/connect) → complete platform profile (“Get started”). Without this, `accounts.create` fails and Path B Direct Charges cannot run.

```bash
npm run smoke:e2e
# or: BASE_URL=https://pymtx.com npm run smoke:e2e
```

Manual checklist:

1. Owner signs in → Connect Canadian bank until charges enabled (`POST /api/stripe/connect` `provision_test` in test, or Express `onboard` for live)  
2. Upload invoice / invite customer  
3. Customer completes PAD on `/client?token=…`  
4. Confirm PAD PDF email arrives (Resend)  
5. Wait for Toronto midnight Inngest job (or admin `POST /api/jobs/daily-debit`)  
6. Webhook settles installment → receipt email → `TransactionMetric` fee only
