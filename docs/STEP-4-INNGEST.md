# Step 4 — Inngest Daily Debit Job

## Goal

Every day at midnight (America/Toronto), present due ACSS Debits as **Direct Charges** on each business’s Connect account. Pymtx never holds principal.

## What runs

1. Scan `Installment` where `status ∈ {SCHEDULED, QUEUED}` and `dueDate ≤ today`
2. Include `FAILED_NSF` rows eligible for Rule H1 retry (max 1, within `nsfRetryWindowDays`)
3. Require plan `ACTIVE` + `padWrittenConfirmSentAt` + `stripePaymentMethodId`
4. `chargeInstallment` → PaymentIntent on connected account with `application_fee_amount`
5. Write `DebitJobRun` audit (one row per calendar day; SUCCEEDED is idempotent)

## Endpoints

| Path | Purpose |
|------|---------|
| `/api/inngest` | Inngest serve (cron + events) |
| `GET /api/jobs/daily-debit` | List recent job runs |
| `POST /api/jobs/daily-debit` | `{ "mode": "inline" }` run now (demo) or `{ "mode": "inngest" }` enqueue |

## Local Inngest

```bash
npm run dev
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Cron: `TZ=America/Toronto 0 0 * * *`  
Event: `pymtx/debits.run`

## Demo without Inngest Cloud

```bash
curl -X POST http://localhost:3000/api/jobs/daily-debit \
  -H 'Content-Type: application/json' \
  -d '{"mode":"inline"}'
```

## Env (optional for Cloud)

```
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```
