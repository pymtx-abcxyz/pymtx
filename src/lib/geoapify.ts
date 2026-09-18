/**
 * Geoapify Address Autocomplete — server-side helpers.
 * Ontario Path B: Canada hard-filter + Ontario soft bias.
 */
export type AddressSuggestion = {
  id: string;
  label: string;
  line1: string;
  line2: string;
  city: string | null;
  province: string | null;
  postcode: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
};

/** Soft bias toward Ontario (WGS84). */
const ONTARIO_BIAS_RECT = "-95.16,41.68,-74.34,56.86";

/** Strip apiKey=… from URLs / messages before logging. */
export function redactGeoapifySecrets(text: string): string {
  return text.replace(/([?&]apiKey=)[^&\s"']+/gi, "$1REDACTED");
}

export function geoapifyApiKey(): string {
  return (
    process.env.GEOAPIFY_API_KEY?.trim() ||
    process.env.PYMTX_GEOAPIFY_API_KEY?.trim() ||
    ""
  );
}

export function isGeoapifyConfigured(): boolean {
  const key = geoapifyApiKey();
  return Boolean(key) && !key.includes("placeholder");
}

type GeoapifyResult = {
  place_id?: string | number;
  formatted?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  lat?: number;
  lon?: number;
};

type GeoapifyResponse = {
  results?: GeoapifyResult[];
  error?: string;
  message?: string;
};

export async function fetchAddressSuggestions(
  text: string,
  opts?: { signal?: AbortSignal; limit?: number },
): Promise<AddressSuggestion[]> {
  const key = geoapifyApiKey();
  if (!key || key.includes("placeholder")) return [];

  const q = text.trim();
  if (q.length < 3) return [];

  const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
  url.searchParams.set("text", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("lang", "en");
  url.searchParams.set("limit", String(opts?.limit ?? 5));
  url.searchParams.set("filter", "countrycode:ca");
  url.searchParams.set("bias", `rect:${ONTARIO_BIAS_RECT}`);
  url.searchParams.set("apiKey", key);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: opts?.signal,
      cache: "no-store",
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    throw new Error(redactGeoapifySecrets(raw) || "Geoapify request failed");
  }

  const data = (await res.json().catch(() => ({}))) as GeoapifyResponse;
  if (!res.ok) {
    const detail = data.error || data.message || `Geoapify HTTP ${res.status}`;
    throw new Error(redactGeoapifySecrets(detail));
  }

  return (data.results || []).map((r, i) => ({
    id: String(r.place_id ?? `${r.lat},${r.lon},${i}`),
    label: r.formatted || [r.address_line1, r.address_line2].filter(Boolean).join(", "),
    line1: r.address_line1 || r.formatted || "",
    line2: r.address_line2 || "",
    city: r.city || null,
    province: r.state || null,
    postcode: r.postcode || null,
    country: r.country || null,
    lat: typeof r.lat === "number" ? r.lat : null,
    lon: typeof r.lon === "number" ? r.lon : null,
  }));
}
