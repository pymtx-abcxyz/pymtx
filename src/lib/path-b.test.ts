import { describe, expect, it } from "vitest";
import { buildInstallmentSchedule } from "./compliance";
import {
  isOntarioContactHour,
  isOntarioStatutoryHoliday,
  ontarioContactWindow,
  ontarioHolidayKeys,
  ontarioLocalToUtc,
} from "./compliance/ontarioHours";
import {
  assertConnectedAccountDirectCharge,
  assertNoDestinationChargePayload,
} from "./path-b";

describe("CDSSA / Path B guardrails", () => {
  it("installment schedules never exceed principal (no debtor surcharge)", () => {
    for (const total of [180000, 10005, 1, 17, 99999]) {
      for (const months of [6, 12, 18] as const) {
        const schedule = buildInstallmentSchedule({
          totalCents: total,
          termMonths: months,
          startDate: new Date("2026-10-01"),
        });
        expect(schedule).toHaveLength(months);
        expect(schedule.reduce((s, i) => s + i.amountCents, 0)).toBe(total);
      }
    }
  });

  it("rejects Destination Charge shaped payloads", () => {
    expect(() =>
      assertNoDestinationChargePayload(
        { transfer_data: { destination: "acct_x" } },
        "test",
      ),
    ).toThrow(/transfer_data/);
    expect(() =>
      assertConnectedAccountDirectCharge(null, "test"),
    ).toThrow(/stripeAccount/);
    assertConnectedAccountDirectCharge("acct_demo_maple", "test");
  });

  it("blocks Ontario statutory holidays and allows weekday contact hours", () => {
    // Christmas 2026 is Friday — holiday
    const xmas = ontarioLocalToUtc({
      year: 2026,
      month: 12,
      day: 25,
      hour: 12,
    });
    expect(isOntarioStatutoryHoliday(xmas)).toBe(true);
    expect(ontarioContactWindow(xmas).allowed).toBe(false);

    // Wednesday 2026-09-16 10:00 ET — inside window
    const wed = ontarioLocalToUtc({
      year: 2026,
      month: 9,
      day: 16,
      hour: 10,
    });
    expect(isOntarioContactHour(wed)).toBe(true);

    // Wednesday 22:00 ET — outside
    const late = ontarioLocalToUtc({
      year: 2026,
      month: 9,
      day: 16,
      hour: 22,
    });
    expect(isOntarioContactHour(late)).toBe(false);

    // Sunday 14:00 ET — allowed; Sunday 10:00 — blocked
    const sunOk = ontarioLocalToUtc({
      year: 2026,
      month: 9,
      day: 20,
      hour: 14,
    });
    const sunBad = ontarioLocalToUtc({
      year: 2026,
      month: 9,
      day: 20,
      hour: 10,
    });
    expect(isOntarioContactHour(sunOk)).toBe(true);
    expect(isOntarioContactHour(sunBad)).toBe(false);

    expect(ontarioHolidayKeys(2026).has("2026-12-25")).toBe(true);
  });
});
