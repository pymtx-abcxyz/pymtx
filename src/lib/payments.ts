import { addDays } from "date-fns";
import { prisma } from "./db";
import { applicationFeeCents, stripe } from "./stripe";
import {
  DebitAttemptKind,
  DebitAttemptStatus,
  InstallmentStatus,
  PaymentPlanStatus,
} from "./domain";
import {
  applyInstallmentFailure,
  applyInstallmentSuccess,
} from "./settlement";
import {
  assertConnectedAccountDirectCharge,
  assertNoDestinationChargePayload,
} from "./path-b";
import { assertLiveStripeOrDemoAllowed, isStripeDemoMode } from "./env";

/**
 * Zero-custody Direct Charge on the connected business account.
 * Principal → business; Pymtx only takes application_fee_amount.
 * Rail: Canadian ACSS Debit (PAD / EFT).
 *
 * Sync success/failure uses the same settlement helpers as Stripe webhooks
 * so webhook delivery and immediate PI status stay consistent.
 */
export async function chargeInstallment(installmentId: string) {
  assertLiveStripeOrDemoAllowed("chargeInstallment");

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

  const canCharge =
    installment.status === InstallmentStatus.SCHEDULED ||
    installment.status === InstallmentStatus.QUEUED ||
    installment.status === InstallmentStatus.FAILED_NSF;
  if (!canCharge) {
    throw new Error(`Cannot charge installment in status ${installment.status}`);
  }

  const plan = installment.paymentPlan;
  const business = plan.customer.business;

  if (!business.stripeAccountId || !business.stripeChargesEnabled) {
    throw new Error("Business Stripe Connect account is not ready for charges");
  }
  assertConnectedAccountDirectCharge(
    business.stripeAccountId,
    "chargeInstallment",
  );
  if (!plan.stripeCustomerId || !plan.stripePaymentMethodId) {
    throw new Error("Customer PAD payment method is not on file");
  }
  if (!plan.padWrittenConfirmSentAt) {
    throw new Error("Rule H1 written confirmation has not been sent before first debit");
  }

  if (installment.status === InstallmentStatus.FAILED_NSF) {
    if (installment.nsfRetryUsed) {
      throw new Error("NSF retry already used (Rule H1: max 1 re-try)");
    }
    const settings = await prisma.platformSettings.findUnique({
      where: { id: "platform" },
    });
    const windowDays = settings?.nsfRetryWindowDays ?? 30;
    const maxRetries = settings?.nsfRetryMax ?? 1;
    if (maxRetries < 1) {
      throw new Error("NSF retries disabled by platform settings");
    }
    const anchor = installment.originalPresentmentAt ?? installment.lastAttemptAt;
    if (!anchor) throw new Error("Missing presentment timestamp for NSF retry");
    if (new Date() > addDays(anchor, windowDays)) {
      throw new Error(
        `NSF retry window expired (Rule H1: within ${windowDays} days)`,
      );
    }
  }

  const fee = applicationFeeCents(installment.amountCents);
  const attemptKind =
    installment.status === InstallmentStatus.FAILED_NSF
      ? DebitAttemptKind.NSF_RETRY
      : DebitAttemptKind.PRESENTMENT;
  const attemptNumber = installment.attemptCount + 1;
  const idempotencyKey =
    installment.idempotencyKey ||
    `inst_${installmentId}_attempt_${attemptNumber}`;

  const attempt = await prisma.debitAttempt.create({
    data: {
      installmentId,
      attemptNumber,
      kind: attemptKind,
      status: DebitAttemptStatus.PENDING,
      applicationFeeCents: fee,
    },
  });

  await prisma.installment.update({
    where: { id: installmentId },
    data: {
      status: InstallmentStatus.PROCESSING,
      lastAttemptAt: new Date(),
      attemptCount: attemptNumber,
      originalPresentmentAt: installment.originalPresentmentAt ?? new Date(),
      idempotencyKey,
    },
  });

  if (isStripeDemoMode()) {
    // Locked production already failed assertLiveStripeOrDemoAllowed above.
    await applyInstallmentSuccess({
      installmentId,
      paymentIntentId: `pi_demo_${installmentId}`,
      applicationFeeCents: fee,
      attemptId: attempt.id,
    });
    return {
      demo: true,
      paymentIntentId: `pi_demo_${installmentId}`,
      applicationFeeCents: fee,
      attemptId: attempt.id,
    };
  }

  try {
    const piPayload = {
      amount: installment.amountCents,
      currency: "cad",
      customer: plan.stripeCustomerId,
      payment_method: plan.stripePaymentMethodId,
      payment_method_types: ["acss_debit"],
      confirm: true,
      application_fee_amount: fee,
      mandate: plan.stripeMandateId || undefined,
      metadata: {
        pymtx_installment_id: installmentId,
        pymtx_plan_id: plan.id,
        pymtx_invoice_id: plan.invoiceId,
        pymtx_attempt_id: attempt.id,
        zero_custody: "true",
        path_b: "true",
      },
    };
    assertNoDestinationChargePayload(
      piPayload as unknown as Record<string, unknown>,
      "chargeInstallment",
    );

    const paymentIntent = await stripe.paymentIntents.create(piPayload, {
      stripeAccount: business.stripeAccountId,
      idempotencyKey,
    });

    await prisma.debitAttempt.update({
      where: { id: attempt.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    await prisma.installment.update({
      where: { id: installmentId },
      data: {
        stripePaymentIntentId: paymentIntent.id,
        applicationFeeCents: fee,
      },
    });

    if (paymentIntent.status === "succeeded") {
      await applyInstallmentSuccess({
        installmentId,
        paymentIntentId: paymentIntent.id,
        applicationFeeCents: fee,
        attemptId: attempt.id,
      });
    } else if (
      paymentIntent.status === "canceled" ||
      paymentIntent.status === "requires_payment_method"
    ) {
      await applyInstallmentFailure({
        installmentId,
        paymentIntentId: paymentIntent.id,
        attemptId: attempt.id,
        failureCode: paymentIntent.last_payment_error?.code || paymentIntent.status,
        failureMessage:
          paymentIntent.last_payment_error?.message ||
          `PaymentIntent ${paymentIntent.status}`,
      });
    }
    // processing / requires_action → leave PROCESSING; webhook completes settlement

    return {
      demo: false,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      applicationFeeCents: fee,
      attemptId: attempt.id,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Charge failed";
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code?: string }).code || "")
        : "";
    await applyInstallmentFailure({
      installmentId,
      attemptId: attempt.id,
      failureCode: code || null,
      failureMessage: message,
    });
    throw e;
  }
}

/** @deprecated Use startConnectOnboarding from @/lib/stripe-connect */
export { createConnectAccount, startConnectOnboarding } from "./stripe-connect";

/** Candidates for Inngest daily debit job — uses @@index([status, dueDate]). */
export async function findDueInstallments(asOf = new Date()) {
  return prisma.installment.findMany({
    where: {
      status: {
        in: [InstallmentStatus.SCHEDULED, InstallmentStatus.QUEUED],
      },
      dueDate: { lte: asOf },
      paymentPlan: {
        status: PaymentPlanStatus.ACTIVE,
        padWrittenConfirmSentAt: { not: null },
        stripePaymentMethodId: { not: null },
      },
    },
    include: {
      paymentPlan: {
        include: {
          customer: { include: { business: true } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });
}
