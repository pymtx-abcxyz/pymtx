/**
 * Canonical Path B skip endpoint alias.
 * Delegates to /api/skip (invite-token bound, 180d cooldown, ≥3 business days).
 */
export { GET, POST } from "@/app/api/skip/route";
