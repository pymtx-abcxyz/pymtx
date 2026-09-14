import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  agingBucket,
  buildInstallmentSchedule,
  businessDaysUntil,
} from "./compliance";

describe("compliance helpers", () => {
  it("builds installment schedule that sums to total", () => {
    const schedule = buildInstallmentSchedule({
      totalCents: 10005,
      termMonths: 6,
      startDate: new Date("2026-10-01"),
    });
    expect(schedule).toHaveLength(6);
    expect(schedule.reduce((s, i) => s + i.amountCents, 0)).toBe(10005);
  });

  it("classifies aging buckets", () => {
    const asOf = new Date("2026-09-14");
    expect(agingBucket(new Date("2026-09-01"), asOf)).toBe("1-30");
    expect(agingBucket(new Date("2026-07-20"), asOf)).toBe("31-60");
    expect(agingBucket(new Date("2026-07-01"), asOf)).toBe("61-90");
    expect(agingBucket(new Date("2026-01-01"), asOf)).toBe("90+");
  });

  it("counts business days excluding weekends", () => {
    // Fri Sep 11 2026 -> Mon Sep 14 = 1 business day
    expect(businessDaysUntil(new Date("2026-09-11"), new Date("2026-09-14"))).toBe(1);
    const threeBiz = addBusinessDays(new Date("2026-09-11"), 3);
    expect(threeBiz.toISOString().slice(0, 10)).toBe("2026-09-16");
  });
});
