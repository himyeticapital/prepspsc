import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAuthPreflight, fetchSignupWithTimeout } from "@/lib/auth-requests";

const SUPABASE_URL = "https://signup-test.example.invalid";
const SIGNUP_URL = `${SUPABASE_URL}/auth/v1/signup`;
let deadline: AbortController;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  deadline = new AbortController();
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
  fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("fetchAuthPreflight", () => {
  it("adds a 15 second deadline while retaining the request options", async () => {
    const options = { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" };
    await fetchAuthPreflight("/api/auth/verify-captcha", options);
    expect(AbortSignal.timeout).toHaveBeenCalledWith(15_000);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/verify-captcha", {
      ...options,
      signal: expect.any(AbortSignal),
    });
    const signal = fetchMock.mock.calls[0][1]!.signal!;
    const reason = new DOMException("Preflight timed out", "TimeoutError");
    deadline.abort(reason);
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe(reason);
  });

  it("rejects a pending request when its deadline aborts", async () => {
    fetchMock.mockImplementation((_input, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener("abort", () => reject(options!.signal!.reason), { once: true });
    }));
    const pending = fetchAuthPreflight("/api/auth/verify-captcha", { method: "POST" });
    const reason = new DOMException("Preflight timed out", "TimeoutError");
    deadline.abort(reason);
    await expect(pending).rejects.toBe(reason);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["init", "request", "both-request", "both-init"] as const)(
    "preserves cancellation supplied through %s",
    async source => {
      const requestController = new AbortController();
      const initController = new AbortController();
      const input = source === "init" ? "/api/auth/validate-email" : new Request(
        `${SUPABASE_URL}/api/auth/validate-email`,
        { method: "POST", signal: requestController.signal },
      );
      const options = source === "request" ? undefined : { signal: initController.signal };
      await fetchAuthPreflight(input, options);
      const reason = new Error("Caller cancelled");
      if (source === "request" || source === "both-request") requestController.abort(reason);
      else initController.abort(reason);
      const signal = fetchMock.mock.calls[0][1]!.signal!;
      expect(signal.aborted).toBe(true);
      expect(signal.reason).toBe(reason);
      expect(deadline.signal.aborted).toBe(false);
    },
  );

  it("retains a caller signal that was already aborted", async () => {
    const caller = new AbortController();
    const reason = new Error("Already cancelled");
    caller.abort(reason);
    await fetchAuthPreflight("/api/auth/verify-captcha", { signal: caller.signal });
    expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(true);
    expect(fetchMock.mock.calls[0][1]!.signal!.reason).toBe(reason);
  });

  describe("when AbortSignal.any is unavailable", () => {
    beforeEach(() => {
      vi.stubGlobal("AbortSignal", new Proxy(AbortSignal, {
        get(target, key, receiver) {
          return key === "any" ? undefined : Reflect.get(target, key, receiver);
        },
      }));
    });

    it.each(["caller", "request", "deadline"] as const)(
      "preserves %s cancellation and cleans up every source listener",
      async source => {
        const caller = new AbortController();
        const requestController = new AbortController();
        const input = new Request(`${SUPABASE_URL}/api/auth/verify-captcha`, { signal: requestController.signal });
        const removals = [deadline.signal, input.signal, caller.signal].map(signal =>
          vi.spyOn(signal, "removeEventListener"),
        );
        await fetchAuthPreflight(input, { signal: caller.signal });
        const reason = new Error(`${source} cancelled`);
        const controller = source === "deadline" ? deadline : source === "request" ? requestController : caller;
        controller.abort(reason);
        const signal = fetchMock.mock.calls[0][1]!.signal!;
        expect(signal.aborted).toBe(true);
        expect(signal.reason).toBe(reason);
        for (const removal of removals) expect(removal).toHaveBeenCalledWith("abort", expect.any(Function));
      },
    );

    it("preserves already-aborted signals and removes earlier listeners", async () => {
      const caller = new AbortController();
      const reason = new Error("Already cancelled without AbortSignal.any");
      caller.abort(reason);
      const removal = vi.spyOn(deadline.signal, "removeEventListener");
      await fetchAuthPreflight("/api/auth/verify-captcha", { signal: caller.signal });
      const signal = fetchMock.mock.calls[0][1]!.signal!;
      expect(signal.aborted).toBe(true);
      expect(signal.reason).toBe(reason);
      expect(removal).toHaveBeenCalledWith("abort", expect.any(Function));
    });

    it("keeps a response body bounded after headers arrive", async () => {
      fetchMock.mockImplementation(async (_input, options) => new Response(new ReadableStream({
        start(controller) {
          options!.signal!.addEventListener("abort", () => controller.error(options!.signal!.reason), { once: true });
        },
      })));
      const response = await fetchAuthPreflight("/api/auth/verify-captcha");
      const body = response.json();
      const reason = new DOMException("Body timed out without AbortSignal.any", "TimeoutError");
      deadline.abort(reason);
      await expect(body).rejects.toBe(reason);
    });
  });
});

