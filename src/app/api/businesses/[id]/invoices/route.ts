import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const invoices = await prisma.invoice.findMany({
    where: { businessId: id },
    include: {
      customer: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          inviteToken: true,
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });
  return NextResponse.json(invoices);
}
