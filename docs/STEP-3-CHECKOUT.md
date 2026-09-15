# Step 3 — Client Checkout

## Goal

Consumer settles a past-due invoice via 6/12/18-month ACSS Debit (Personal PAD) on the **creditor’s** Stripe Connect account (Direct Charges). Pymtx never holds principal.

## Flow

1. Open `/client?token=<inviteToken>`
2. `GET /api/checkout?token=` — balance, plan options, Connect readiness
3. Choose term → `POST { action: "create_plan" }` → plan `PENDING_MANDATE`
4. Accept Rule H1 PAD → `POST { action: "accept_pad" }`
   - Creates ACSS Debit PaymentMethod + SetupIntent on connected account (or demo ids)
   - Stores `PadMandate` with frozen H1 recourse/cancellation text
   - Sends CASL white-labeled written confirmation (`CaslMessage` from business trade name)
   - Activates plan (`ACTIVE`) before any debit

## Guards

- Creditor must have `stripeOnboardingComplete` + `stripeChargesEnabled`
- One open plan per invoice
- Written confirmation timestamp (`padWrittenConfirmSentAt`) set before first debit

## Skip (post-activation)

`POST /api/skip` — ≥3 business days’ notice, appends month to end, 180-day cooldown.

## Demo

With placeholder Stripe keys, bank details last-4 + institution are enough; full transit/institution/account numbers are required only for live ACSS setup.

## Next

Step 4 — Inngest daily debit job (present SCHEDULED installments due today).
