import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  assertInviteOwnsInvoice,
  assertInviteOwnsPlan,
} from "@/lib/invite-access";
import {
  completeCheckoutPad,
  createCheckoutPlan,
  getCheckoutByInvite,
  toClientPlanDto,
} from "@/lib/checkout";
import { clientIp, publicError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

async function guardCheckout(req: NextRequest) {
  const limited = await rateLimit({
    key: `checkout:${clientIp(req)}`,
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
  return null;
}

/**
 * Client checkout — invite-token bound.
 * GET  ?token=
 * POST create_plan | accept_pad | status (token required)
 */
export async function GET(req: NextRequest) {
  const blocked = await guardCheckout(req);
  if (blocked) return blocked;

  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await getCheckoutByInvite(token));
  } catch {
    return NextResponse.json({ error: "Checkout unavailable" }, { status: 404 });
  }
}

export async function POST(req: NextRequest) {
  const blocked = await guardCheckout(req);
  if (blocked) return blocked;

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  const token = String(body.token || "");
  const ip = clientIp(req);

  try {
    if (action === "create_plan") {
      if (!token) {
        return NextResponse.json({ error: "token required" }, { status: 401 });
      }
      await assertInviteOwnsInvoice(token, body.invoiceId);
      const plan = await createCheckoutPlan({
        invoiceId: body.invoiceId,
        termMonths: body.termMonths,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
      });
      return NextResponse.json(toClientPlanDto(plan), { status: 201 });
    }

    if (action === "accept_pad") {
      if (!token) {
        return NextResponse.json({ error: "token required" }, { status: 401 });
      }
      await assertInviteOwnsPlan(token, body.paymentPlanId);
      const plan = await completeCheckoutPad({
        paymentPlanId: body.paymentPlanId,
        payorName: body.payorName,
        payorEmail: body.payorEmail,
        bankLast4: body.bankLast4,
        institutionName: body.institutionName,
        transitNumber: body.transitNumber,
        institutionNumber: body.institutionNumber,
        accountNumber: body.accountNumber,
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || undefined,
      });
      return NextResponse.json(plan);
    }

    if (action === "status") {
      if (!token) {
        return NextResponse.json({ error: "token required" }, { status: 401 });
      }
      const customer = await prisma.customer.findUnique({
        where: { inviteToken: token },
        include: {
          business: { select: { tradeName: true } },
          invoices: {
            where: { status: { in: ["PAST_DUE", "INVITED", "PLAN_ACTIVE"] } },
            select: {
              id: true,
              externalRef: true,
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
                  startDate: true,
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
                    select: { bankLast4: true, institutionName: true },
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
      return NextResponse.json({
        customerId: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        businessTradeName: customer.business.tradeName,
        invoices: customer.invoices.map((inv) => ({
          id: inv.id,
          externalRef: inv.externalRef,
          balanceCents: inv.balanceCents,
          status: inv.status,
          paymentPlans: inv.paymentPlans.map((p) => toClientPlanDto(p)),
        })),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const { error } = publicError(e, "Checkout failed");
    return NextResponse.json({ error }, { status: 400 });
  }
}
