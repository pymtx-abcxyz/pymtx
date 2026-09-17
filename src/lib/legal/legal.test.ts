import { describe, expect, it } from "vitest";
import {
  SAAS_AGREEMENT_VERSION,
  renderPadAgreement,
  renderSettlementTerms,
  saasAgreementPlainText,
  privacyPolicyPlainText,
} from "./index";

describe("Ontario legal documents", () => {
  it("embeds Path B / CDSSA insulation language in SaaS agreement", () => {
    const text = saasAgreementPlainText();
    expect(text).toContain("1001527397 ONTARIO INC.");
    expect(text).toContain("Zero Legal Custody");
    expect(text).toContain("application_fee_amount");
    expect(text).toContain(SAAS_AGREEMENT_VERSION);
  });

  it("renders Rule H1 PAD with skip / pre-notification / 30-day cancel", () => {
    const pad = renderPadAgreement({
      customerFullName: "Aisha Rahman",
      customerAddress: "Toronto, Ontario, Canada",
      customerEmail: "aisha.rahman@example.com",
      merchantLegalName: "Maple Ridge Dental Professional Corp.",
      merchantPhysicalAddress: "Whitby, Ontario, Canada",
      merchantSupportEmail: "billing@mapleridgedental.example",
      merchantPhone: "905-555-0100",
      fiNumber: "004",
      transitNumber: "12345",
      accountLast4: "4821",
      totalPrincipalCad: "$1,800.00",
      tenureMonths: 12,
      monthlyInstallmentCad: "$200.00",
      firstDebitDate: "2026-10-01",
      dayOfMonth: 1,
    });
    expect(pad).toContain("PRE-AUTHORIZED DEBIT");
    expect(pad).toContain("180 calendar days");
    expect(pad).toContain("three (3) business days");
    expect(pad).toContain("thirty (30) calendar days");
    expect(pad).toContain("www.payments.ca");
  });

  it("discloses 0% APR settlement terms under CPA", () => {
    const terms = renderSettlementTerms({
      merchantLegalName: "Maple Ridge Dental Professional Corp.",
      customerFullName: "Aisha Rahman",
      totalInvoiceBalanceCad: "$1,800.00",
      monthlyAmountCad: "$200.00",
      tenureMonths: 12,
    });
    expect(terms).toContain("0.00%");
    expect(terms).toContain("$0.00 CAD");
    expect(terms).toContain("Limitations Act, 2002");
  });

  it("includes CASL / PIPEDA attribution and email-only notice channels", () => {
    const privacy = privacyPolicyPlainText();
    expect(privacy).toContain("CASL");
    expect(privacy).toContain("PIPEDA");
    expect(privacy).toContain("info@pymtx.com");
    expect(privacy).toContain("does not send SMS");
    expect(privacy).toContain("three (3) counting contacts");
  });
});
