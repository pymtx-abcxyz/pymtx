import { describe, expect, it } from "vitest";
import { inviteEmail, passwordResetEmail } from "./email";
import { assertPasswordStrength } from "./password-reset";
import { MIN_PASSWORD_LENGTH } from "./auth";

describe("password reset helpers", () => {
  it("rejects short passwords", () => {
    expect(() => assertPasswordStrength("short")).toThrow(
      new RegExp(String(MIN_PASSWORD_LENGTH)),
    );
  });

  it("accepts passwords meeting minimum length", () => {
    expect(() => assertPasswordStrength("longenough")).not.toThrow();
  });

  it("builds a branded reset email", () => {
    const mail = passwordResetEmail({
      name: "Alex",
      url: "https://pymtx.com/reset-password?token=abc",
      minutes: 30,
    });
    expect(mail.subject.toLowerCase()).toContain("password");
    expect(mail.text).toContain("https://pymtx.com/reset-password?token=abc");
    expect(mail.html).toContain("Choose a new password");
    expect(mail.html).toContain("#3b5b53");
    expect(mail.text).toContain("pymtx · info@pymtx.com");
  });
});

describe("invite email CTA", () => {
  it("uses action-primary for the plan link button", () => {
    const mail = inviteEmail({
      tradeName: "Maple Ridge Dental",
      firstName: "Aisha",
      invoiceRef: "INV-2",
      amountCents: 180000,
      inviteUrl: "https://pymtx.com/client?token=abc",
    });
    expect(mail.html).toContain("#3b5b53");
    expect(mail.html).toContain("Open secure plan link");
    expect(mail.html).not.toMatch(/background:#202b31/);
  });
});
