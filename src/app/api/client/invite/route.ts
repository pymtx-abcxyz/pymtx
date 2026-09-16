import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Invite lookup — returns a trimmed DTO (no raw Prisma graph).
 */
export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimit({
    key: `invite:${ip}`,
    limit: 60,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({
    where: { inviteToken: token },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      inviteToken: true,
      activatedAt: true,
      business: { select: { id: true, tradeName: true, legalName: true } },
      invoices: {
        where: { status: { in: ["PAST_DUE", "INVITED", "PLAN_ACTIVE"] } },
        select: {
          id: true,
          externalRef: true,
          description: true,
          balanceCents: true,
          status: true,
          paymentPlans: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              termMonths: true,
              monthlyAmountCents: true,
              disputeFrozenAt: true,
              disputeReason: true,
              installments: {
                orderBy: { sequence: "asc" },
                select: {
                  id: true,
                  sequence: true,
                  dueDate: true,
                  amountCents: true,
                  status: true,
                },
              },
              padMandate: {
                select: {
                  bankLast4: true,
                  institutionName: true,
                  cancelledAt: true,
                },
              },
              skipRequests: {
                select: { id: true, status: true, requestedAt: true },
              },
            },
          },
        },
      },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
  }

  if (!customer.activatedAt) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { activatedAt: new Date() },
    });
  }

  return NextResponse.json({
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    inviteToken: customer.inviteToken,
    business: customer.business,
    invoices: customer.invoices,
  });
}
