/**
 * Path B / Rule H1 customer notifications.
 * Merchant of Record = business trade name on From; pymtx is platform only.
 * Messages are logged to CaslMessage and sent via Resend when configured.
 */
import { prisma } from "./db";
import { CaslMessageKind } from "./domain";
import {
  nsfAlertEmail,
  padConfirmationEmail,
  receiptEmail,
  sendEmail,
  skipConfirmationEmail,
} from "./email";

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
  });

  if (!sent.ok) {
    console.error(
      `[notifications] ${params.kind} send failed:`,
      sent.error,
    );
  }
  return sent;
}

export async function sendPadConfirmationNotice(params: {
  businessId: string;
  customerId: string;
  tradeName: string;
  toEmail: string;
  invoiceRef: string;
  firstDebitDate: string;
  monthlyAmountCents: number;
  bankLast4: string;
}) {
  const tpl = padConfirmationEmail({
    tradeName: params.tradeName,
    invoiceRef: params.invoiceRef,
    firstDebitDate: params.firstDebitDate,
    monthlyAmountCents: params.monthlyAmountCents,
    bankLast4: params.bankLast4,
  });
  return persistAndSend({
    businessId: params.businessId,
    customerId: params.customerId,
    kind: CaslMessageKind.PAD_CONFIRMATION,
    fromName: params.tradeName,
    toEmail: params.toEmail,
    subject: tpl.subject,
    bodyPreview: tpl.text.slice(0, 280),
    html: tpl.html,
    text: tpl.text,
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
  const tpl = receiptEmail({
    tradeName: params.tradeName,
    invoiceRef: params.invoiceRef,
    amountCents: params.amountCents,
    sequence: params.sequence,
    paidAt: params.paidAt,
  });
  return persistAndSend({
    businessId: params.businessId,
    customerId: params.customerId,
    kind: CaslMessageKind.RECEIPT,
    fromName: params.tradeName,
    toEmail: params.toEmail,
    subject: tpl.subject,
    bodyPreview: tpl.text.slice(0, 280),
    html: tpl.html,
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
  const tpl = nsfAlertEmail({
    tradeName: params.tradeName,
    invoiceRef: params.invoiceRef,
    amountCents: params.amountCents,
    sequence: params.sequence,
    retryAvailable: params.retryAvailable,
  });
  return persistAndSend({
    businessId: params.businessId,
    customerId: params.customerId,
    kind: CaslMessageKind.NSF_ALERT,
    fromName: params.tradeName,
    toEmail: params.toEmail,
    subject: tpl.subject,
    bodyPreview: tpl.text.slice(0, 280),
    html: tpl.html,
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
  return persistAndSend({
    businessId: params.businessId,
    customerId: params.customerId,
    kind: CaslMessageKind.SKIP_CONFIRMATION,
    fromName: params.tradeName,
    toEmail: params.toEmail,
    subject: tpl.subject,
    bodyPreview: tpl.text.slice(0, 280),
    html: tpl.html,
    text: tpl.text,
  });
}
