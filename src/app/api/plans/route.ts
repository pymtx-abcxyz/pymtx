import { NextRequest, NextResponse } from "next/server";
import { isAuthUser, requireUser } from "@/lib/auth";
import { UserRole } from "@/lib/domain";
import { assertLiveStripeOrDemoAllowed } from "@/lib/env";
import { clientIp, publicError } from "@/lib/http";
import { acceptPadMandate, createPaymentPlan } from "@/lib/plans";
import { prisma } from "@/lib/db";

/**
 * Legacy plans API — ADMIN only.
 * Client flows use /api/checkout with invite token.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req, { roles: [UserRole.ADMIN] });
  if (!isAuthUser(user)) return user;

  const body = await req.json();
  const { action } = body;

  try {
    if (action === "create") {
      const plan = await createPaymentPlan({
        invoiceId: body.invoiceId,
        termMonths: body.termMonths,
        startDate: new Date(body.startDate || Date.now() + 7 * 86400000),
      });
      return NextResponse.json(
        {
          id: plan.id,
          status: plan.status,
          termMonths: plan.termMonths,
          monthlyAmountCents: plan.monthlyAmountCents,
          totalAmountCents: plan.totalAmountCents,
          installments: plan.installments.map((i) => ({
            id: i.id,
            sequence: i.sequence,
            dueDate: i.dueDate,
            amountCents: i.amountCents,
            status: i.status,
          })),
        },
        { status: 201 },
      );
    }

    if (action === "accept_pad") {
      assertLiveStripeOrDemoAllowed("plans accept_pad");
      const plan = await acceptPadMandate({
        paymentPlanId: body.paymentPlanId,
        payorName: body.payorName,
        payorEmail: body.payorEmail,
        bankLast4: body.bankLast4,
        institutionName: body.institutionName,
        stripeCustomerId: body.stripeCustomerId,
        stripePaymentMethodId: body.stripePaymentMethodId,
        stripeMandateId: body.stripeMandateId,
        ipAddress: clientIp(req),
        userAgent: req.headers.get("user-agent") || undefined,
      });
      return NextResponse.json(plan);
    }

    if (action === "get") {
      const plan = await prisma.paymentPlan.findUnique({
        where: { id: body.paymentPlanId },
        select: {
          id: true,
          status: true,
          termMonths: true,
          monthlyAmountCents: true,
          totalAmountCents: true,
          startDate: true,
          padMandateAcceptedAt: true,
          padWrittenConfirmSentAt: true,
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
              acceptedAt: true,
            },
          },
          invoice: {
            select: {
              id: true,
              externalRef: true,
              balanceCents: true,
              status: true,
            },
          },
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              business: { select: { id: true, tradeName: true } },
            },
          },
          skipRequests: {
            orderBy: { requestedAt: "desc" },
            take: 10,
            select: {
              id: true,
              status: true,
              requestedAt: true,
              appendedSequence: true,
            },
          },
        },
      });
      return NextResponse.json(plan);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const { error } = publicError(e, "Plan error");
    return NextResponse.json({ error }, { status: 400 });
  }
}
