import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  parseAmountToCents,
  parseInvoiceCsv,
} from "./invoice-upload";

describe("parseAmountToCents", () => {
  it("parses dollar amounts with decimals", () => {
    expect(parseAmountToCents("850.00")).toBe(85000);
    expect(parseAmountToCents("$1,250.50")).toBe(125050);
  });

  it("parses integer cents", () => {
    expect(parseAmountToCents("125000")).toBe(125000);
  });
});

describe("parseInvoiceCsv", () => {
  it("parses a valid CSV with header aliases", () => {
    const csv = `external_ref,description,amount,due_date,first_name,last_name,email,phone
INV-1,Cleaning,850.00,2026-06-01,Nora,Singh,nora@example.com,+1-416-555-0100
INV-2,Crown,240050,2026-05-15,Marcus,Lee,marcus@example.com,`;
    const { rows, errors } = parseInvoiceCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0].externalRef).toBe("INV-1");
    expect(rows[0].amountCents).toBe(85000);
    expect(rows[0].customer.email).toBe("nora@example.com");
    expect(rows[1].amountCents).toBe(240050);
  });

  it("reports missing columns", () => {
    const { rows, errors } = parseInvoiceCsv("a,b\n1,2");
    expect(rows).toHaveLength(0);
    expect(errors[0]?.message).toMatch(/Missing required columns/i);
  });

  it("rejects oversized CSV payloads", () => {
    const huge = "x".repeat(MAX_UPLOAD_BYTES + 1);
    const { rows, errors } = parseInvoiceCsv(huge);
    expect(rows).toHaveLength(0);
    expect(errors[0]?.message).toMatch(/maximum size/i);
  });
});
