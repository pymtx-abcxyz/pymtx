import { inngest } from "./client";
import {
  processDailyInstallments,
  runDailyDebitJob,
} from "@/lib/debit-job";
import { flushDeferredNotices } from "@/lib/deferred-notices";

/**
 * Daily ACSS Debit presenter — midnight America/Toronto.
 * Alias: processDailyInstallments → runDailyDebitJob
 * Direct Charges on connected accounts with application_fee_amount.
 */
export const dailyDebitJob = inngest.createFunction(
  {
    id: "pymtx-daily-debits",
    name: "processDailyInstallments",
    retries: 2,
    triggers: [{ cron: "TZ=America/Toronto 0 0 * * *" }],
  },
  async ({ step }) => {
    const result = await step.run("processDailyInstallments", () =>
      processDailyInstallments(new Date()),
    );
    return result;
  },
);

/** Manual / event-triggered run (admin API or Inngest invoke). */
export const manualDebitJob = inngest.createFunction(
  {
    id: "pymtx-manual-debits",
    retries: 1,
    triggers: [{ event: "pymtx/debits.run" }],
  },
  async ({ event, step }) => {
    const asOf = event.data?.asOf ? new Date(String(event.data.asOf)) : new Date();
    const result = await step.run("run-manual-debit-job", () =>
      runDailyDebitJob(asOf),
    );
    return result;
  },
);

/**
 * Flush CDSSA-deferred debtor notices during Ontario contact hours.
 * Hourly cron; no-ops outside the window.
 */
export const deferredNoticeFlush = inngest.createFunction(
  {
    id: "pymtx-deferred-notices",
    name: "flushDeferredNotices",
    retries: 1,
    triggers: [{ cron: "TZ=America/Toronto 15 * * * *" }],
  },
  async ({ step }) => {
    return step.run("flushDeferredNotices", () => flushDeferredNotices(new Date()));
  },
);

export const inngestFunctions = [
  dailyDebitJob,
  manualDebitJob,
  deferredNoticeFlush,
];
