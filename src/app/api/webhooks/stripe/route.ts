/**
 * Stripe Connect webhook alias — preferred path for Connect Direct Charge events.
 * Signature validated with STRIPE_CONNECT_WEBHOOK_SECRET || STRIPE_WEBHOOK_SECRET.
 */
export { POST } from "@/app/api/stripe/webhook/route";
