import { describe, expect, it } from "vitest";
import {
  CHECKOUT_START_MAX_OFFSET_DAYS,
  clampCheckoutStartDate,
} from "./checkout-start";

describe("clampCheckoutStartDate", () => {
  const now = new Date("2026-09-18T15:00:00.000Z");

  it("defaults to ~10 days out when omitted", () => {
    const d = clampCheckoutStartDate(undefined, now);
    expect(d.toISOString().slice(0, 10)).toBe("2026-09-28");
  });

  it("clamps past dates up to start of today UTC", () => {
    const d = clampCheckoutStartDate(new Date("2020-01-01"), now);
    expect(d.toISOString()).toBe("2026-09-18T00:00:00.000Z");
  });

  it("clamps far-future dates to max window", () => {
    const d = clampCheckoutStartDate(new Date("2030-01-01"), now);
    const max = new Date(
      now.getTime() + CHECKOUT_START_MAX_OFFSET_DAYS * 86400000,
    );
    expect(d.getTime()).toBe(max.getTime());
  });

  it("passes through dates inside the window", () => {
    const mid = new Date("2026-09-25T12:00:00.000Z");
    expect(clampCheckoutStartDate(mid, now).toISOString()).toBe(
      mid.toISOString(),
    );
  });
});
