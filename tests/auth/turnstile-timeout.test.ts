import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstileToken } from "@/lib/turnstile";

beforeEach(() => {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Turnstile verification deadline", () => {
  it("cancels a stalled Cloudflare request after ten seconds", async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    vi.stubGlobal("fetch", vi.fn((_input, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    })));

    const verification = verifyTurnstileToken("test-token");
    expect(timeout).toHaveBeenCalledWith(10_000);
    controller.abort(new DOMException("Verification timed out", "TimeoutError"));
    await expect(verification).resolves.toBe(false);
  });

  it("still accepts a successful Cloudflare verification", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: true })));
    await expect(verifyTurnstileToken("test-token")).resolves.toBe(true);
  });
});
