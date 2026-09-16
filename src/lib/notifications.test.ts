import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { createElement } from "react";
import { PadConfirmationEmail } from "@/emails/templates";
import { buildPadMandatePdf, pdfToBase64 } from "./pad-mandate-pdf";

describe("Rule H1 notification glue", () => {
  it("renders React Email PAD confirmation HTML", async () => {
    const html = await render(
      createElement(PadConfirmationEmail, {
        tradeName: "Maple Ridge Dental",
        invoiceRef: "INV-1",
        firstDebitDate: "2026-10-01",
        monthlyAmountCents: 20000,
        bankLast4: "4821",
      }),
    );
    expect(html).toContain("Personal PAD confirmation");
    expect(html).toContain("Maple Ridge Dental");
    expect(html).toContain("1001527397 ONTARIO INC.");
  });

  it("builds a Rule H1 PAD confirmation PDF", async () => {
    const bytes = await buildPadMandatePdf({
      tradeName: "Maple Ridge Dental",
      legalName: "Maple Ridge Dental Professional Corp.",
      payorEmail: "aisha.rahman@example.com",
      invoiceRef: "INV-88421",
      firstDebitDate: "2026-10-01",
      monthlyAmountCents: 20000,
      bankLast4: "4821",
      acceptedAt: new Date("2026-09-16T02:00:00Z"),
      ipAddress: "203.0.113.10",
      userAgent: "vitest",
    });
    expect(bytes.byteLength).toBeGreaterThan(500);
    expect(pdfToBase64(bytes).startsWith("JVBER")).toBe(true); // %PDF
  });
});
