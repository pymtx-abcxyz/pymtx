/** Earliest first debit: start of today (UTC day). */
export const CHECKOUT_START_MIN_OFFSET_DAYS = 0;
/** Latest first debit: 60 days from now (client cannot schedule far-future). */
export const CHECKOUT_START_MAX_OFFSET_DAYS = 60;

/**
 * Clamp client-supplied plan startDate into an allowed window.
 * Default remains ~10 days out when omitted / invalid.
 */
export function clampCheckoutStartDate(
  raw?: Date | string | null,
  now = new Date(),
): Date {
  const fallback = new Date(now.getTime() + 10 * 86400000);
  let candidate = fallback;
  if (raw != null) {
    const parsed = raw instanceof Date ? raw : new Date(raw);
    if (!Number.isNaN(parsed.getTime())) candidate = parsed;
  }

  const min = new Date(now);
  min.setUTCHours(0, 0, 0, 0);
  min.setUTCDate(min.getUTCDate() + CHECKOUT_START_MIN_OFFSET_DAYS);

  const max = new Date(
    now.getTime() + CHECKOUT_START_MAX_OFFSET_DAYS * 86400000,
  );

  if (candidate.getTime() < min.getTime()) return min;
  if (candidate.getTime() > max.getTime()) return max;
  return candidate;
}
