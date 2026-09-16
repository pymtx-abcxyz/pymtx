/**
 * Path B / Rule H1 customer notifications.
 * Merchant of Record = business trade name on From; pymtx is platform only.
 * HTML via React Email; PAD confirmation includes Rule H1 PDF attachment.
 */
import { render } from "@react-email/render";
import { createElement } from "react";
import { prisma } from "./db";
import { CaslMessageKind } from "./domain";
import {
  NsfAlertEmail,
  PadConfirmationEmail,
  ReceiptEmail,
  SkipConfirmationEmail,
} from "@/emails/templates";
import {
  nsfAlertEmail,
  padConfirmationEmail,
  receiptEmail,
  sendEmail,
  skipConfirmationEmail,
  type EmailAttachment,
} from "./email";
import { buildPadMandatePdf, pdfToBase64 } from "./pad-mandate-pdf";

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
}) {
  await prisma.caslMessage.create({
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

  const sent = await sendEmail({
    to: params.toEmail,
    subject: params.subject,
    html: params.html,
    text: params.text,
    fromName: params.fromName,
    attachments: params.attachments,
  });

  if (!sent.ok) {
    console.error(`[notifications] ${params.kind} send failed:`, sent.error);
  }
  return sent;
}

export async function sendPadConfirmationNotice(params: {
  businessId: string;
  customerId: string;
  tradeName: string;
  legalName?: string;
  toEmail: string;
  invoiceRef: string;
  firstDebitDate: string;
  monthlyAmountCents: number;
  bankLast4: string;
  ipAddress?: string;
  userAgent?: string;
}) {
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
    legalName: params.legalName,
    payorEmail: params.toEmail,
    invoiceRef: params.invoiceRef,
    firstDebitDate: params.firstDebitDate,
    monthlyAmountCents: params.monthlyAmountCents,
    bankLast4: params.bankLast4,
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
  });
}

export async function sendNsfAlertNotice(params: {
  businessId: string;
  customerId: string;
  tradeName: string;
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
  });
}

export async function sendSkipConfirmationNotice(params: {
  businessId: string;
  customerId: string;
  tradeName: string;
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
  });
}
