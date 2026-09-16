import { NextResponse } from "next/server";
import Redis from "ioredis";
import { isProduction } from "@/lib/env";
import { rateLimitBackend } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Lightweight ops probe — no secrets returned.
 */
export async function GET() {
  const configured = Boolean(process.env.REDIS_URL?.trim() || process.env.KV_URL?.trim());
  let redis: "ok" | "error" | "unconfigured" = "unconfigured";
  let detail: string | undefined;

  if (configured) {
    const url = (process.env.REDIS_URL || process.env.KV_URL)!.trim();
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
      connectTimeout: 5000,
    });
    try {
      await client.connect();
      const pong = await client.ping();
      redis = pong === "PONG" ? "ok" : "error";
      if (redis !== "ok") detail = `unexpected ping: ${pong}`;
      await client.quit().catch(() => undefined);
    } catch (e) {
      redis = "error";
      detail = e instanceof Error ? e.message : "redis connect failed";
      try {
        client.disconnect();
      } catch {
        /* ignore */
      }
    }
  }

  const ok = !configured || redis === "ok";
  return NextResponse.json(
    {
      ok,
      app: "pymtx",
      rateLimitBackend: rateLimitBackend(),
      redis,
      ...(!isProduction() && detail ? { detail } : {}),
    },
    { status: ok ? 200 : 503 },
  );
}
