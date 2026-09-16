import { describe, expect, it } from "vitest";
import { passwordResetEmail } from "./email";
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
  });
});
