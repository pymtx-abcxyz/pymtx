import { addDays } from "date-fns";
import { prisma } from "./db";
import { applicationFeeCents, platformFeeBps, stripe } from "./stripe";

/**
 * Zero-Custody Direct Settlement via Stripe Connect Direct Charges.
 * Funds land on the business connected account; Harbor only takes application_fee_amount.
 * Payment method: Canadian ACSS Debit (PAD / EFT).
 */
export async function chargeInstallment(installmentId: string) {
  const installment = await prisma.installment.findUnique({
    where: { id: installmentId },
    include: {
      paymentPlan: {
        include: {
          customer: { include: { business: true } },
          invoice: true,
        },
      },
    },
  });

  if (!installment) throw new Error("Installment not found");
  if (installment.status !== "SCHEDULED" && installment.status !== "FAILED_NSF") {
    throw new Error(`Cannot charge installment in status ${installment.status}`);
  }

  const plan = installment.paymentPlan;
  const business = plan.customer.business;

  if (!business.stripeAccountId || !business.stripeOnboardingComplete) {
    throw new Error("Business Stripe Connect account is not ready");
  }
  if (!plan.stripeCustomerId || !plan.stripePaymentMethodId) {
    throw new Error("Customer PAD payment method is not on file");
  }
  if (!plan.padWrittenConfirmSentAt) {
    throw new Error("Rule H1 written confirmation has not been sent before first debit");
  }

  // NSF Rule H1: max 1 retry within 30 days of original attempt
  if (installment.status === "FAILED_NSF") {
    if (installment.nsfRetryUsed) {
      throw new Error("NSF retry already used (Rule H1: max 1 re-try)");
    }
    if (!installment.lastAttemptAt) {
      throw new Error("Missing last attempt timestamp for NSF retry");
    }
    const windowEnd = addDays(installment.lastAttemptAt, 30);
    if (new Date() > windowEnd) {
      throw new Error("NSF retry window expired (Rule H1: within 30 days)");
    }
  }

  const fee = applicationFeeCents(installment.amountCents);
  const isDemo = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes("placeholder");

  await prisma.installment.update({
    where: { id: installmentId },
    data: { status: "PROCESSING", lastAttemptAt: new Date(), attemptCount: { increment: 1 } },
  });

  if (isDemo) {
    // Demo mode: simulate successful direct charge without calling Stripe
    await prisma.$transaction([
      prisma.installment.update({
        where: { id: installmentId },
        data: {
          status: "SUCCEEDED",
          paidAt: new Date(),
          applicationFeeCents: fee,
          stripePaymentIntentId: `pi_demo_${installmentId}`,
          nsfRetryUsed: installment.status === "FAILED_NSF" ? true : installment.nsfRetryUsed,
        },
      }),
      prisma.transactionMetric.create({
        data: {
          businessId: business.id,
          installmentId,
          principalCents: installment.amountCents,
          applicationFeeCents: fee,
          feeBps: platformFeeBps(),
        },
      }),
      prisma.invoice.update({
        where: { id: plan.invoiceId },
        data: { balanceCents: { decrement: installment.amountCents } },
      }),
    ]);

    await maybeCompletePlan(plan.id);
    return { demo: true, paymentIntentId: `pi_demo_${installmentId}`, applicationFeeCents: fee };
  }

  // Production: Stripe Connect Direct Charge with ACSS Debit
  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: installment.amountCents,
      currency: "cad",
      customer: plan.stripeCustomerId,
      payment_method: plan.stripePaymentMethodId,
      payment_method_types: ["acss_debit"],
      confirm: true,
      application_fee_amount: fee,
      mandate_data: {
        customer_acceptance: {
          type: "online",
          online: {
            ip_address: "0.0.0.0",
            user_agent: "Harbor/1.0",
          },
        },
      },
      metadata: {
        harbor_installment_id: installmentId,
        harbor_plan_id: plan.id,
        harbor_invoice_id: plan.invoiceId,
        zero_custody: "true",
      },
    },
    {
      stripeAccount: business.stripeAccountId,
    },
  );

  await prisma.installment.update({
    where: { id: installmentId },
    data: {
      stripePaymentIntentId: paymentIntent.id,
      applicationFeeCents: fee,
      // ACSS is async; webhook will flip to SUCCEEDED / FAILED_NSF
      status: paymentIntent.status === "succeeded" ? "SUCCEEDED" : "PROCESSING",
      paidAt: paymentIntent.status === "succeeded" ? new Date() : null,
      nsfRetryUsed: installment.status === "FAILED_NSF" ? true : installment.nsfRetryUsed,
    },
  });

  if (paymentIntent.status === "succeeded") {
    await prisma.transactionMetric.create({
      data: {
        businessId: business.id,
        installmentId,
        principalCents: installment.amountCents,
        applicationFeeCents: fee,
        feeBps: platformFeeBps(),
      },
    });
    await prisma.invoice.update({
      where: { id: plan.invoiceId },
      data: { balanceCents: { decrement: installment.amountCents } },
    });
    await maybeCompletePlan(plan.id);
  }

  return { demo: false, paymentIntentId: paymentIntent.id, applicationFeeCents: fee };
}

async function maybeCompletePlan(planId: string) {
  const remaining = await prisma.installment.count({
    where: {
      paymentPlanId: planId,
      status: { in: ["SCHEDULED", "PROCESSING", "FAILED_NSF", "FAILED"] },
    },
  });
  if (remaining === 0) {
    const plan = await prisma.paymentPlan.update({
      where: { id: planId },
      data: { status: "COMPLETED" },
    });
    await prisma.invoice.update({
      where: { id: plan.invoiceId },
      data: { status: "SETTLED", balanceCents: 0 },
    });
  }
}

/**
 * Create Stripe Connect Express account for an Ontario business (Merchant of Record).
 */
export async function createConnectAccount(businessId: string) {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  const isDemo = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes("placeholder");

  if (isDemo) {
    const accountId = `acct_demo_${businessId.slice(-8)}`;
    await prisma.business.update({
      where: { id: businessId },
      data: { stripeAccountId: accountId, stripeOnboardingComplete: true },
    });
    return { accountId, url: null, demo: true };
  }

  const account =
    business.stripeAccountId
      ? await stripe.accounts.retrieve(business.stripeAccountId)
      : await stripe.accounts.create({
          type: "express",
          country: "CA",
          email: business.email,
          capabilities: {
            acss_debit_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: "company",
          metadata: { harbor_business_id: businessId },
        });

  if (!business.stripeAccountId) {
    await prisma.business.update({
      where: { id: businessId },
      data: { stripeAccountId: account.id },
    });
  }

  const link = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/business/settings?stripe=refresh`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/business/settings?stripe=return`,
    type: "account_onboarding",
  });

  return { accountId: account.id, url: link.url, demo: false };
}
