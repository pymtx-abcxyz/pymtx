# Path B / CDSSA / Rule H1 compliance guardrails

| Invariant | Enforcement |
|-----------|-------------|
| Zero custody Direct Charges | `assertConnectedAccountDirectCharge` + `assertNoDestinationChargePayload` in `chargeInstallment`; all PI/SetupIntent use `{ stripeAccount }` |
| No debtor fee surcharge | `buildInstallmentSchedule` sums exactly to principal; checkout preview no longer uses `Math.ceil` |
| NSF ≤1 / 30 days | `nsfRetryUsed` + platform window in `payments.ts` / debit job |
| Skip 180d + ≥3 Ontario business days | `skip-engine.ts`; POST `/api/skip` returns `400` + `SKIP_WINDOW_VIOLATION` |
| Ontario contact hours | `ontarioHours.ts` gates RECEIPT / NSF / SKIP / INVITE; deferred rows flush via Inngest `pymtx-deferred-notices` |
| Dispute freeze | Client portal `dispute` → `PaymentPlan.disputeFrozenAt`; debit job + `chargeInstallment` skip frozen plans |
| PAD cancel in portal | Client portal `cancel_pad` → `PadMandate.cancelledAt` + plan/installments `CANCELLED`; debt remains owed to merchant |
| PAD cancel copy | Agreement + confirmation emails: **thirty (30) calendar days** or portal cancel |
| Upload diligence | Past-due only; ≤2 years (Limitations Act); amount ceiling; CASL invite email sent (hour-gated) |
| Statutory naming | Emails/footers attribute **1001527397 ONTARIO INC.** + Whitby address; operating brand omitted from statutory disclosure text |

Provider: 1001527397 ONTARIO INC. · MB055-70 Taunton Rd E, Whitby, ON L1R 3L5 · info@pymtx.com
