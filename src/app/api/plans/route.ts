import { NextRequest, NextResponse } from "next/server";
import { acceptPadMandate, createPaymentPlan } from "@/lib/plans";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  try {
    if (action === "create") {
      const plan = await createPaymentPlan({
        invoiceId: body.invoiceId,
        termMonths: body.termMonths,
        startDate: new Date(body.startDate || Date.now() + 7 * 86400000),
      });
      return NextResponse.json(plan, { status: 201 });
    }

    if (action === "accept_pad") {
      const plan = await acceptPadMandate({
        paymentPlanId: body.paymentPlanId,
        payorName: body.payorName,
        payorEmail: body.payorEmail,
        bankLast4: body.bankLast4,
        institutionName: body.institutionName,
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
        userAgent: req.headers.get("user-agent") || undefined,
      });
      return NextResponse.json(plan);
    }

    if (action === "get") {
      const plan = await prisma.paymentPlan.findUnique({
        where: { id: body.paymentPlanId },
        include: {
          installments: { orderBy: { sequence: "asc" } },
          padMandate: true,
          invoice: true,
          customer: { include: { business: true } },
          skipRequests: true,
        },
      });
      return NextResponse.json(plan);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Plan error" },
      { status: 400 },
    );
  }
}
