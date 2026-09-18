import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  prisma: {
    installment: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("./stripe", () => ({
  resolvePlatformFeeBps: vi.fn(async () => 250),
  applicationFeeCents: (amount: number, bps: number) =>
    Math.round((amount * bps) / 10_000),
}));

import { prisma } from "./db";
import { assertWebhookSettlementBind } from "./webhook-bind";

const findUnique = prisma.installment.findUnique as ReturnType<typeof vi.fn>;

describe("assertWebhookSettlementBind", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  const baseInstallment = {
    amountCents: 10_000,
    applicationFeeCents: 250,
    stripePaymentIntentId: "pi_bound",
    paymentPlan: {
      customer: { business: { stripeAccountId: "acct_merchant" } },
    },
  };

  it("rejects missing event.account", async () => {
    const err = await assertWebhookSettlementBind({
      installmentId: "inst_1",
      eventAccount: null,
      paymentIntent: {
        id: "pi_bound",
        amount: 10_000,
        application_fee_amount: 250,
      },
    });
    expect(err).toMatch(/missing event\.account/);
  });

  it("rejects account / amount / fee / PI id mismatches", async () => {
    findUnique.mockResolvedValue(baseInstallment);

    expect(
      await assertWebhookSettlementBind({
        installmentId: "inst_1",
        eventAccount: "acct_other",
        paymentIntent: {
          id: "pi_bound",
          amount: 10_000,
          application_fee_amount: 250,
        },
      }),
    ).toMatch(/event\.account/);

    expect(
      await assertWebhookSettlementBind({
        installmentId: "inst_1",
        eventAccount: "acct_merchant",
        paymentIntent: {
          id: "pi_bound",
          amount: 9999,
          application_fee_amount: 250,
        },
      }),
    ).toMatch(/PI amount/);

    expect(
      await assertWebhookSettlementBind({
        installmentId: "inst_1",
        eventAccount: "acct_merchant",
        paymentIntent: {
          id: "pi_bound",
          amount: 10_000,
          application_fee_amount: 1,
        },
      }),
    ).toMatch(/PI fee/);

    expect(
      await assertWebhookSettlementBind({
        installmentId: "inst_1",
        eventAccount: "acct_merchant",
        paymentIntent: {
          id: "pi_other",
          amount: 10_000,
          application_fee_amount: 250,
        },
      }),
    ).toMatch(/PI id/);
  });

  it("accepts a fully bound Path B PI", async () => {
    findUnique.mockResolvedValue(baseInstallment);
    const err = await assertWebhookSettlementBind({
      installmentId: "inst_1",
      eventAccount: "acct_merchant",
      paymentIntent: {
        id: "pi_bound",
        amount: 10_000,
        application_fee_amount: 250,
      },
    });
    expect(err).toBeNull();
  });
});
