import { inngest } from "./client";
import { runDailyDebitJob } from "@/lib/debit-job";

/**
 * Daily ACSS Debit presenter — midnight America/Toronto.
 * Inngest v4: { id, triggers } + handler.
 */
export const dailyDebitJob = inngest.createFunction(
  {
    id: "harbor-daily-debits",
    retries: 2,
    triggers: [{ cron: "TZ=America/Toronto 0 0 * * *" }],
  },
  async ({ step }) => {
    const result = await step.run("run-daily-debit-job", () =>
      runDailyDebitJob(new Date()),
    );
    return result;
  },
);

/** Manual / event-triggered run (admin API or Inngest invoke). */
export const manualDebitJob = inngest.createFunction(
  {
    id: "harbor-manual-debits",
    retries: 1,
    triggers: [{ event: "harbor/debits.run" }],
  },
  async ({ event, step }) => {
    const asOf = event.data?.asOf ? new Date(String(event.data.asOf)) : new Date();
    const result = await step.run("run-manual-debit-job", () =>
      runDailyDebitJob(asOf),
    );
    return result;
  },
);

export const inngestFunctions = [dailyDebitJob, manualDebitJob];
