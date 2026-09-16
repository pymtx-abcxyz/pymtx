/**
 * Rate limiter — Redis when REDIS_URL is set, otherwise in-memory fallback.
 * API is sync-compatible via async rateLimit(); prefer rateLimitAsync in routes.
 */

import Redis from "ioredis";

type Bucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, Bucket>();

let redis: Redis | null | undefined;

function redisUrl() {
  return process.env.REDIS_URL?.trim() || process.env.KV_URL?.trim() || "";
}

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = redisUrl();
  if (!url) {
    redis = null;
    return null;
  }
  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    redis.on("error", () => {
      /* fall through to memory on command failure */
    });
    return redis;
  } catch {
    redis = null;
    return null;
  }
}

function memoryRateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): { ok: true; backend: "memory" } | { ok: false; retryAfterSec: number; backend: "memory" } {
  // Opportunistic prune so long-lived nodes do not grow unbounded.
  if (memoryBuckets.size > 2000) pruneRateLimits();

  const now = Date.now();
  const existing = memoryBuckets.get(opts.key);
  if (!existing || existing.resetAt <= now) {
    memoryBuckets.set(opts.key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, backend: "memory" };
  }
  if (existing.count >= opts.limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      backend: "memory",
    };
  }
  existing.count += 1;
  return { ok: true, backend: "memory" };
}

/** Async rate limit — uses Redis INCR+PEXPIRE when available. */
export async function rateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<
  | { ok: true; backend: "redis" | "memory" }
  | { ok: false; retryAfterSec: number; backend: "redis" | "memory" }
> {
  const client = getRedis();
  if (!client) return memoryRateLimit(opts);

  const redisKey = `pymtx:rl:${opts.key}`;
  try {
    if (client.status !== "ready") {
      await client.connect().catch(() => undefined);
    }
    const count = await client.incr(redisKey);
    if (count === 1) {
      await client.pexpire(redisKey, opts.windowMs);
    }
    if (count > opts.limit) {
      const pttl = await client.pttl(redisKey);
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil((pttl > 0 ? pttl : opts.windowMs) / 1000)),
        backend: "redis",
      };
    }
    return { ok: true, backend: "redis" };
  } catch {
    return memoryRateLimit(opts);
  }
}

/** @deprecated sync helper — memory only; prefer await rateLimit() */
export function rateLimitSync(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): { ok: true } | { ok: false; retryAfterSec: number } {
  const result = memoryRateLimit(opts);
  if (result.ok) return { ok: true };
  return { ok: false, retryAfterSec: result.retryAfterSec };
}

export function pruneRateLimits() {
  const now = Date.now();
  for (const [k, v] of memoryBuckets) {
    if (v.resetAt <= now) memoryBuckets.delete(k);
  }
}

export function rateLimitBackend(): "redis" | "memory" {
  return redisUrl() ? "redis" : "memory";
}
