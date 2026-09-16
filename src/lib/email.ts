import { appUrl } from "./env";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName: string;
  fromEmail?: string;
};

export type SendEmailResult =
  | { ok: true; provider: "resend" | "demo"; id?: string }
  | { ok: false; provider: string; error: string };

function defaultFromEmail() {
  return process.env.EMAIL_FROM || "noreply@pymtx.com";
}

/**
 * Send transactional email.
 * - EMAIL_PROVIDER=resend + RESEND_API_KEY → Resend
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
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
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

  const html = `
    <div style="font-family:Figtree,system-ui,sans-serif;background:#071426;color:#e8eee9;padding:32px">
      <div style="max-width:480px;margin:0 auto">
        <p style="font-size:14px;letter-spacing:0.12em;text-transform:uppercase;color:#9fb89a;font-weight:700">pymtx</p>
        <h1 style="font-size:22px;line-height:1.3;color:#e8eee9">Sign in to settle with ${escapeHtml(opts.tradeName)}</h1>
        <p style="color:#9fb89a;line-height:1.5">Use this one-time link. It expires in ${opts.minutes} minutes.</p>
        <p style="margin:28px 0">
          <a href="${opts.url}" style="display:inline-block;background:#9fb89a;color:#071426;text-decoration:none;font-weight:700;padding:12px 18px">
            Open secure sign-in
          </a>
        </p>
        <p style="font-size:12px;color:#9fb89a;word-break:break-all">${escapeHtml(opts.url)}</p>
      </div>
    </div>
  `.trim();

  return { subject, text, html };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
