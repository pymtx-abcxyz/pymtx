import { NextRequest, NextResponse } from "next/server";
import {
  fetchAddressSuggestions,
  isGeoapifyConfigured,
} from "@/lib/geoapify";
import { clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Proxied Geoapify address autocomplete (Canada / Ontario-biased).
 * Keeps GEOAPIFY_API_KEY server-side.
 *
 * GET /api/address/autocomplete?q=70+Taunton
 */
export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimit({
    key: `address-autocomplete:${ip}`,
    limit: 60,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  if (!isGeoapifyConfigured()) {
    return NextResponse.json({
      configured: false,
      suggestions: [] as const,
    });
  }

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 3) {
    return NextResponse.json({ configured: true, suggestions: [] });
  }
  if (q.length > 200) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  try {
    const suggestions = await fetchAddressSuggestions(q, { limit: 5 });
    return NextResponse.json({ configured: true, suggestions });
  } catch (e) {
    console.error("[address-autocomplete]", e);
    return NextResponse.json(
      { error: "Address lookup unavailable" },
      { status: 502 },
    );
  }
}
