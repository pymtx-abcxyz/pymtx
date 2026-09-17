/**
 * Path B / Rule H1 customer notifications.
 * From: merchant trade name.
 * Reply-To: merchant support inbox.
 * Statutory attribution: 1001527397 ONTARIO INC. only (no operating brand).
 *
 * CDSSA: Ontario contact hours + max 3 counting contacts / 7 days.
 * Communication pause (dispute / counsel) suppresses non-exempt notices.
 */
import { render } from "@react-email/render";
import { createElement } from "react";
import {
  InviteEmail,
  NsfAlertEmail,
  PadConfirmationEmail,
  ReceiptEmail,
  SkipConfirmationEmail,
} from "@/emails/templates";
import { gateOntarioDebtorNotice } from "./compliance/ontarioHours";
import {
  evaluateContactCadence,
  isCadenceCountingKind,
  isCommunicationPauseExempt,
} from "./compliance/cadence";
import { prisma } from "./db";
import { CaslMessageKind } from "./domain";
import {
  inviteEmail,
  nsfAlertEmail,
  padConfirmationEmail,
  receiptEmail,
  sendEmail,
  skipConfirmationEmail,
  type EmailAttachment,
  type SendEmailResult,
} from "./email";
import { appUrl } from "./env";
import { caslAttributionBlock, PROVIDER } from "./legal";
import { buildPadMandatePdf, pdfToBase64 } from "./pad-mandate-pdf";

/** Auth + Rule H1 written confirmation may send outside CDSSA contact hours. */
const CONTACT_WINDOW_EXEMPT = new Set<string>([
  CaslMessageKind.MAGIC_LINK,
  CaslMessageKind.PAD_CONFIRMATION,
]);

