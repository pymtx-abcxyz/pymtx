/**
 * Ontario CDSSA contact windows for automated debtor communications.
 *
 * Legal hours (America/Toronto):
 * - Mon–Sat: 07:00 – 21:00
 * - Sunday: 13:00 – 17:00
 * - Ontario statutory holidays: blocked
 */

export const ONTARIO_TZ = "America/Toronto";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
};

const WEEKDAY_TO_DOW: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function zonedPartsInOntario(instant: Date): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: ONTARIO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(instant).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: parts.weekday,
  };
}

function ymd(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number,
): { year: number; month: number; day: number } {
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCMonth() !== month - 1) break;
    if (d.getUTCDay() === weekday) {
      count += 1;
      if (count === n) return { year, month, day };
    }
  }
  throw new Error(`nthWeekday failed ${year}-${month}`);
}

function easterSunday(year: number): { year: number; month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { year, month, day };
}

function addUtcDays(
  parts: { year: number; month: number; day: number },
  days: number,
) {
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  d.setUTCDate(d.getUTCDate() + days);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function observedIfWeekend(parts: { year: number; month: number; day: number }) {
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const wd = d.getUTCDay();
  if (wd === 0) return addUtcDays(parts, 1);
  if (wd === 6) return addUtcDays(parts, 2);
  return parts;
}

/** Ontario holiday date keys (yyyy-MM-dd) for a calendar year. */
export function ontarioHolidayKeys(year: number): Set<string> {
  const keys = new Set<string>();
  const add = (p: { year: number; month: number; day: number }) =>
    keys.add(ymd(p.year, p.month, p.day));

  add(observedIfWeekend({ year, month: 1, day: 1 }));
  add(nthWeekdayOfMonth(year, 2, 1, 3)); // Family Day
  add(addUtcDays(easterSunday(year), -2)); // Good Friday
  {
    let d = new Date(Date.UTC(year, 4, 24));
    while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() - 1);
    add({
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
    });
  }
  add(observedIfWeekend({ year, month: 7, day: 1 }));
  add(nthWeekdayOfMonth(year, 8, 1, 1));
  add(nthWeekdayOfMonth(year, 9, 1, 1));
  add(nthWeekdayOfMonth(year, 10, 1, 2));
  add(observedIfWeekend({ year, month: 12, day: 25 }));
  add(observedIfWeekend({ year, month: 12, day: 26 }));
  return keys;
}

export function isOntarioStatutoryHoliday(instant: Date = new Date()): boolean {
  const z = zonedPartsInOntario(instant);
  const key = ymd(z.year, z.month, z.day);
  return (
    ontarioHolidayKeys(z.year).has(key) ||
    ontarioHolidayKeys(z.year - 1).has(key) ||
    ontarioHolidayKeys(z.year + 1).has(key)
  );
}

function localLabel(z: ZonedParts) {
  return `${ymd(z.year, z.month, z.day)} ${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")} ET`;
}

/** Ontario local wall clock → UTC Instant (DST-safe iterative correction). */
export function ontarioLocalToUtc(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
}): Date {
  let guess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute ?? 0,
    0,
  );
  for (let i = 0; i < 4; i++) {
    const z = zonedPartsInOntario(new Date(guess));
    const asLocalMs = Date.UTC(
      z.year,
      z.month - 1,
      z.day,
      z.hour,
      z.minute,
      z.second,
    );
    const wantMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute ?? 0,
      0,
    );
    guess += wantMs - asLocalMs;
  }
  return new Date(guess);
}

type BlockReason = "holiday" | "sunday_outside_window" | "weekday_outside_window";

