/**
 * Canonical domain enums — values MUST match prisma/schema.prisma comments.
 */

export const BusinessStatus = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  CLOSED: "CLOSED",
} as const;
export type BusinessStatus = (typeof BusinessStatus)[keyof typeof BusinessStatus];

export const InvoiceStatus = {
  PAST_DUE: "PAST_DUE",
  INVITED: "INVITED",
  PLAN_ACTIVE: "PLAN_ACTIVE",
  SETTLED: "SETTLED",
  WRITTEN_OFF: "WRITTEN_OFF",
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const AgingBucket = {
  D1_30: "1-30",
  D31_60: "31-60",
  D61_90: "61-90",
  D90_PLUS: "90+",
} as const;
export type AgingBucket = (typeof AgingBucket)[keyof typeof AgingBucket];

export const PlanTermMonths = [6, 12, 18] as const;
export type PlanTermMonths = (typeof PlanTermMonths)[number];

export const PaymentPlanStatus = {
  PENDING_MANDATE: "PENDING_MANDATE",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  DEFAULTED: "DEFAULTED",
  CANCELLED: "CANCELLED",
} as const;
export type PaymentPlanStatus =
  (typeof PaymentPlanStatus)[keyof typeof PaymentPlanStatus];

export const InstallmentStatus = {
  SCHEDULED: "SCHEDULED",
  SKIPPED: "SKIPPED",
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  SUCCEEDED: "SUCCEEDED",
  FAILED_NSF: "FAILED_NSF",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type InstallmentStatus =
  (typeof InstallmentStatus)[keyof typeof InstallmentStatus];

export const SkipRequestStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type SkipRequestStatus =
  (typeof SkipRequestStatus)[keyof typeof SkipRequestStatus];

export const DebitAttemptKind = {
  PRESENTMENT: "PRESENTMENT",
  NSF_RETRY: "NSF_RETRY",
} as const;
export type DebitAttemptKind =
  (typeof DebitAttemptKind)[keyof typeof DebitAttemptKind];

export const DebitAttemptStatus = {
  PENDING: "PENDING",
  SUCCEEDED: "SUCCEEDED",
  FAILED_NSF: "FAILED_NSF",
  FAILED: "FAILED",
} as const;
export type DebitAttemptStatus =
  (typeof DebitAttemptStatus)[keyof typeof DebitAttemptStatus];

export const DebitJobRunStatus = {
  RUNNING: "RUNNING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  PARTIAL: "PARTIAL",
} as const;
export type DebitJobRunStatus =
  (typeof DebitJobRunStatus)[keyof typeof DebitJobRunStatus];

export const CaslMessageKind = {
  INVITE: "INVITE",
  PAD_CONFIRMATION: "PAD_CONFIRMATION",
  RECEIPT: "RECEIPT",
  SKIP_CONFIRMATION: "SKIP_CONFIRMATION",
} as const;
export type CaslMessageKind =
  (typeof CaslMessageKind)[keyof typeof CaslMessageKind];

export const PadMandateType = {
  PERSONAL_PAD: "PERSONAL_PAD",
} as const;
export type PadMandateType = (typeof PadMandateType)[keyof typeof PadMandateType];
