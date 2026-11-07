import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({ user: null as null | { id: string }, role: "student" }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = () => q;
      q.single = async () => ({ data: { role: state.role, avatar_url: "preset:1" } });
      return q;
    },
  }),
}));
vi.mock("@/lib/avatars", () => ({ isPresetAvatar: () => true }));

const visit = async (path: string) => {
  const { updateSession } = await import("@/lib/supabase/middleware");
  const res = await updateSession(new NextRequest(`https://prepspsc.com${path}`));
  const location = res.headers.get("location");
  return location ? new URL(location).pathname : null;
};

beforeEach(() => {
  vi.resetModules();
  state.user = null;
  state.role = "student";
});

describe("admin routes", () => {
  it("lets a signed-out visitor open the admin login page (no redirect loop)", async () => {
    expect(await visit("/admin-auth/login")).toBeNull();
    expect(await visit("/admin-auth/reset-password")).toBeNull();
  });

  it("sends signed-out visitors from admin pages to the admin login", async () => {
    expect(await visit("/admin")).toBe("/admin-auth/login");
    expect(await visit("/admin/users")).toBe("/admin-auth/login");
  });

  it("sends signed-in non-admins away from admin pages", async () => {
    state.user = { id: "u1" };
    expect(await visit("/admin/users")).toBe("/dashboard");
  });

  it("sends a signed-in admin from the admin login to the admin dashboard", async () => {
    state.user = { id: "u1" };
    state.role = "admin";
    expect(await visit("/admin-auth/login")).toBe("/admin");
    expect(await visit("/admin/users")).toBeNull();
  });
});
