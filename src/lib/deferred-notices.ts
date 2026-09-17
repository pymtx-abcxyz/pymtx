/**
 * Flush debtor notices deferred for Ontario CDSSA contact hours / cadence.
 * Respects communication pause (dispute / counsel kill-switch).
 */
import { prisma } from "./db";
import {
  evaluateContactCadence,
  isCadenceCountingKind,
} from "./compliance/cadence";
import { isOntarioContactHour } from "./compliance/ontarioHours";
import { CaslMessageKind } from "./domain";
import { sendEmail, type EmailAttachment } from "./email";

const CADENCE_KINDS = [
  CaslMessageKind.INVITE,
  CaslMessageKind.RECEIPT,
  CaslMessageKind.NSF_ALERT,
  CaslMessageKind.SKIP_CONFIRMATION,
] as const;

export async function flushDeferredNotices(asOf = new Date()) {
  if (!isOntarioContactHour(asOf)) {
    return {
      scanned: 0,
      sent: 0,
      failed: 0,
      suppressed: 0,
      rescheduled: 0,
      skippedOutsideHours: true as const,
    };
  }

  const due = await prisma.deferredNotice.findMany({
    where: {
      sentAt: null,
      suppressedAt: null,
      sendAfter: { lte: asOf },
      attempts: { lt: 8 },
    },
    include: {
      caslMessage: { select: { customerId: true, kind: true } },
    },
    orderBy: { sendAfter: "asc" },
    take: 50,
  });

  let sent = 0;
  let failed = 0;
  let suppressed = 0;
  let rescheduled = 0;

  for (const row of due) {
    const customerId = row.caslMessage.customerId;
    const kind = row.caslMessage.kind;
    let replyTo: string | undefined;

    if (customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          communicationPausedAt: true,
          business: { select: { supportEmail: true, email: true } },
        },
      });

      if (customer?.communicationPausedAt) {
        await prisma.$transaction([
          prisma.deferredNotice.update({
            where: { id: row.id },
            data: {
              suppressedAt: new Date(),
              suppressReason: "communication_paused",
            },
          }),
          prisma.caslMessage.update({
            where: { id: row.caslMessageId },
            data: { providerId: "suppressed" },
          }),
        ]);
        suppressed += 1;
        continue;
      }

      if (customer) {
        replyTo =
          customer.business.supportEmail || customer.business.email || undefined;
      }

      if (isCadenceCountingKind(kind)) {
        const windowStart = new Date(asOf.getTime() - 7 * 24 * 60 * 60 * 1000);
        const counting = await prisma.caslMessage.findMany({
          where: {
            customerId,
            id: { not: row.caslMessageId },
            kind: { in: [...CADENCE_KINDS] },
            sentAt: { gte: windowStart },
            NOT: {
              providerId: {
                in: ["suppressed", "deferred", "cadence_deferred"],
              },
            },
          },
          select: { sentAt: true },
          orderBy: { sentAt: "asc" },
        });
        const cadence = evaluateContactCadence({
          recentSentAts: counting.map((c) => c.sentAt),
          asOf,
        });
        if (!cadence.ok) {
          await prisma.deferredNotice.update({
            where: { id: row.id },
            data: { sendAfter: cadence.nextAllowedAt },
          });
          rescheduled += 1;
          continue;
        }
      }
    }

    let attachments: EmailAttachment[] | undefined;
    if (row.attachmentsJson) {
      try {
        attachments = JSON.parse(row.attachmentsJson) as EmailAttachment[];
      } catch {
        attachments = undefined;
      }
    }

    const result = await sendEmail({
      to: row.toEmail,
      subject: row.subject,
      html: row.html,
      text: row.text,
      fromName: row.fromName,
      replyTo,
      attachments,
    });

    if (!result.ok) {
      failed += 1;
      await prisma.deferredNotice.update({
        where: { id: row.id },
        data: {
          attempts: { increment: 1 },
          lastError: result.error.slice(0, 500),
        },
      });
      continue;
    }

    sent += 1;
    await prisma.$transaction([
      prisma.deferredNotice.update({
        where: { id: row.id },
        data: {
          sentAt: new Date(),
          attempts: { increment: 1 },
          lastError: null,
        },
      }),
      prisma.caslMessage.update({
        where: { id: row.caslMessageId },
        data: {
          providerId:
            result.provider === "resend" && result.id
              ? result.id
              : result.provider,
          sentAt: new Date(),
        },
      }),
    ]);
  }

  return {
    scanned: due.length,
    sent,
    failed,
    suppressed,
    rescheduled,
    skippedOutsideHours: false as const,
  };
}

/** Suppress all unsent deferred notices for a customer (pause / dispute). */
export async function suppressDeferredForCustomer(
  customerId: string,
  reason: string,
) {
  const pending = await prisma.deferredNotice.findMany({
    where: {
      sentAt: null,
      suppressedAt: null,
      caslMessage: { customerId },
    },
    select: { id: true, caslMessageId: true },
  });
  if (!pending.length) return { suppressed: 0 };

  const now = new Date();
  await prisma.$transaction([
    prisma.deferredNotice.updateMany({
      where: { id: { in: pending.map((p) => p.id) } },
      data: { suppressedAt: now, suppressReason: reason.slice(0, 200) },
    }),
    prisma.caslMessage.updateMany({
      where: { id: { in: pending.map((p) => p.caslMessageId) } },
      data: { providerId: "suppressed" },
    }),
  ]);
  return { suppressed: pending.length };
}
