/**
 * Human-readable labels + StatusPill tones for domain enums.
 * Presentation only — does not change stored values.
 */

export type StatusTone = "default" | "success" | "warning" | "danger";

const INVOICE_STATUS_LABEL: Record<string, string> = {
  PAST_DUE: "Past due",
  INVITED: "Invited",
  PLAN_ACTIVE: "Plan active",
  SETTLED: "Settled",
  WRITTEN_OFF: "Written off",
};

const INVOICE_STATUS_TONE: Record<string, StatusTone> = {
  PAST_DUE: "warning",
  INVITED: "default",
  PLAN_ACTIVE: "success",
  SETTLED: "success",
  WRITTEN_OFF: "danger",
};

const AGING_LABEL: Record<string, string> = {
  "1-30": "1–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "90+ days",
};

/** Stable order for aging rollups. */
export const AGING_BUCKET_ORDER = ["1-30", "31-60", "61-90", "90+"] as const;

const INSTALLMENT_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Scheduled",
  SKIPPED: "Skipped",
  QUEUED: "Queued",
  PROCESSING: "Processing",
  SUCCEEDED: "Paid",
  FAILED_NSF: "NSF failed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const INSTALLMENT_STATUS_TONE: Record<string, StatusTone> = {
  SCHEDULED: "default",
  SKIPPED: "warning",
  QUEUED: "default",
  PROCESSING: "default",
  SUCCEEDED: "success",
  FAILED_NSF: "danger",
  FAILED: "danger",
  CANCELLED: "default",
};

const DEBIT_JOB_STATUS_TONE: Record<string, StatusTone> = {
  RUNNING: "default",
  SUCCEEDED: "success",
  FAILED: "danger",
  PARTIAL: "warning",
};

function humanizeFallback(raw: string) {
  return raw
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function invoiceStatusLabel(status: string) {
  return INVOICE_STATUS_LABEL[status] ?? humanizeFallback(status);
}

export function invoiceStatusTone(status: string): StatusTone {
  return INVOICE_STATUS_TONE[status] ?? "default";
}

export function agingBucketLabel(bucket: string) {
  return AGING_LABEL[bucket] ?? bucket;
}

export function installmentStatusLabel(status: string) {
  return INSTALLMENT_STATUS_LABEL[status] ?? humanizeFallback(status);
}

export function installmentStatusTone(status: string): StatusTone {
  return INSTALLMENT_STATUS_TONE[status] ?? "default";
}

export function debitJobStatusTone(status: string): StatusTone {
  return DEBIT_JOB_STATUS_TONE[status] ?? "default";
}

export function debitJobStatusLabel(status: string) {
  return humanizeFallback(status);
}

/** Friendly id for goLiveReport().checks[].id */
export function goLiveCheckLabel(id: string) {
  const map: Record<string, string> = {
    demo_locked: "Demo lock",
    stripe_secret: "Stripe secret",
    stripe_publishable: "Publishable key",
    stripe_webhook: "Webhook secret",
    redis: "Redis",
    email: "Email",
    inngest: "Inngest",
    app_url: "App URL",
    live_stripe: "Live Stripe",
  };
  return map[id] ?? humanizeFallback(id);
}
