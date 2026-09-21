import { appUrl } from "./env";
import { PROVIDER, providerFooterLine } from "./legal/provider";

export type EmailAttachment = {
  filename: string;
  content: string; // base64
  contentType?: string;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName: string;
  fromEmail?: string;
  /** Merchant support inbox — CASL / white-label Reply-To. */
  replyTo?: string;
  attachments?: EmailAttachment[];
};

export type SendEmailResult =
  | { ok: true; provider: "resend" | "demo"; id?: string }
  | { ok: false; provider: string; error: string };

function defaultFromEmail() {
  return process.env.EMAIL_FROM || "noreply@pymtx.com";
}

/**
 * Send transactional email under merchant From identity.
 * - EMAIL_PROVIDER=resend + RESEND_API_KEY → Resend (supports PDF attachments)
 * - otherwise demo (no network send)
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const provider = (process.env.EMAIL_PROVIDER || "demo").toLowerCase();
  const from = `${input.fromName} <${input.fromEmail || defaultFromEmail()}>`;

  if (provider === "resend") {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      return { ok: false, provider: "resend", error: "RESEND_API_KEY missing" };
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        ...(input.attachments?.length
          ? {
              attachments: input.attachments.map((a) => ({
                filename: a.filename,
                content: a.content,
                content_type: a.contentType || "application/pdf",
              })),
            }
          : {}),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        provider: "resend",
        error: data.message || `Resend HTTP ${res.status}`,
      };
    }
    return { ok: true, provider: "resend", id: data.id };
  }

  return { ok: true, provider: "demo" };
}

/** HIG email tokens — light canvas (matches tokens.css light / React Email shell). */
const emailTone = {
  canvas: "#f5f7f5",
  card: "#ffffff",
  textPrimary: "#202b31",
  textSecondary: "#30484a",
  textMuted: "#4e6260",
  actionPrimary: "#3b5b53",
  textOnPrimary: "#ffffff",
  borderSubtle: "#cad2c5",
  danger: "#b3261e",
} as const;

function brandedShell(opts: {
  eyebrow: string;
  title: string;
  bodyHtml: string;
  footerNote?: string;
  titleTone?: "default" | "danger";
}) {
  const titleColor =
    opts.titleTone === "danger" ? emailTone.danger : emailTone.textPrimary;
  return `
    <div style="font-family:ui-monospace,'Cascadia Code','SF Mono',Menlo,Consolas,monospace;background:${emailTone.canvas};color:${emailTone.textPrimary};padding:32px">
      <div style="max-width:480px;margin:0 auto;background:${emailTone.card};border:1px solid ${emailTone.borderSubtle};border-radius:12px;padding:28px 24px">
        <p style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:${emailTone.textMuted};font-weight:700;margin:0">${escapeHtml(opts.eyebrow)}</p>
        <h1 style="font-size:22px;line-height:1.3;color:${titleColor};margin:12px 0 16px">${escapeHtml(opts.title)}</h1>
        ${opts.bodyHtml}
        <p style="margin-top:28px;font-size:11px;color:${emailTone.textMuted};line-height:1.5">
          ${opts.footerNote || ""}${escapeHtml(providerFooterLine())}
        </p>
      </div>
    </div>
  `.trim();
}

function emailBody(html: string) {
  return html
    .replaceAll("{{textSecondary}}", emailTone.textSecondary)
    .replaceAll("{{textPrimary}}", emailTone.textPrimary)
    .replaceAll("{{textMuted}}", emailTone.textMuted)
    .replaceAll("{{actionPrimary}}", emailTone.actionPrimary)
    .replaceAll("{{textOnPrimary}}", emailTone.textOnPrimary);
}

function ctaButton(href: string, label: string) {
  return `
      <p style="margin:28px 0">
        <a href="${escapeHtml(href)}" style="display:inline-block;background:${emailTone.actionPrimary};color:${emailTone.textOnPrimary};text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px">
          ${escapeHtml(label)}
        </a>
      </p>
  `.trim();
}

export function magicLinkEmail(opts: {
  tradeName: string;
  url: string;
  minutes: number;
}) {
  const subject = `Sign in to settle with ${opts.tradeName}`;
  const text = [
    `Sign in to settle your balance with ${opts.tradeName}.`,
    "",
    opts.url,
    "",
    `This link expires in ${opts.minutes} minutes.`,
    "",
    `If you did not request this, you can ignore this email.`,
    `${providerFooterLine()}`,
  ].join("\n");

  const html = brandedShell({
    eyebrow: PROVIDER.brand,
    title: `Sign in to settle with ${opts.tradeName}`,
    bodyHtml: emailBody(`
      <p style="color:{{textSecondary}};line-height:1.5">Use this one-time link. It expires in ${opts.minutes} minutes.</p>
      ${ctaButton(opts.url, "Open secure sign-in")}
      <p style="font-size:12px;color:{{textMuted}};word-break:break-all">${escapeHtml(opts.url)}</p>
    `),
  });

  return { subject, text, html };
}

