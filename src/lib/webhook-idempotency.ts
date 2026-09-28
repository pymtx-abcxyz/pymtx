/**
 * Orphan / unmatched webhook summaries — ack without writing StripeWebhookEvent
 * so Stripe can retry. Rebind rejects stay poison-pilled.
 */
export function shouldRecordWebhookIdempotency(summary: string | null): boolean {
  if (!summary) return true;
  if (summary.startsWith("rejected:")) return true;
  if (summary === "payment_intent without pymtx_installment_id") return false;
  if (summary === "payment_intent.processing without pymtx_installment_id") {
    return false;
  }
  if (summary === "account.updated unmatched") return false;
  return true;
}
