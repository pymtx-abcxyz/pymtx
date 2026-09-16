import { addMinutes } from "date-fns";
import { nanoid } from "nanoid";
import { prisma } from "./db";
import { CaslMessageKind } from "./domain";
import { appUrl } from "./env";
import { createCustomerSession } from "./auth";
import { magicLinkEmail, sendEmail } from "./email";

const MAGIC_LINK_TTL_MINUTES = 20;

export type MagicLinkRequestResult = {
  ok: true;
  /** Present when email provider is demo / unset. */
  demoUrl?: string;
  message: string;
};

function isEmailDemoMode() {
  const provider = (process.env.EMAIL_PROVIDER || "demo").toLowerCase();
  return (
    provider === "demo" ||
    !process.env.EMAIL_PROVIDER ||
    (provider === "resend" && !process.env.RESEND_API_KEY)
  );
}

/**
 * Issue a one-time magic link for a customer email.
 * Generic response avoids email enumeration.
 */
export async function requestCustomerMagicLink(
  email: string,
): Promise<MagicLinkRequestResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) {
    throw new Error("Valid email required");
  }

  const customer = await prisma.customer.findFirst({
    where: { email: normalized },
    include: { business: true },
    orderBy: [{ invitedAt: "desc" }, { createdAt: "desc" }],
  });

  if (!customer) {
    return {
      ok: true,
      message: "If that email is on file, a sign-in link is on its way.",
    };
  }

  const token = nanoid(48);
  const expiresAt = addMinutes(new Date(), MAGIC_LINK_TTL_MINUTES);

  await prisma.magicLink.create({
    data: {
      token,
      customerId: customer.id,
      email: normalized,
      expiresAt,
    },
  });

  const url = `${appUrl()}/api/auth/magic-link/verify?token=${encodeURIComponent(token)}`;
  const mail = magicLinkEmail({
    tradeName: customer.business.tradeName,
    url,
    minutes: MAGIC_LINK_TTL_MINUTES,
  });

  await prisma.caslMessage.create({
    data: {
      businessId: customer.businessId,
      customerId: customer.id,
      kind: CaslMessageKind.MAGIC_LINK,
      fromName: customer.business.tradeName,
      toEmail: normalized,
      subject: mail.subject,
      bodyPreview: `Your secure pymtx sign-in link expires in ${MAGIC_LINK_TTL_MINUTES} minutes.`,
    },
  });

  const sent = await sendEmail({
    to: normalized,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    fromName: customer.business.tradeName,
  });

  if (!sent.ok) {
    throw new Error(`Could not send sign-in email: ${sent.error}`);
  }

  const demo = isEmailDemoMode() || sent.provider === "demo";

  return {
    ok: true,
    message: "If that email is on file, a sign-in link is on its way.",
    demoUrl: demo ? url : undefined,
  };
}

export async function consumeMagicLink(token: string) {
  const link = await prisma.magicLink.findUnique({
    where: { token },
    include: { customer: true },
  });
  if (!link || link.usedAt || link.expiresAt < new Date()) {
    throw new Error("This sign-in link is invalid or expired");
  }

  await prisma.magicLink.update({
    where: { id: link.id },
    data: { usedAt: new Date() },
  });

  if (!link.customer.activatedAt) {
    await prisma.customer.update({
      where: { id: link.customerId },
      data: { activatedAt: new Date() },
    });
  }

  const session = await createCustomerSession(link.customerId);
  return {
    session,
    customer: link.customer,
    inviteToken: link.customer.inviteToken,
  };
}
