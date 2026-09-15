import { prisma } from "./db";

/** Ensure invite token owns the invoice (client checkout binding). */
export async function assertInviteOwnsInvoice(
  inviteToken: string,
  invoiceId: string,
) {
  const customer = await prisma.customer.findUnique({
    where: { inviteToken },
    select: { id: true },
  });
  if (!customer) throw new Error("Invalid invite token");
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, customerId: customer.id },
    select: { id: true },
  });
  if (!invoice) throw new Error("Invoice does not belong to this invite");
  return customer.id;
}

/** Ensure invite token owns the payment plan (PAD accept / skip). */
export async function assertInviteOwnsPlan(
  inviteToken: string,
  paymentPlanId: string,
) {
  const plan = await prisma.paymentPlan.findUnique({
    where: { id: paymentPlanId },
    include: { customer: { select: { id: true, inviteToken: true } } },
  });
  if (!plan) throw new Error("Payment plan not found");
  if (plan.customer.inviteToken !== inviteToken) {
    throw new Error("Payment plan does not belong to this invite");
  }
  return plan;
}
