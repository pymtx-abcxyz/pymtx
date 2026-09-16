import { describe, expect, it } from "vitest";
import {
  assertUploadDiligence,
  MAX_INVOICE_AMOUNT_CENTS,
} from "./upload-diligence";

describe("upload diligence", () => {
  const now = new Date("2026-09-16T12:00:00Z");

  it("accepts a recent past-due invoice", () => {
    expect(() =>
      assertUploadDiligence({
        dueDate: new Date("2026-06-01T00:00:00Z"),
        amountCents: 125_000,
        now,
      }),
    ).not.toThrow();
  });

  it("rejects future due dates", () => {
    expect(() =>
      assertUploadDiligence({
        dueDate: new Date("2026-12-01T00:00:00Z"),
        amountCents: 10_000,
        now,
      }),
    ).toThrow(/past/);
  });

  it("rejects Limitations Act-stale due dates", () => {
    expect(() =>
      assertUploadDiligence({
        dueDate: new Date("2023-01-01T00:00:00Z"),
        amountCents: 10_000,
        now,
      }),
    ).toThrow(/Limitations Act/);
  });

  it("rejects oversized amounts", () => {
    expect(() =>
      assertUploadDiligence({
        dueDate: new Date("2026-06-01T00:00:00Z"),
        amountCents: MAX_INVOICE_AMOUNT_CENTS + 1,
        now,
      }),
    ).toThrow(/maximum/);
  });
});
