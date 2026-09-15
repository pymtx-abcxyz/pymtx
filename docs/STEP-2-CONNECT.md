# Step 2 — Stripe Connect Onboarding

## Goal

Ontario SMB becomes **Merchant of Record** on Stripe Connect Express (Canada).
Pymtx never holds principal; Direct Charges land on the connected account with `application_fee_amount` only.

## Flow

1. Business registers (`POST /api/businesses`)
2. `POST /api/stripe/connect` `{ businessId, action: "onboard" }`
   - Creates Express account (`country: CA`)
   - Requests `acss_debit_payments`, `transfers`, `card_payments`
   - Returns AccountLink URL (or demo-ready status)
3. Business completes Stripe-hosted KYC / bank linking
4. Return URL → `POST /api/stripe/connect` `{ action: "sync" }`
5. Webhook `account.updated` keeps flags fresh

## Readiness

`readyForDebits` when:

- `stripeAccountId` present
- `stripeOnboardingComplete`
- `stripeChargesEnabled`

## Endpoints

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/stripe/connect?businessId=` | Status |
| POST | `/api/stripe/connect` | `onboard` \| `sync` \| `login` |
| POST | `/api/stripe/webhook` | `account.updated` + payment intents |

## UI

`/business/settings` — register + Connect status panel + Express Dashboard link

## Env

```
STRIPE_SECRET_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
STRIPE_WEBHOOK_SECRET=
```

Without a real secret key, Pymtx runs **demo mode** (marks Connect ready locally).

## Next

Step 3 — Client Checkout (plan + ACSS PAD mandate on the connected account)
