import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  user: { id: "u1" } as { id: string } | null,
  phone: null as string | null,
  refresh: false,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (cookies: unknown[]) => void } }) => ({
    auth: { getUser: async () => {
      if (state.refresh) options.cookies.setAll([{ name: "test-session", value: "refreshed", options: { path: "/", httpOnly: true } }]);
      return { data: { user: state.user } };
    } },
    from: (table: string) => {
      const result = { data: table === "profiles"
        ? { avatar_url: "/avatars/avatar-1.svg", username: "student", phone_verified: true }
        : { phone_number: state.phone }, error: null };
      const q = { select: () => q, eq: () => q, abortSignal: () => q, single: async () => result, maybeSingle: async () => result };
      return q;
    },
  }),
}));

beforeEach(() => { state.user = { id: "u1" }; state.phone = null; state.refresh = false; });

describe("onboarding routing", () => {
  it("returns a half-saved Google account to onboarding even with a preset avatar", async () => {
    const { updateSession } = await import("@/lib/supabase/middleware");
    const res = await updateSession(new NextRequest("https://prepspsc.com/dashboard"));
    expect(res.headers.get("location")).toBe("https://prepspsc.com/onboarding");
  });

  it("allows a completed account into the dashboard", async () => {
    state.phone = "+919800000002";
    const { updateSession } = await import("@/lib/supabase/middleware");
    const res = await updateSession(new NextRequest("https://prepspsc.com/dashboard"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("keeps refreshed session cookies when redirecting an incomplete account", async () => {
    state.refresh = true;
    const { updateSession } = await import("@/lib/supabase/middleware");
    const res = await updateSession(new NextRequest("https://prepspsc.com/dashboard"));
    expect(res.headers.get("location")).toBe("https://prepspsc.com/onboarding");
    expect(res.cookies.get("test-session")?.value).toBe("refreshed");
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
  });
});
