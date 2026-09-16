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
import { caslAttributionBlock } from "./legal";

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

function withCaslFooter(
  text: string,
  merchant: {
    legalName: string;
    address?: string | null;
    supportEmail?: string | null;
    phone?: string | null;
  },
) {
  return `${text}\n\n—\n${caslAttributionBlock(merchant)}`;
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
    text: withCaslFooter(tpl.text, {
      legalName: merchantLegal,
      address: params.physicalAddress,
      supportEmail: params.supportEmail,
      phone: params.phone,
    }),
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
    text: withCaslFooter(tpl.text, { legalName: params.tradeName }),
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
    text: withCaslFooter(tpl.text, { legalName: params.tradeName }),
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
    text: withCaslFooter(tpl.text, { legalName: params.tradeName }),
  });
}
