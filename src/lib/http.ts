import type { NextRequest } from "next/server";

/**
 * Prefer platform-set headers over client-spoofable X-Forwarded-For.
 * Vercel sets x-real-ip / x-vercel-forwarded-for; fall back to last XFF hop
 * only when those are absent (local / unknown proxies).
 */
export function clientIp(req: NextRequest): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const vercelFwd = req.headers.get("x-vercel-forwarded-for")?.trim();
  if (vercelFwd) {
    const first = vercelFwd.split(",")[0]?.trim();
    if (first) return first;
  }

  // Last hop is usually the edge that appended; ignore attacker-supplied first hop.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1]!;
  }

  return "local";
}

/** Generic client-facing error; log details server-side. */
export function publicError(
  e: unknown,
  fallback: string,
): { error: string; log: string } {
  const log = e instanceof Error ? e.message : fallback;
  console.error("[api]", fallback, log);
  // Allow known safe client messages (validation / auth).
  if (
    e instanceof Error &&
    /required|Invalid|Forbidden|Unauthorized|belong|not found|Too many|misconfigured|placeholder|ALLOW_DEMO|Term must|Bank last|Plan is not|Skip|window|cooldown|Creditor has not|active or pending|no balance/i.test(
      e.message,
    )
  ) {
    return { error: e.message, log };
  }
  return { error: fallback, log };
}
