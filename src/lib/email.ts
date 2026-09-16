import { appUrl } from "./env";

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

function brandedShell(opts: {
  eyebrow: string;
  title: string;
  bodyHtml: string;
  footerNote?: string;
}) {
  return `
    <div style="font-family:Figtree,system-ui,sans-serif;background:#071426;color:#e8eee9;padding:32px">
      <div style="max-width:480px;margin:0 auto">
        <p style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#9fb89a;font-weight:700">${escapeHtml(opts.eyebrow)}</p>
        <h1 style="font-size:22px;line-height:1.3;color:#e8eee9;margin:12px 0 16px">${escapeHtml(opts.title)}</h1>
        ${opts.bodyHtml}
        <p style="margin-top:28px;font-size:11px;color:#9fb89a;line-height:1.5">
          ${opts.footerNote || ""}Powered by pymtx · ${escapeHtml(appUrl())}
        </p>
      </div>
    </div>
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
    `Powered by pymtx · ${appUrl()}`,
  ].join("\n");

  const html = brandedShell({
    eyebrow: "pymtx",
    title: `Sign in to settle with ${opts.tradeName}`,
    bodyHtml: `
      <p style="color:#9fb89a;line-height:1.5">Use this one-time link. It expires in ${opts.minutes} minutes.</p>
      <p style="margin:28px 0">
        <a href="${opts.url}" style="display:inline-block;background:#9fb89a;color:#071426;text-decoration:none;font-weight:700;padding:12px 18px">
          Open secure sign-in
        </a>
      </p>
      <p style="font-size:12px;color:#9fb89a;word-break:break-all">${escapeHtml(opts.url)}</p>
    `,
  });

  return { subject, text, html };
}

function formatCad(cents: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
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
    "You may cancel with at least 10 days' written notice before a scheduled debit (Payments Canada Rule H1).",
    "",
    `Powered by pymtx · ${appUrl()}`,
  ].join("\n");

  const html = brandedShell({
    eyebrow: opts.tradeName,
    title: "Personal PAD confirmation",
    bodyHtml: `
      <p style="color:#9fb89a;line-height:1.55">Written confirmation of your Pre-Authorized Debit with <strong style="color:#e8eee9">${escapeHtml(opts.tradeName)}</strong> (Merchant of Record).</p>
      <ul style="color:#9fb89a;line-height:1.7;padding-left:18px">
        <li>Invoice ${escapeHtml(opts.invoiceRef)}</li>
        <li>${escapeHtml(formatCad(opts.monthlyAmountCents))} monthly</li>
        <li>Account •••• ${escapeHtml(opts.bankLast4)}</li>
        <li>First debit on or after ${escapeHtml(opts.firstDebitDate)}</li>
      </ul>
      <p style="color:#9fb89a;line-height:1.55">Cancel with at least 10 days' written notice before a scheduled debit (Rule H1).</p>
    `,
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
    `Powered by pymtx · ${appUrl()}`,
  ].join("\n");

  const html = brandedShell({
    eyebrow: opts.tradeName,
    title: "Payment receipt",
    bodyHtml: `
      <p style="color:#9fb89a;line-height:1.55">We received your installment payment.</p>
      <ul style="color:#9fb89a;line-height:1.7;padding-left:18px">
        <li>Invoice ${escapeHtml(opts.invoiceRef)}</li>
        <li>Installment #${opts.sequence}: ${escapeHtml(formatCad(opts.amountCents))}</li>
        <li>Date ${escapeHtml(paid)}</li>
      </ul>
    `,
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
    `Powered by pymtx · ${appUrl()}`,
  ].join("\n");

  const html = brandedShell({
    eyebrow: opts.tradeName,
    title: "Payment unsuccessful",
    bodyHtml: `
      <p style="color:#9fb89a;line-height:1.55">A Pre-Authorized Debit could not be completed (often NSF).</p>
      <ul style="color:#9fb89a;line-height:1.7;padding-left:18px">
        <li>Invoice ${escapeHtml(opts.invoiceRef)}</li>
        <li>Installment #${opts.sequence}: ${escapeHtml(formatCad(opts.amountCents))}</li>
      </ul>
      <p style="color:#9fb89a;line-height:1.55">${escapeHtml(retryLine)}</p>
    `,
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
    `Powered by pymtx · ${appUrl()}`,
  ].join("\n");

  const html = brandedShell({
    eyebrow: opts.tradeName,
    title: "Payment skip confirmed",
    bodyHtml: `
      <p style="color:#9fb89a;line-height:1.55">Your ${escapeHtml(formatCad(opts.amountCents))} debit due ${escapeHtml(opts.skippedDue)} was skipped.</p>
      <p style="color:#9fb89a;line-height:1.55">Replacement installment #${opts.appendedSequence} is scheduled for ${escapeHtml(opts.appendedDue)}.</p>
      <p style="color:#9fb89a;line-height:1.55">Next skip available ${escapeHtml(opts.nextSkipAvailable)}.</p>
    `,
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