function evaluateWindow(instant: Date): {
  allowed: boolean;
  reason?: BlockReason;
  localTime: string;
  z: ZonedParts;
  dow: number;
  minutes: number;
} {
  const z = zonedPartsInOntario(instant);
  const localTime = localLabel(z);
  const dow = WEEKDAY_TO_DOW[z.weekday] ?? 0;
  const minutes = z.hour * 60 + z.minute;

  if (isOntarioStatutoryHoliday(instant)) {
    return { allowed: false, reason: "holiday", localTime, z, dow, minutes };
  }
  if (dow === 0) {
    if (minutes >= 13 * 60 && minutes < 17 * 60) {
      return { allowed: true, localTime, z, dow, minutes };
    }
    return {
      allowed: false,
      reason: "sunday_outside_window",
      localTime,
      z,
      dow,
      minutes,
    };
  }
  if (minutes >= 7 * 60 && minutes < 21 * 60) {
    return { allowed: true, localTime, z, dow, minutes };
  }
  return {
    allowed: false,
    reason: "weekday_outside_window",
    localTime,
    z,
    dow,
    minutes,
  };
}

export function nextOntarioContactSlot(instant: Date = new Date()): Date {
  let cursor = new Date(instant.getTime() + 60_000);
  for (let step = 0; step < 40_000; step++) {
    const evald = evaluateWindow(cursor);
    if (evald.allowed) return cursor;

    const { z, dow, minutes } = evald;
    if (evald.reason === "holiday" || minutes >= (dow === 0 ? 17 * 60 : 21 * 60)) {
      const next = addUtcDays({ year: z.year, month: z.month, day: z.day }, 1);
      const noon = ontarioLocalToUtc({
        year: next.year,
        month: next.month,
        day: next.day,
        hour: 12,
      });
      const nextDow =
        WEEKDAY_TO_DOW[zonedPartsInOntario(noon).weekday] ?? 0;
      cursor = ontarioLocalToUtc({
        year: next.year,
        month: next.month,
        day: next.day,
        hour: nextDow === 0 ? 13 : 7,
        minute: 0,
      });
      continue;
    }
    if (dow === 0 && minutes < 13 * 60) {
      cursor = ontarioLocalToUtc({
        year: z.year,
        month: z.month,
        day: z.day,
        hour: 13,
        minute: 0,
      });
      continue;
    }
    if (dow !== 0 && minutes < 7 * 60) {
      cursor = ontarioLocalToUtc({
        year: z.year,
        month: z.month,
        day: z.day,
        hour: 7,
        minute: 0,
      });
      continue;
    }
    cursor = new Date(cursor.getTime() + 60_000);
  }
  return new Date(instant.getTime() + 24 * 60 * 60 * 1000);
}

export type OntarioContactWindowResult =
  | { allowed: true; localTime: string }
  | {
      allowed: false;
      reason: BlockReason;
      nextAllowedAt: Date;
      localTime: string;
    };

export function ontarioContactWindow(
  instant: Date = new Date(),
): OntarioContactWindowResult {
  const evald = evaluateWindow(instant);
  if (evald.allowed) return { allowed: true, localTime: evald.localTime };
  return {
    allowed: false,
    reason: evald.reason!,
    nextAllowedAt: nextOntarioContactSlot(instant),
    localTime: evald.localTime,
  };
}

export function isOntarioContactHour(instant: Date = new Date()): boolean {
  return evaluateWindow(instant).allowed;
}

/**
 * Soft gate: returns whether send may proceed now.
 * Prefer this over throwing inside background jobs so debits still settle.
 */
export function gateOntarioDebtorNotice(context: string, instant = new Date()) {
  const window = ontarioContactWindow(instant);
  if (window.allowed) return { ok: true as const, localTime: window.localTime };
  console.warn(
    `[cdssa-hours] ${context} deferred: ${window.reason}; next ${window.nextAllowedAt.toISOString()} (${window.localTime})`,
  );
  return {
    ok: false as const,
    reason: window.reason,
    nextAllowedAt: window.nextAllowedAt,
    localTime: window.localTime,
  };
}

export function assertOntarioContactWindow(
  context: string,
  instant: Date = new Date(),
) {
  const gate = gateOntarioDebtorNotice(context, instant);
  if (!gate.ok) {
    throw new Error(
      `${context}: blocked outside Ontario CDSSA contact hours (${gate.reason}; next ${gate.nextAllowedAt.toISOString()})`,
    );
  }
}