function appendCaslHtmlFooter(html: string, attributionHtml: string): string {
  if (html.includes("data-casl-attribution")) return html;
  const block = `<div data-casl-attribution="1" style="margin-top:20px;padding-top:12px;border-top:1px solid #cad2c5;font-size:11px;color:#4e6260;line-height:1.5;white-space:pre-line">${attributionHtml}</div>`;
  if (html.includes("</body>")) {
    return html.replace("</body>", `${block}</body>`);
  }
  return `${html}${block}`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function persistAndSend(params: {
  businessId: string;
  customerId: string;
  kind: string;
  fromName: string;
  toEmail: string;
  subject: string;
  bodyPreview: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
  merchantLegalName: string;
  merchantAddress?: string | null;
  merchantSupportEmail?: string | null;
  merchantPhone?: string | null;
}): Promise<
  | SendEmailResult
  | { ok: true; provider: "deferred" | "suppressed" | "cadence_deferred" }
> {
  const attribution = caslAttributionBlock({
    legalName: params.merchantLegalName,
    address: params.merchantAddress,
    supportEmail: params.merchantSupportEmail,
    phone: params.merchantPhone,
  });
  const text = [
    params.text,
    "",
    "—",
    `Sent on behalf of ${params.merchantLegalName}.`,
    `Serviced technically by ${PROVIDER.legalName}, ${PROVIDER.addressLine} (${PROVIDER.email}).`,
    attribution,
  ].join("\n");

  const attributionHtml = escapeHtml(attribution).replace(/\n/g, "<br/>");
  const html = appendCaslHtmlFooter(params.html, attributionHtml);
  const replyTo = params.merchantSupportEmail?.trim() || undefined;

  const casl = await prisma.caslMessage.create({
    data: {
      businessId: params.businessId,
      customerId: params.customerId,
      kind: params.kind,
      fromName: params.fromName,
      toEmail: params.toEmail,
      subject: params.subject,
      bodyPreview: params.bodyPreview,
    },
  });

  // Counsel / dispute communication kill-switch (magic-link exempt).
  if (!isCommunicationPauseExempt(params.kind)) {
    const customer = await prisma.customer.findUnique({
      where: { id: params.customerId },
      select: { communicationPausedAt: true },
    });
    if (customer?.communicationPausedAt) {
      await prisma.caslMessage.update({
        where: { id: casl.id },
        data: { providerId: "suppressed" },
      });
      return { ok: true, provider: "suppressed" };
    }
  }

  // CDSSA cadence: max 3 counting contacts / rolling 7 days.
  if (isCadenceCountingKind(params.kind)) {
    const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const counting = await prisma.caslMessage.findMany({
      where: {
        customerId: params.customerId,
        id: { not: casl.id },
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
    });
    if (!cadence.ok) {
      await prisma.deferredNotice.create({
        data: {
          caslMessageId: casl.id,
          businessId: params.businessId,
          fromName: params.fromName,
          toEmail: params.toEmail,
          subject: params.subject,
          html,
          text,
          attachmentsJson: params.attachments?.length
            ? JSON.stringify(params.attachments)
            : null,
          sendAfter: cadence.nextAllowedAt,
        },
      });
      await prisma.caslMessage.update({
        where: { id: casl.id },
        data: { providerId: "cadence_deferred" },
      });
      return { ok: true, provider: "cadence_deferred" };
    }
  }

  if (!CONTACT_WINDOW_EXEMPT.has(params.kind)) {
    const gate = gateOntarioDebtorNotice(`notice:${params.kind}`);
    if (!gate.ok) {
      await prisma.deferredNotice.create({
        data: {
          caslMessageId: casl.id,
          businessId: params.businessId,
          fromName: params.fromName,
          toEmail: params.toEmail,
          subject: params.subject,
          html,
          text,
          attachmentsJson: params.attachments?.length
            ? JSON.stringify(params.attachments)
            : null,
          sendAfter: gate.nextAllowedAt,
        },
      });
      await prisma.caslMessage.update({
        where: { id: casl.id },
        data: { providerId: "deferred" },
      });
      return { ok: true, provider: "deferred" };
    }
  }

  const sent = await sendEmail({
    to: params.toEmail,
    subject: params.subject,
    html,
    text,
    fromName: params.fromName,
    replyTo,
    attachments: params.attachments,
  });

  if (!sent.ok) {
    console.error(`[notifications] ${params.kind} send failed:`, sent.error);
  } else if (sent.provider === "resend" && sent.id) {
    await prisma.caslMessage.update({
      where: { id: casl.id },
      data: { providerId: sent.id },
    });
  } else if (sent.ok) {
    await prisma.caslMessage.update({
      where: { id: casl.id },
      data: { providerId: sent.provider },
    });
  }
  return sent;
}

const CADENCE_KINDS = [
  CaslMessageKind.INVITE,
  CaslMessageKind.RECEIPT,
  CaslMessageKind.NSF_ALERT,
  CaslMessageKind.SKIP_CONFIRMATION,
] as const;

export async function sendInviteNotice(params: {
  businessId: string;
  customerId: string;
  tradeName: string;
  legalName?: string;
  physicalAddress?: string | null;
  supportEmail?: string | null;
  phone?: string | null;
  toEmail: string;
  customerFirstName: string;
  invoiceRef: string;
  amountCents: number;
  inviteToken: string;
}) {
  const inviteUrl = `${appUrl()}/client?token=${encodeURIComponent(params.inviteToken)}`;
  const tpl = inviteEmail({
    tradeName: params.tradeName,
    firstName: params.customerFirstName,
    invoiceRef: params.invoiceRef,
    amountCents: params.amountCents,
    inviteUrl,
  });
  const html = await render(
    createElement(InviteEmail, {
      tradeName: params.tradeName,
      firstName: params.customerFirstName,
      invoiceRef: params.invoiceRef,
      amountCents: params.amountCents,
      inviteUrl,
    }),
  );
  return persistAndSend({
    businessId: params.businessId,
    customerId: params.customerId,
    kind: CaslMessageKind.INVITE,
    fromName: params.tradeName,
    toEmail: params.toEmail,
    subject: tpl.subject,
    bodyPreview: tpl.text.slice(0, 280),
    html,
    text: tpl.text,
    merchantLegalName: params.legalName || params.tradeName,
    merchantAddress: params.physicalAddress,
    merchantSupportEmail: params.supportEmail,
    merchantPhone: params.phone,
  });
}

export async function sendPadConfirmationNotice(params: {
  businessId: string;
  customerId: string;
  tradeName: string;
  legalName?: string;
  physicalAddress?: string | null;
  supportEmail?: string | null;
  phone?: string | null;
  payorName?: string;
  toEmail: string;
  customerAddress?: string | null;
  invoiceRef: string;
  firstDebitDate: string;
  monthlyAmountCents: number;
  totalPrincipalCents?: number;
  tenureMonths?: number;
  bankLast4: string;
  institutionNumber?: string;
  transitNumber?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const merchantLegal = params.legalName || params.tradeName;
  const tpl = padConfirmationEmail({
    tradeName: params.tradeName,
    invoiceRef: params.invoiceRef,
    firstDebitDate: params.firstDebitDate,
    monthlyAmountCents: params.monthlyAmountCents,
    bankLast4: params.bankLast4,
  });
  const html = await render(
    createElement(PadConfirmationEmail, {
      tradeName: params.tradeName,
      invoiceRef: params.invoiceRef,
      firstDebitDate: params.firstDebitDate,
      monthlyAmountCents: params.monthlyAmountCents,
      bankLast4: params.bankLast4,
    }),
  );
  const pdfBytes = await buildPadMandatePdf({
    tradeName: params.tradeName,
    legalName: merchantLegal,
    physicalAddress: params.physicalAddress,
    supportEmail: params.supportEmail,
    phone: params.phone,
    payorName: params.payorName,
    payorEmail: params.toEmail,
    customerAddress: params.customerAddress,
    invoiceRef: params.invoiceRef,
    firstDebitDate: params.firstDebitDate,
    monthlyAmountCents: params.monthlyAmountCents,
    totalPrincipalCents: params.totalPrincipalCents,
    tenureMonths: params.tenureMonths,
    bankLast4: params.bankLast4,
    institutionNumber: params.institutionNumber,
    transitNumber: params.transitNumber,
    acceptedAt: new Date(),
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  return persistAndSend({
    businessId: params.businessId,
    customerId: params.customerId,
    kind: CaslMessageKind.PAD_CONFIRMATION,
    fromName: params.tradeName,
    toEmail: params.toEmail,
    subject: tpl.subject,
    bodyPreview: tpl.text.slice(0, 280),
    html,
    text: tpl.text,
    merchantLegalName: merchantLegal,
    merchantAddress: params.physicalAddress,
    merchantSupportEmail: params.supportEmail,
    merchantPhone: params.phone,
    attachments: [
      {
        filename: `pad-confirmation-${params.invoiceRef}.pdf`,
        content: pdfToBase64(pdfBytes),
        contentType: "application/pdf",
      },
    ],
  });
}

export async function sendReceiptNotice(params: {
  businessId: string;
  customerId: string;
  tradeName: string;
  legalName?: string;
  physicalAddress?: string | null;
  supportEmail?: string | null;
  phone?: string | null;
  toEmail: string;
  invoiceRef: string;
  amountCents: number;
  sequence: number;
  paidAt: Date;
}) {
  const paidAt = params.paidAt.toISOString().slice(0, 10);
  const tpl = receiptEmail({
    tradeName: params.tradeName,
    invoiceRef: params.invoiceRef,
    amountCents: params.amountCents,
    sequence: params.sequence,
    paidAt: params.paidAt,
  });
  const html = await render(
    createElement(ReceiptEmail, {
      tradeName: params.tradeName,
      invoiceRef: params.invoiceRef,
      amountCents: params.amountCents,
      sequence: params.sequence,
      paidAt,
    }),
  );
  return persistAndSend({
    businessId: params.businessId,
    customerId: params.customerId,
    kind: CaslMessageKind.RECEIPT,
    fromName: params.tradeName,
    toEmail: params.toEmail,
    subject: tpl.subject,
    bodyPreview: tpl.text.slice(0, 280),
    html,
    text: tpl.text,
    merchantLegalName: params.legalName || params.tradeName,
    merchantAddress: params.physicalAddress,
    merchantSupportEmail: params.supportEmail,
    merchantPhone: params.phone,
  });
}

export async function sendNsfAlertNotice(params: {
  businessId: string;
  customerId: string;
  tradeName: string;
  legalName?: string;
  physicalAddress?: string | null;
  supportEmail?: string | null;
  phone?: string | null;
  toEmail: string;
  invoiceRef: string;
  amountCents: number;
  sequence: number;
  retryAvailable: boolean;
}) {
  const tpl = nsfAlertEmail(params);
  const html = await render(createElement(NsfAlertEmail, params));
  return persistAndSend({
    businessId: params.businessId,
    customerId: params.customerId,
    kind: CaslMessageKind.NSF_ALERT,
    fromName: params.tradeName,
    toEmail: params.toEmail,
    subject: tpl.subject,
    bodyPreview: tpl.text.slice(0, 280),
    html,
    text: tpl.text,
    merchantLegalName: params.legalName || params.tradeName,
    merchantAddress: params.physicalAddress,
    merchantSupportEmail: params.supportEmail,
    merchantPhone: params.phone,
  });
}

export async function sendSkipConfirmationNotice(params: {
  businessId: string;
  customerId: string;
  tradeName: string;
  legalName?: string;
  physicalAddress?: string | null;
  supportEmail?: string | null;
  phone?: string | null;
  toEmail: string;
  amountCents: number;
  skippedDue: string;
  appendedSequence: number;
  appendedDue: string;
  nextSkipAvailable: string;
}) {
  const tpl = skipConfirmationEmail(params);
  const html = await render(createElement(SkipConfirmationEmail, params));
  return persistAndSend({
    businessId: params.businessId,
    customerId: params.customerId,
    kind: CaslMessageKind.SKIP_CONFIRMATION,
    fromName: params.tradeName,
    toEmail: params.toEmail,
    subject: tpl.subject,
    bodyPreview: tpl.text.slice(0, 280),
    html,
    text: tpl.text,
    merchantLegalName: params.legalName || params.tradeName,
    merchantAddress: params.physicalAddress,
    merchantSupportEmail: params.supportEmail,
    merchantPhone: params.phone,
  });
}
