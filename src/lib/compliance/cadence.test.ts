import { describe, expect, it } from "vitest";
import {
  evaluateContactCadence,
  isCadenceCountingKind,
  isCommunicationPauseExempt,
  publicInvoiceLabel,
  CDSSA_CONTACT_CAP,
} from "./cadence";
import { CaslMessageKind } from "../domain";
import { ontarioLocalToUtc } from "./ontarioHours";

describe("CDSSA contact cadence", () => {
  it("allows under the 3/7 cap", () => {
    const asOf = ontarioLocalToUtc({
      year: 2026,
      month: 9,
      day: 16,
      hour: 12,
    });
    const result = evaluateContactCadence({
      recentSentAts: [
        new Date(asOf.getTime() - 2 * 86400000),
        new Date(asOf.getTime() - 1 * 86400000),
      ],
      asOf,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.used).toBe(2);
  });

  it("blocks a fourth counting contact inside 7 days", () => {
    const asOf = ontarioLocalToUtc({
      year: 2026,
      month: 9,
      day: 16,
      hour: 12,
    });
    const oldest = new Date(asOf.getTime() - 3 * 86400000);
    const result = evaluateContactCadence({
      recentSentAts: [
        oldest,
        new Date(asOf.getTime() - 2 * 86400000),
        new Date(asOf.getTime() - 1 * 86400000),
      ],
      asOf,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.used).toBe(CDSSA_CONTACT_CAP);
      expect(result.nextAllowedAt.getTime()).toBeGreaterThan(asOf.getTime());
    }
  });

  it("classifies cadence and pause exemptions", () => {
    expect(isCadenceCountingKind(CaslMessageKind.INVITE)).toBe(true);
    expect(isCadenceCountingKind(CaslMessageKind.PAD_CONFIRMATION)).toBe(false);
    expect(isCommunicationPauseExempt(CaslMessageKind.MAGIC_LINK)).toBe(true);
    expect(isCommunicationPauseExempt(CaslMessageKind.NSF_ALERT)).toBe(false);
  });

  it("never echoes clinical free-text on the debtor surface", () => {
    expect(publicInvoiceLabel("Orthodontic treatment balance")).toBe(
      "Past-due account balance",
    );
    expect(publicInvoiceLabel(null)).toBe("Past-due account balance");
  });
});
