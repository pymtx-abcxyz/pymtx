/**
 * Ontario CDSSA contact cadence — max 3 automated debtor contacts per 7 days.
 * Magic-link auth and Rule H1 PAD written confirmation are exempt.
 */
import { CaslMessageKind } from "../domain";
import { nextOntarioContactSlot } from "./ontarioHours";

export const CDSSA_CONTACT_CAP = 3;
export const CDSSA_CONTACT_WINDOW_DAYS = 7;

/** Kinds that count toward the 3/7 CDSSA contact cap. */
export const CADENCE_COUNTING_KINDS = new Set<string>([
  CaslMessageKind.INVITE,
  CaslMessageKind.RECEIPT,
  CaslMessageKind.NSF_ALERT,
  CaslMessageKind.SKIP_CONFIRMATION,
]);

/** Kinds allowed through a communication pause (auth / statutory PAD confirm). */
export const COMMUNICATION_PAUSE_EXEMPT = new Set<string>([
  CaslMessageKind.MAGIC_LINK,
]);

export function isCadenceCountingKind(kind: string): boolean {
  return CADENCE_COUNTING_KINDS.has(kind);
}

export function isCommunicationPauseExempt(kind: string): boolean {
  return COMMUNICATION_PAUSE_EXEMPT.has(kind);
}

/**
 * Given sentAt timestamps of counting contacts in the rolling window,
 * return whether another contact may go out now, or when the oldest falls off.
 */
export function evaluateContactCadence(params: {
  recentSentAts: Date[];
  asOf?: Date;
  cap?: number;
  windowDays?: number;
}):
  | { ok: true; used: number; cap: number }
  | { ok: false; used: number; cap: number; nextAllowedAt: Date } {
  const asOf = params.asOf ?? new Date();
  const cap = params.cap ?? CDSSA_CONTACT_CAP;
  const windowDays = params.windowDays ?? CDSSA_CONTACT_WINDOW_DAYS;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const windowStart = asOf.getTime() - windowMs;

  const inWindow = params.recentSentAts
    .map((d) => d.getTime())
    .filter((t) => t >= windowStart)
    .sort((a, b) => a - b);

  if (inWindow.length < cap) {
    return { ok: true, used: inWindow.length, cap };
  }

  const oldest = inWindow[0];
  const rawNext = new Date(oldest + windowMs + 1000);
  const nextAllowedAt =
    rawNext > asOf ? nextOntarioContactSlot(rawNext) : nextOntarioContactSlot(asOf);
  return {
    ok: false,
    used: inWindow.length,
    cap,
    nextAllowedAt,
  };
}

/** Public-facing invoice label — never echo clinical / PHIPA-sensitive free text. */
export const PUBLIC_INVOICE_LABEL = "Past-due account balance";

export function publicInvoiceLabel(_internalDescription?: string | null): string {
  return PUBLIC_INVOICE_LABEL;
}
