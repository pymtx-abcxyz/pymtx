# Path B wiring — checkout, debits, webhooks, skip, notifications

## Routes (canonical + aliases)

| Concern | Canonical | Alias |
|---------|-----------|-------|
| PAD mandate audit + activate | `POST /api/pad-mandates/record` | `POST /api/checkout` `accept_pad` |
| Skip payment | `GET/POST /api/client/skip-payment` | `/api/skip` |
| Stripe Connect webhook | `POST /api/webhooks/stripe` | `/api/stripe/webhook` |
| Daily Direct Charges | Inngest `processDailyInstallments` | `runDailyDebitJob` |

## Webhook secret

`STRIPE_CONNECT_WEBHOOK_SECRET` preferred; falls back to `STRIPE_WEBHOOK_SECRET`.

Events: `payment_intent.processing`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`.

## Notifications (merchant From identity)

Resend when `EMAIL_PROVIDER=resend` + `RESEND_API_KEY`; always logged to `CaslMessage`.

HTML templates use **React Email** (`src/emails/templates.tsx`).

- PAD confirmation (Rule H1 written confirmation) + **PDF attachment** (`src/lib/pad-mandate-pdf.ts`)
- Monthly payment receipts
- NSF alerts (max 1 re-presentment within 30 days)
- Skip confirmation

## Zero-custody

Direct Charges only (`stripeAccount` + `application_fee_amount`). No Destination Charges / `transfer_data`.
