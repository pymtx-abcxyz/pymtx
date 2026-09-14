import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { inngestFunctions } from "@/inngest/functions";

/**
 * Inngest HTTP handler.
 * Local: npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
