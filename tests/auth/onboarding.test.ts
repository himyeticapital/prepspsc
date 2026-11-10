import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { isOnboardingComplete, loadOnboardingState, saveOnboardingProfile } from "@/lib/onboarding";

const id = "11111111-1111-4111-8111-111111111111";
const phone = "+919800000002";
const profile = { avatar_url: "/avatars/avatar-1.svg", username: "student_one", phone_verified: true };
const input = { avatar: profile.avatar_url, username: profile.username, preparingFor: ["SPSC"], needsPhone: true, verifiedPhone: phone };
let writes: { table: string; method: string; body: Record<string, unknown> }[];
let rejectPhone: boolean;
let rejectProfile: boolean;
let missingPrivateRow: boolean;
let missingProfile: boolean;
let transportError: boolean;
let readError: boolean;

// Exercise the real PostgREST client against the production column-permission contract.
const client = () => createClient("https://onboarding.example.invalid", "test-anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: async (url, options) => {
    if (transportError) throw new Error("connection lost");
    const table = new URL(String(url)).pathname.split("/").at(-1)!;
    const method = options?.method || "GET";
    if (method === "GET") {
      if (readError) return Response.json({ message: "read failed", code: "42501" }, { status: 403 });
      return Response.json(table === "profiles" ? profile : { phone_number: phone });
    }
    const body = JSON.parse(options?.body as string);
    writes.push({ table, method, body });
    if (table === "profile_private") {
      const merge = new Headers(options?.headers).get("Prefer")?.includes("resolution=merge-duplicates");
      if (rejectPhone || (method === "POST" && merge && "id" in body)) {
        return Response.json({ message: "permission denied for table profile_private", code: "42501" }, { status: 403 });
      }
      if (method === "PATCH" && missingPrivateRow) return Response.json(null);
    }
    if (table === "profiles" && rejectProfile) return Response.json({ message: "username conflict", code: "23505" }, { status: 409 });
    if (table === "profiles" && missingProfile) return Response.json({ message: "no rows", code: "PGRST116" }, { status: 406 });
    return Response.json({ id });
  } },
});

beforeEach(() => {
  writes = [];
  rejectPhone = rejectProfile = missingPrivateRow = missingProfile = transportError = readError = false;
});

describe("onboarding completion", () => {
  it("requires a saved phone as well as the public profile", () => {
    expect(isOnboardingComplete(profile, { phone_number: phone })).toBe(true);
    expect(isOnboardingComplete(profile, { phone_number: null })).toBe(false);
    expect(isOnboardingComplete(profile, null)).toBe(false);
    expect(isOnboardingComplete({ ...profile, phone_verified: false }, { phone_number: phone })).toBe(false);
    expect(isOnboardingComplete({ ...profile, avatar_url: "https://google.example/avatar" }, { phone_number: phone })).toBe(false);
    expect(isOnboardingComplete({ ...profile, username: "" }, { phone_number: phone })).toBe(false);
    expect(isOnboardingComplete(null, { phone_number: phone })).toBe(false);
  });

  it("loads both halves of the profile for login, callback and middleware", async () => {
    const state = await loadOnboardingState(client(), id);
    expect(state.profile).toEqual(profile);
    expect(state.privateProfile).toEqual({ phone_number: phone });
    expect(state.complete).toBe(true);
  });

  it("reports a failed read instead of treating it as an empty profile", async () => {
    readError = true;
    await expect(loadOnboardingState(client(), id)).rejects.toThrow(/load/i);
  });
});

describe("saving onboarding", () => {
  it("saves a Google user's phone within column permissions before marking the profile verified", async () => {
    await saveOnboardingProfile(client(), id, input);
    expect(writes).toEqual([
      { table: "profile_private", method: "PATCH", body: { phone_number: phone } },
      { table: "profiles", method: "PATCH", body: { avatar_url: input.avatar, username: input.username, preparing_for: ["SPSC"], phone_verified: true } },
    ]);
  });

  it("does not save an avatar or verified flag when the phone write fails", async () => {
    rejectPhone = true;
    await expect(saveOnboardingProfile(client(), id, input)).rejects.toThrow(/phone/i);
    expect(writes.map(w => w.table)).toEqual(["profile_private"]);
  });

  it("creates a missing private row without requesting permission to update its ID", async () => {
    missingPrivateRow = true;
    await saveOnboardingProfile(client(), id, input);
    expect(writes[1]).toEqual({ table: "profile_private", method: "POST", body: { id, phone_number: phone } });
    expect(writes.at(-1)?.table).toBe("profiles");
  });

  it("lets email users with an already saved phone finish without rewriting it", async () => {
    await saveOnboardingProfile(client(), id, { ...input, needsPhone: false, verifiedPhone: null });
    expect(writes).toHaveLength(1);
    expect(writes[0].table).toBe("profiles");
    expect(writes[0].body).not.toHaveProperty("phone_verified");
  });

  it("requires phone verification before writing anything", async () => {
    await expect(saveOnboardingProfile(client(), id, { ...input, verifiedPhone: null })).rejects.toThrow(/verify/i);
    expect(writes).toHaveLength(0);
  });

  it("propagates a profile failure so the page can retry", async () => {
    rejectProfile = true;
    await expect(saveOnboardingProfile(client(), id, input)).rejects.toThrow(/profile/i);
  });

  it("does not report success when the profile update matches no row", async () => {
    missingProfile = true;
    await expect(saveOnboardingProfile(client(), id, input)).rejects.toThrow(/profile/i);
  });

  it("rejects a failed connection so the UI can leave its saving state", async () => {
    transportError = true;
    await expect(saveOnboardingProfile(client(), id, input)).rejects.toThrow();
  });
});
