import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
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
              skipRequests: true,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
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

  return NextResponse.json(customer);
}