/** Staff password-reset link (Owners / Clerks / Admins). */
export function passwordResetEmail(opts: {
  name: string;
  url: string;
  minutes: number;
}) {
  const subject = "Reset your pymtx password";
  const text = [
    `Hi ${opts.name},`,
    "",
    "We received a request to reset your pymtx portal password.",
    "",
    opts.url,
    "",
    `This link expires in ${opts.minutes} minutes.`,
    "",
    "If you did not request this, you can ignore this email — your password will not change.",
    "",
    `${providerFooterLine()}`,
  ].join("\n");

  const html = brandedShell({
    eyebrow: PROVIDER.brand,
    title: "Reset your password",
    bodyHtml: emailBody(`
      <p style="color:{{textSecondary}};line-height:1.5">Hi ${escapeHtml(opts.name)}, use this one-time link to choose a new password. It expires in ${opts.minutes} minutes.</p>
      ${ctaButton(opts.url, "Choose a new password")}
      <p style="font-size:12px;color:{{textMuted}};word-break:break-all">${escapeHtml(opts.url)}</p>
      <p style="color:{{textSecondary}};line-height:1.5;margin-top:20px">If you did not request this, ignore this email.</p>
    `),
  });

  return { subject, text, html };
}

function formatCad(cents: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

/** CASL white-labeled customer invite — merchant sender identity. */
export function inviteEmail(opts: {
  tradeName: string;
  firstName: string;
  invoiceRef: string;
  amountCents: number;
  inviteUrl: string;
}) {
  const subject = `Settle your balance with ${opts.tradeName}`;
  const text = [
    `Hello ${opts.firstName},`,
    "",
    `${opts.tradeName} invited you to settle invoice ${opts.invoiceRef} (${formatCad(opts.amountCents)} past due).`,
    "",
    `Open your secure link to choose a payment plan: ${opts.inviteUrl}`,
    "",
    `${providerFooterLine()}`,
  ].join("\n");

  const html = brandedShell({
    eyebrow: opts.tradeName,
    title: "Settle your balance",
    bodyHtml: emailBody(`
      <p style="color:{{textSecondary}};line-height:1.55">Hello ${escapeHtml(opts.firstName)},</p>
      <p style="color:{{textSecondary}};line-height:1.55"><strong style="color:{{textPrimary}}">${escapeHtml(opts.tradeName)}</strong> invited you to settle invoice <strong>${escapeHtml(opts.invoiceRef)}</strong> (${escapeHtml(formatCad(opts.amountCents))} past due).</p>
      ${ctaButton(opts.inviteUrl, "Open secure plan link")}
    `),
  });

  return { subject, text, html };
}

/** Rule H1 written PAD confirmation — merchant sender identity. */
export function padConfirmationEmail(opts: {
  tradeName: string;
  invoiceRef: string;
  firstDebitDate: string;
  monthlyAmountCents: number;
  bankLast4: string;
}) {
  const subject = `PAD confirmation — ${opts.tradeName}`;
  const text = [
    `This is written confirmation of your Personal PAD Agreement with ${opts.tradeName}.`,
    "",
    `Invoice: ${opts.invoiceRef}`,
    `Monthly debit: ${formatCad(opts.monthlyAmountCents)}`,
    `Account ending: •••• ${opts.bankLast4}`,
    `First debit on or after: ${opts.firstDebitDate}`,
    "",
    "You may cancel this PAD authorization upon thirty (30) calendar days' written notice to the Payee, or by cancelling inside the client portal (Payments Canada Rule H1). Revoking this authorization does not extinguish the underlying debt.",
    "",
    `${providerFooterLine()}`,
  ].join("\n");

  const html = brandedShell({
    eyebrow: opts.tradeName,
    title: "Personal PAD confirmation",
    bodyHtml: emailBody(`
      <p style="color:{{textSecondary}};line-height:1.55">Written confirmation of your Pre-Authorized Debit with <strong style="color:{{textPrimary}}">${escapeHtml(opts.tradeName)}</strong> (Merchant of Record).</p>
      <ul style="color:{{textSecondary}};line-height:1.7;padding-left:18px">
        <li>Invoice ${escapeHtml(opts.invoiceRef)}</li>
        <li>${escapeHtml(formatCad(opts.monthlyAmountCents))} monthly</li>
        <li>Account •••• ${escapeHtml(opts.bankLast4)}</li>
        <li>First debit on or after ${escapeHtml(opts.firstDebitDate)}</li>
      </ul>
      <p style="color:{{textSecondary}};line-height:1.55">Cancel with thirty (30) calendar days' written notice, or inside the client portal (Rule H1). Cancelling the PAD does not extinguish the underlying debt.</p>
    `),
  });

  return { subject, text, html };
}

/** Monthly installment receipt after successful Direct Charge. */
export function receiptEmail(opts: {
  tradeName: string;
  invoiceRef: string;
  amountCents: number;
  sequence: number;
  paidAt: Date;
}) {
  const paid = opts.paidAt.toISOString().slice(0, 10);
  const subject = `Payment receipt — ${opts.tradeName}`;
  const text = [
    `Payment received by ${opts.tradeName}.`,
    "",
    `Invoice: ${opts.invoiceRef}`,
    `Installment #${opts.sequence}: ${formatCad(opts.amountCents)}`,
    `Date: ${paid}`,
    "",
    `${providerFooterLine()}`,
  ].join("\n");

  const html = brandedShell({
    eyebrow: opts.tradeName,
    title: "Payment receipt",
    bodyHtml: emailBody(`
      <p style="color:{{textSecondary}};line-height:1.55">We received your installment payment.</p>
      <ul style="color:{{textSecondary}};line-height:1.7;padding-left:18px">
        <li>Invoice ${escapeHtml(opts.invoiceRef)}</li>
        <li>Installment #${opts.sequence}: ${escapeHtml(formatCad(opts.amountCents))}</li>
        <li>Date ${escapeHtml(paid)}</li>
      </ul>
    `),
  });

  return { subject, text, html };
}

/** Rule H1 NSF / failed PAD notice. */
export function nsfAlertEmail(opts: {
  tradeName: string;
  invoiceRef: string;
  amountCents: number;
  sequence: number;
  retryAvailable: boolean;
}) {
  const subject = `Payment unsuccessful — ${opts.tradeName}`;
  const retryLine = opts.retryAvailable
    ? "One re-presentment may be attempted within 30 days (Payments Canada Rule H1)."
    : "No further automatic re-presentment will be attempted for this installment.";
  const text = [
    `A Pre-Authorized Debit for ${opts.tradeName} could not be completed.`,
    "",
    `Invoice: ${opts.invoiceRef}`,
    `Installment #${opts.sequence}: ${formatCad(opts.amountCents)}`,
    "",
    retryLine,
    "",
    `${providerFooterLine()}`,
  ].join("\n");

  const html = brandedShell({
    eyebrow: opts.tradeName,
    title: "Payment unsuccessful",
    titleTone: "danger",
    bodyHtml: emailBody(`
      <p style="color:{{textSecondary}};line-height:1.55">A Pre-Authorized Debit could not be completed (often NSF).</p>
      <ul style="color:{{textSecondary}};line-height:1.7;padding-left:18px">
        <li>Invoice ${escapeHtml(opts.invoiceRef)}</li>
        <li>Installment #${opts.sequence}: ${escapeHtml(formatCad(opts.amountCents))}</li>
      </ul>
      <p style="color:{{textSecondary}};line-height:1.55">${escapeHtml(retryLine)}</p>
    `),
  });

  return { subject, text, html };
}

export function skipConfirmationEmail(opts: {
  tradeName: string;
  amountCents: number;
  skippedDue: string;
  appendedSequence: number;
  appendedDue: string;
  nextSkipAvailable: string;
}) {
  const subject = `Payment skip confirmed — ${opts.tradeName}`;
  const text = [
    `Your ${formatCad(opts.amountCents)} debit due ${opts.skippedDue} was skipped.`,
    `A replacement payment (seq ${opts.appendedSequence}) is scheduled for ${opts.appendedDue}.`,
    `Next skip available ${opts.nextSkipAvailable}.`,
    "",
    `${providerFooterLine()}`,
  ].join("\n");

  const html = brandedShell({
    eyebrow: opts.tradeName,
    title: "Payment skip confirmed",
    bodyHtml: emailBody(`
      <p style="color:{{textSecondary}};line-height:1.55">Your ${escapeHtml(formatCad(opts.amountCents))} debit due ${escapeHtml(opts.skippedDue)} was skipped.</p>
      <p style="color:{{textSecondary}};line-height:1.55">Replacement installment #${opts.appendedSequence} is scheduled for ${escapeHtml(opts.appendedDue)}.</p>
      <p style="color:{{textSecondary}};line-height:1.55">Next skip available ${escapeHtml(opts.nextSkipAvailable)}.</p>
    `),
  });

  return { subject, text, html };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
