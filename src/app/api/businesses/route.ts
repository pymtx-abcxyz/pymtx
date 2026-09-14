import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { agingBucket } from "@/lib/compliance";

export async function GET() {
  const businesses = await prisma.business.findMany({
    include: {
      _count: { select: { invoices: true, customers: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(businesses);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const business = await prisma.business.create({
    data: {
      legalName: body.legalName,
      tradeName: body.tradeName,
      email: body.email,
      phone: body.phone,
      ontarioCorpNumber: body.ontarioCorpNumber,
      caslConsentAt: body.caslConsent ? new Date() : null,
    },
  });
  return NextResponse.json(business, { status: 201 });
}

/** Upload past-due invoices + auto-invite customers (CASL white-labeled). */
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { businessId, invoices } = body as {
    businessId: string;
    invoices: {
      externalRef: string;
      description: string;
      amountCents: number;
      dueDate: string;
      customer: { firstName: string; lastName: string; email: string; phone?: string };
    }[];
  };

  const created = [];
  for (const row of invoices) {
    let customer = await prisma.customer.findUnique({
      where: {
        businessId_email: { businessId, email: row.customer.email },
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          businessId,
          firstName: row.customer.firstName,
          lastName: row.customer.lastName,
          email: row.customer.email,
          phone: row.customer.phone,
          invitedAt: new Date(),
        },
      });
    } else if (!customer.invitedAt) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { invitedAt: new Date() },
      });
    }

    const dueDate = new Date(row.dueDate);
    const invoice = await prisma.invoice.upsert({
      where: {
        businessId_externalRef: { businessId, externalRef: row.externalRef },
      },
      create: {
        businessId,
        customerId: customer.id,
        externalRef: row.externalRef,
        description: row.description,
        originalAmountCents: row.amountCents,
        balanceCents: row.amountCents,
        dueDate,
        status: "INVITED",
        agingBucket: agingBucket(dueDate),
      },
      update: {
        balanceCents: row.amountCents,
        description: row.description,
        agingBucket: agingBucket(dueDate),
      },
    });

    created.push({
      invoice,
      inviteToken: customer.inviteToken,
      // CASL: invite is white-labeled from the business identity (not Harbor)
      caslFrom: (await prisma.business.findUniqueOrThrow({ where: { id: businessId } })).tradeName,
    });
  }

  return NextResponse.json({ uploaded: created.length, items: created });
}
