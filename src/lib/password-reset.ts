import { addMinutes } from "date-fns";
import { nanoid } from "nanoid";
import { hashPassword, MIN_PASSWORD_LENGTH } from "./auth";
import { prisma } from "./db";
import { passwordResetEmail, sendEmail } from "./email";
import { allowDemoMode, appUrl } from "./env";
import { PROVIDER } from "./legal";

const RESET_TTL_MINUTES = 30;

export type PasswordResetRequestResult = {
  ok: true;
  message: string;
  /** Present only when demo mode is explicitly allowed and send succeeded. */
  demoUrl?: string;
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
 * Issue a one-time password-reset link for a staff User.
 * Always returns a generic message (anti-enumeration).
 */
export async function requestPasswordReset(
  email: string,
): Promise<PasswordResetRequestResult> {
  const normalized = email.trim().toLowerCase();
  const generic = {
    ok: true as const,
    message:
      "If that email is registered, a password-reset link is on its way.",
  };

  if (!normalized.includes("@")) {
    return generic;
  }

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) {
    return generic;
  }

  // Invalidate prior unused tokens for this user.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = nanoid(48);
  const expiresAt = addMinutes(new Date(), RESET_TTL_MINUTES);
  await prisma.passwordResetToken.create({
    data: { token, userId: user.id, expiresAt },
  });

  const url = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const mail = passwordResetEmail({
    name: user.name,
    url,
    minutes: RESET_TTL_MINUTES,
  });

  const sent = await sendEmail({
    to: normalized,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    fromName: PROVIDER.brand,
  });
  // Never reveal send failures to the client (email enumeration).
  if (!sent.ok) {
    console.error("[password-reset] email failed", sent.error);
  }

  // Match magic-link: demoUrl only when demo is allowed AND send succeeded.
  // Returning the URL for known emails otherwise enumerates accounts and leaks tokens.
  const demo =
    allowDemoMode() &&
    sent.ok &&
    (isEmailDemoMode() || sent.provider === "demo");

  return { ...generic, ...(demo ? { demoUrl: url } : {}) };
}

export async function resetPasswordWithToken(params: {
  token: string;
  password: string;
}) {
  const token = params.token.trim();
  const password = params.password;

  if (!token) throw new Error("Reset token required");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new Error("This reset link is invalid or has expired");
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    });
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    // Rotate all sessions for this user.
    await tx.session.deleteMany({ where: { userId: record.userId } });
    // Invalidate other unused reset tokens.
    await tx.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      data: { usedAt: new Date() },
    });
  });

  return {
    email: record.user.email,
    name: record.user.name,
  };
}

export function assertPasswordStrength(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
}
