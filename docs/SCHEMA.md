# Harbor Database Schema

Step 1 of the Ontario B2C AR settlement implementation.

## Design principles

1. **Zero custody** — Harbor never stores bank account numbers or holds principal. Stripe Connect Direct Charges send funds to the business connected account; Harbor only records `applicationFeeCents`.
2. **Business = Merchant of Record** — `Business.stripeAccountId` is the charge destination.
3. **Rule H1 PAD** — `PadMandate` freezes recourse/cancellation text; `padWrittenConfirmSentAt` must be set before first debit.
4. **Inngest-ready** — `Installment @@index([status, dueDate])` + `DebitJobRun` audit table + `idempotencyKey` on each installment.
5. **CASL white-label** — `CaslMessage` logs outbound mail under the business trade name.

## Entity map

| Model | Role |
|-------|------|
| `PlatformSettings` | Fee bps, skip notice/cooldown, NSF retry limits |
| `Business` | Creditor + Connect account flags |
| `Customer` | Debtor + invite token |
| `Invoice` | Past-due receivable + aging bucket |
| `PaymentPlan` | 6/12/18-month plan + Stripe customer/PM/mandate ids |
| `PadMandate` | Rule H1 Personal PAD acceptance audit |
| `Installment` | Monthly debit row (schedule / skip / NSF) |
| `SkipRequest` | Skip privilege audit (≥3 business days, 180-day cooldown) |
| `DebitAttempt` | Per-presentment ledger (PRESENTMENT \| NSF_RETRY) |
| `DebitJobRun` | Daily debit job run audit |
| `CaslMessage` | White-labeled outbound message log |
| `TransactionMetric` | Platform take-rate metrics only |

## Status enums

See `src/lib/domain.ts` — string values must stay in sync with comments in `prisma/schema.prisma`.

## Apply locally

```bash
npx prisma db push
npm run db:seed
```

## Next steps

2. Stripe Connect Onboarding  
3. Client Checkout Page  
4. Inngest Daily Recurring Job  
