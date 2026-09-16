import { describe, expect, it } from "vitest";
import {
  agingBucketLabel,
  goLiveCheckLabel,
  installmentStatusLabel,
  invoiceStatusLabel,
  invoiceStatusTone,
} from "./status-labels";

describe("status-labels", () => {
  it("maps invoice statuses", () => {
    expect(invoiceStatusLabel("PLAN_ACTIVE")).toBe("Plan active");
    expect(invoiceStatusTone("PAST_DUE")).toBe("warning");
    expect(invoiceStatusTone("SETTLED")).toBe("success");
  });

  it("maps aging buckets", () => {
    expect(agingBucketLabel("1-30")).toBe("1–30 days");
    expect(agingBucketLabel("90+")).toBe("90+ days");
  });

  it("maps installment statuses", () => {
    expect(installmentStatusLabel("FAILED_NSF")).toBe("NSF failed");
    expect(installmentStatusLabel("SUCCEEDED")).toBe("Paid");
  });

  it("maps go-live check ids", () => {
    expect(goLiveCheckLabel("stripe_webhook")).toBe("Webhook secret");
    expect(goLiveCheckLabel("inngest")).toBe("Inngest");
  });
});
