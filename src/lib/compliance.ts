import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  isBefore,
  startOfDay,
} from "date-fns";

/** Ontario business-day helper (excludes Sat/Sun; statutory holidays approximated as weekends-only for MVP). */
export function addBusinessDays(from: Date, days: number): Date {
  let cursor = startOfDay(from);
  let remaining = days;
  while (remaining > 0) {
    cursor = addDays(cursor, 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) remaining -= 1;
  }
  return cursor;
}

export function businessDaysUntil(from: Date, to: Date): number {
  const start = startOfDay(from);
  const end = startOfDay(to);
  if (!isBefore(start, end)) return 0;
  let count = 0;
  let cursor = start;
  while (isBefore(cursor, end)) {
    cursor = addDays(cursor, 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return count;
}

export function agingBucket(dueDate: Date, asOf = new Date()): string {
  const days = differenceInCalendarDays(asOf, dueDate);
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export function buildInstallmentSchedule(params: {
  totalCents: number;
  termMonths: 6 | 12 | 18;
  startDate: Date;
}): { sequence: number; dueDate: Date; amountCents: number }[] {
  const { totalCents, termMonths, startDate } = params;
  const base = Math.floor(totalCents / termMonths);
  const remainder = totalCents - base * termMonths;
  return Array.from({ length: termMonths }, (_, i) => ({
    sequence: i + 1,
    dueDate: addMonths(startDate, i),
    amountCents: base + (i === termMonths - 1 ? remainder : 0),
  }));
}

export function formatCad(cents: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

export function formatDate(d: Date | string): string {
  return format(typeof d === "string" ? new Date(d) : d, "d MMM yyyy");
}

/** Payments Canada Rule H1 Personal PAD — mandatory disclosure copy. */
export const PAD_RECOURSE_TERMS = `You have certain recourse rights if any debit does not comply with this agreement. For example, you have the right to receive reimbursement for any debit that is not authorized or is not consistent with this PAD Agreement. To obtain more information on your recourse rights, contact your financial institution or visit www.payments.ca.`;

export const PAD_CANCELLATION_TERMS = `You may revoke your authorization at any time, subject to providing notice of at least 10 days before the next scheduled debit. To obtain a sample cancellation form, or for more information on your right to cancel a PAD Agreement, contact your financial institution or visit www.payments.ca.`;

export const PAD_NSF_POLICY = `If a Pre-Authorized Debit is returned for Non-Sufficient Funds (NSF), Payments Canada Rule H1 permits a maximum of one (1) re-presentment within thirty (30) days of the original debit date.`;
