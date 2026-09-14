import { describe, expect, it } from "vitest";
import { isNsfFailure } from "./settlement";

describe("isNsfFailure", () => {
  it("detects Stripe insufficient_funds codes", () => {
    expect(isNsfFailure("insufficient_funds", null)).toBe(true);
    expect(isNsfFailure("card_declined", "Insufficient Funds")).toBe(true);
  });

  it("detects debit_not_authorized as NSF-class for PAD", () => {
    expect(isNsfFailure("debit_not_authorized", null)).toBe(true);
  });

  it("rejects unrelated failures", () => {
    expect(isNsfFailure("processing_error", "timeout")).toBe(false);
    expect(isNsfFailure(null, null)).toBe(false);
  });
});
