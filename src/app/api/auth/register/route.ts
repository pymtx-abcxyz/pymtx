import { NextRequest, NextResponse } from "next/server";
import { createSession, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeUserRole } from "@/lib/domain";
import { clientIp, publicError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { registerMerchant } from "@/lib/register";

/**
 * Public merchant registration — creates Business + OWNER and signs them in.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const ip = clientIp(req);

  const limited = await rateLimit({
    key: `register:${ip}:${email || "anon"}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many registration attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  try {
    const result = await registerMerchant({
      name: String(body.name || ""),
      email,
      password: String(body.password || ""),
      legalName: String(body.legalName || ""),
      tradeName: String(body.tradeName || ""),
      phone: body.phone ? String(body.phone) : undefined,
      ontarioCorpNumber: body.ontarioCorpNumber
        ? String(body.ontarioCorpNumber)
        : undefined,
      physicalAddress: body.physicalAddress
        ? String(body.physicalAddress)
        : undefined,
      supportEmail: body.supportEmail ? String(body.supportEmail) : undefined,
      saasAgreementAccepted: Boolean(body.saasAgreementAccepted),
      caslConsent: Boolean(body.caslConsent),
    });

    await prisma.session.deleteMany({ where: { userId: result.user.id } });
    const session = await createSession(result.user.id);
    const res = NextResponse.json(
      {
        user: {
          ...result.user,
          role: normalizeUserRole(result.user.role),
        },
        business: result.business,
      },
      { status: 201 },
    );
    return setSessionCookie(res, session.token, session.expiresAt);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Registration failed";
    const status = /already exists/i.test(msg) ? 409 : 400;
    const { error } = publicError(e, "Registration failed");
    return NextResponse.json({ error }, { status });
  }
}
