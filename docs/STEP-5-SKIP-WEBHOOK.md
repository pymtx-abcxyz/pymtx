# Step 5 — Skip Engine Polish + Webhook NSF/Success Parity

## Skip engine

- Reads `PlatformSettings.skipNoticeBusinessDays` / `skipCooldownDays` (defaults 3 / 180)
- Blocks skip while any installment is `QUEUED` or `PROCESSING` (debit-job race)
- Re-validates eligibility inside the transaction (double-submit safe)
- Appends replacement installment (+1 month), writes `SkipRequest`, locks cooldown
- Records CASL `SKIP_CONFIRMATION` from the business trade name
- GET `/api/skip` returns richer eligibility (notice, cooldown, sequence)

## Settlement parity

`src/lib/settlement.ts` is the single success/failure path used by:

| Caller | Role |
|--------|------|
| `chargeInstallment` | Sync presentment / demo / immediate PI success or Stripe throw |
| `POST /api/stripe/webhook` | Async ACSS `payment_intent.succeeded` / `payment_failed` |

Shared behaviors:

- Idempotent success (no double invoice decrement / metrics)
- NSF detection (`insufficient_funds`, `debit_not_authorized`, message heuristics)
- DebitAttempt finalize (by attempt id, PI id, or latest PENDING)
- `originalPresentmentAt` anchor + `nsfRetryUsed` when a retry attempt fails or succeeds
- `maybeCompletePlan` after success

## Verify

```bash
npm run db:seed
npm test
```
