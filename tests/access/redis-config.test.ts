import { describe, expect, it } from "vitest";
import { getRedisRestConfig } from "@/lib/redis-config";

describe("getRedisRestConfig", () => {
  it("prefers the Vercel-connected Upstash database (KV_REST_API_*)", () => {
    expect(
      getRedisRestConfig({
        KV_REST_API_URL: "https://new.upstash.io",
        KV_REST_API_TOKEN: "new-token",
        UPSTASH_REDIS_REST_URL: "https://old.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "old-token",
      })
    ).toEqual({ url: "https://new.upstash.io", token: "new-token" });
  });

  it("falls back to the manual UPSTASH_REDIS_REST_* variables", () => {
    expect(
      getRedisRestConfig({ UPSTASH_REDIS_REST_URL: "https://old.upstash.io", UPSTASH_REDIS_REST_TOKEN: "old-token" })
    ).toEqual({ url: "https://old.upstash.io", token: "old-token" });
  });

  it("never mixes a URL from one database with a token from another", () => {
    expect(
      getRedisRestConfig({ KV_REST_API_URL: "https://new.upstash.io", UPSTASH_REDIS_REST_URL: "https://old.upstash.io", UPSTASH_REDIS_REST_TOKEN: "old-token" })
    ).toEqual({ url: "https://old.upstash.io", token: "old-token" });
  });

  it("returns null when nothing is configured", () => {
    expect(getRedisRestConfig({})).toBeNull();
  });
});
