import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const { limitMock } = vi.hoisted(() => ({ limitMock: vi.fn() }));
vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = vi.fn();
    limit = limitMock;
  },
}));

let applyRateLimit: typeof import("@/lib/rate-limit").applyRateLimit;
const request = (ip = "192.0.2.1") => new Request("https://prepspsc.com/api/auth/verify-captcha", {
  headers: { "x-forwarded-for": ip },
});
const fallback = { fallback: "local-auth" } as const;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-19T04:00:00Z"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("KV_REST_API_URL", "https://redis.example.test");
  vi.stubEnv("KV_REST_API_TOKEN", "test-token");
  limitMock.mockReset().mockRejectedValue(new Error("Redis DNS unavailable"));
  ({ applyRateLimit } = await import("@/lib/rate-limit"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("CAPTCHA rate limiting during Redis outages", () => {
  it("lets CAPTCHA verification proceed when Redis is unavailable", async () => {
    expect(await applyRateLimit(request(), "auth", undefined, fallback)).toBeNull();
  });
  it("allows ten attempts then blocks, with independent limits per IP", async () => {
    for (let i = 0; i < 10; i++) {
      expect(await applyRateLimit(request(), "auth", undefined, fallback)).toBeNull();
    }
    const blocked = await applyRateLimit(request(), "auth", undefined, fallback);
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBe("900");
    expect(await applyRateLimit(request("192.0.2.2"), "auth", undefined, fallback)).toBeNull();
    vi.advanceTimersByTime(15 * 60 * 1000);
    expect(await applyRateLimit(request(), "auth", undefined, fallback)).toBeNull();
  });
  it("keeps other callers and sensitive operations fail-closed", async () => {
    expect((await applyRateLimit(request(), "auth"))?.status).toBe(503);
    expect((await applyRateLimit(request(), "payment", undefined, fallback))?.status).toBe(503);
  });
  it("honors Redis denials without falling back", async () => {
    limitMock.mockResolvedValue({success: false, limit: 10, remaining: 0, reset: Date.now() + 60000});
    expect((await applyRateLimit(request(), "auth", undefined, fallback))?.status).toBe(429);
  });
  it("honors Redis success", async () => {
    limitMock.mockResolvedValue({success: true, limit: 10, remaining: 9, reset: Date.now() + 60000});
    expect(await applyRateLimit(request(), "auth", undefined, fallback)).toBeNull();
  });
});