describe("fetchSignupWithTimeout", () => {
  it("limits signup POSTs including redirect query parameters to 30 seconds", async () => {
    const input = new URL(`${SIGNUP_URL}?redirect_to=https%3A%2F%2Fexample.invalid`);
    await fetchSignupWithTimeout(input, { method: "POST", body: "{}" });
    expect(AbortSignal.timeout).toHaveBeenCalledWith(30_000);
    const signal = fetchMock.mock.calls[0][1]!.signal!;
    deadline.abort();
    expect(signal.aborted).toBe(true);
  });

  it("recognizes the method and cancellation signal on a Request input", async () => {
    const caller = new AbortController();
    const input = new Request(SIGNUP_URL, { method: "POST", body: "{}", signal: caller.signal });
    await fetchSignupWithTimeout(input);
    expect(AbortSignal.timeout).toHaveBeenCalledWith(30_000);
    const reason = new Error("Caller cancelled signup");
    caller.abort(reason);
    expect(fetchMock.mock.calls[0][1]!.signal!.reason).toBe(reason);
  });

  it("keeps the deadline active while the response body is still arriving", async () => {
    fetchMock.mockImplementation(async (_input, options) => new Response(new ReadableStream({
      start(controller) {
        options!.signal!.addEventListener("abort", () => controller.error(options!.signal!.reason), { once: true });
      },
    })));
    const response = await fetchSignupWithTimeout(SIGNUP_URL, { method: "POST" });
    const body = response.json();
    const reason = new DOMException("Signup body timed out", "TimeoutError");
    deadline.abort(reason);
    await expect(body).rejects.toBe(reason);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["other auth endpoint", `${SUPABASE_URL}/auth/v1/token`, "POST"],
    ["other Supabase project", "https://another.example.invalid/auth/v1/signup", "POST"],
    ["longer path", `${SIGNUP_URL}/extra`, "POST"],
    ["GET signup", SIGNUP_URL, "GET"],
    ["relative app endpoint", "/api/auth/verify-captcha", "POST"],
  ])("passes %s through unchanged", async (_name, input, method) => {
    const options = { method, signal: new AbortController().signal };
    await fetchSignupWithTimeout(input, options);
    expect(AbortSignal.timeout).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][0]).toBe(input);
    expect(fetchMock.mock.calls[0][1]).toBe(options);
  });

  it("honors an init method overriding a Request method", async () => {
    const input = new Request(SIGNUP_URL, { method: "POST" });
    const options = { method: "GET" };
    await fetchSignupWithTimeout(input, options);
    expect(AbortSignal.timeout).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][1]).toBe(options);
  });

  it("accepts a trailing slash in the configured Supabase URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `${SUPABASE_URL}/`);
    await fetchSignupWithTimeout(SIGNUP_URL, { method: "POST" });
    expect(AbortSignal.timeout).toHaveBeenCalledWith(30_000);
  });
});
