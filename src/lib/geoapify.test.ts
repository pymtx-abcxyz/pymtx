import { describe, expect, it } from "vitest";
import { isGeoapifyConfigured } from "./geoapify";

describe("geoapify helpers", () => {
  it("treats missing or placeholder keys as unconfigured", () => {
    const prev = process.env.GEOAPIFY_API_KEY;
    const prevAlias = process.env.PYMTX_GEOAPIFY_API_KEY;
    delete process.env.GEOAPIFY_API_KEY;
    delete process.env.PYMTX_GEOAPIFY_API_KEY;
    expect(isGeoapifyConfigured()).toBe(false);

    process.env.GEOAPIFY_API_KEY = "placeholder";
    expect(isGeoapifyConfigured()).toBe(false);

    process.env.GEOAPIFY_API_KEY = "real-looking-key-abc123";
    expect(isGeoapifyConfigured()).toBe(true);

    if (prev === undefined) delete process.env.GEOAPIFY_API_KEY;
    else process.env.GEOAPIFY_API_KEY = prev;
    if (prevAlias === undefined) delete process.env.PYMTX_GEOAPIFY_API_KEY;
    else process.env.PYMTX_GEOAPIFY_API_KEY = prevAlias;
  });
});
