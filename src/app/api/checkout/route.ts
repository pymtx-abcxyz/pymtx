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
} from "@/lib/checkout";

/**
 * Client checkout — invite-token bound.
 * GET  ?token=
 * POST create_plan | accept_pad | status (token required)
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await getCheckoutByInvite(token));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout unavailable" },
      { status: 404 },
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as string;
  const token = String(body.token || "");

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
      return NextResponse.json(plan, { status: 201 });
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
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
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
          business: true,
          invoices: {
            where: { status: { in: ["PAST_DUE", "INVITED", "PLAN_ACTIVE"] } },
            include: {
              paymentPlans: {
                include: {
                  installments: { orderBy: { sequence: "asc" } },
                  padMandate: true,
                },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
            take: 1,
          },
        },
      });
      if (!customer) {
        return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
      }
      return NextResponse.json(customer);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Checkout failed";
    const status =
      /belong|Invalid invite/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
