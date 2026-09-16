/**
 * Merchant upload diligence — keep CDSSA / Limitations Act risk with the creditor.
 */
const LIMITATIONS_ACT_YEARS = 2;
/** Soft ceiling to catch fee-pass-through / data errors (CAD $500,000). */
export const MAX_INVOICE_AMOUNT_CENTS = 50_000_000;

export function assertUploadDiligence(params: {
  dueDate: Date;
  amountCents: number;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  if (!Number.isFinite(params.amountCents) || params.amountCents <= 0) {
    throw new Error("Amount must be a positive integer (cents)");
  }
  if (params.amountCents > MAX_INVOICE_AMOUNT_CENTS) {
    throw new Error(
      `Amount exceeds platform maximum of $${(MAX_INVOICE_AMOUNT_CENTS / 100).toLocaleString("en-CA")} CAD`,
    );
  }

  const due = params.dueDate;
  if (!(due instanceof Date) || Number.isNaN(due.getTime())) {
    throw new Error("Valid due_date required");
  }
  if (due.getTime() > now.getTime()) {
    throw new Error("due_date must be in the past (past-due receivables only)");
  }

  const oldest = new Date(now);
  oldest.setFullYear(oldest.getFullYear() - LIMITATIONS_ACT_YEARS);
  if (due.getTime() < oldest.getTime()) {
    throw new Error(
      `due_date is older than ${LIMITATIONS_ACT_YEARS} years (Ontario Limitations Act diligence)`,
    );
  }
}
