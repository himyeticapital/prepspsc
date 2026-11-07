import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { verifyMock } = vi.hoisted(() => ({ verifyMock: vi.fn() }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstileToken: verifyMock }));
vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = vi.fn();
    async limit() { throw new Error("Redis DNS unavailable"); }
  },
}));

let POST: typeof import("@/app/api/auth/verify-captcha/route").POST;
const request = (token?: string) => new NextRequest("https://prepspsc.com/api/auth/verify-captcha", {
  method: "POST",
  headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.1" },
  body: JSON.stringify({ token }),
});
beforeEach(async () => {
  vi.resetModules();
  vi.spyOn(console, "error").mockImplementation(() => {});
  verifyMock.mockReset();
  ({ POST } = await import("@/app/api/auth/verify-captcha/route"));
});
afterEach(() => { vi.restoreAllMocks(); });

describe("CAPTCHA verification with Redis down", () => {
  it("still rejects missing tokens", async () => {
    expect((await POST(request())).status).toBe(400);
    expect(verifyMock).not.toHaveBeenCalled();
  });
  it("still rejects invalid Cloudflare tokens", async () => {
    verifyMock.mockResolvedValue(false);
    expect((await POST(request("invalid"))).status).toBe(403);
  });
  it("accepts verified tokens", async () => {
    verifyMock.mockResolvedValue(true);
    const response = await POST(request("valid"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(verifyMock).toHaveBeenCalledWith("valid", "192.0.2.1");
  });
});
