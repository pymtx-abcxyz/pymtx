/**
 * Flush debtor notices deferred for Ontario CDSSA contact hours.
 */
import { prisma } from "./db";
import { isOntarioContactHour } from "./compliance/ontarioHours";
import { sendEmail, type EmailAttachment } from "./email";

export async function flushDeferredNotices(asOf = new Date()) {
  if (!isOntarioContactHour(asOf)) {
    return { scanned: 0, sent: 0, failed: 0, skippedOutsideHours: true as const };
  }

  const due = await prisma.deferredNotice.findMany({
    where: {
      sentAt: null,
      sendAfter: { lte: asOf },
      attempts: { lt: 8 },
    },
    orderBy: { sendAfter: "asc" },
    take: 50,
  });

  let sent = 0;
  let failed = 0;

  for (const row of due) {
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
    skippedOutsideHours: false as const,
  };
}
