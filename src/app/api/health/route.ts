import { NextResponse } from "next/server";
import Redis from "ioredis";
import { rateLimitBackend } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Lightweight ops probe — no secrets returned.
 */
export async function GET() {
  const configured = Boolean(process.env.REDIS_URL?.trim());
  let redis: "ok" | "error" | "unconfigured" = "unconfigured";
  let detail: string | undefined;

  if (configured) {
    const client = new Redis(process.env.REDIS_URL!.trim(), {
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
      ...(detail ? { detail } : {}),
    },
    { status: ok ? 200 : 503 },
  );
}
