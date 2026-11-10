import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { adminClient, createAuthenticatedClient, createTestUser } from "../setup";
import { loadOnboardingState, saveOnboardingProfile } from "@/lib/onboarding";

// Explicitly opt in: creates and removes only a dedicated fixture account, with no email or SMS.
describe.skipIf(process.env.PREPSPSC_LIVE_ONBOARDING_TEST !== "1")("onboarding with deployed database permissions", () => {
  it("saves a phone and completes the profile without broadening permissions", async () => {
    const email = `onboarding-check-${randomUUID()}@prepspsc-test.local`;
    const password = randomUUID() + "aA1!";
    const id = await createTestUser(email, password);
    try {
      const client = await createAuthenticatedClient(email, password);
      expect((await loadOnboardingState(client, id)).complete).toBe(false);
      await saveOnboardingProfile(client, id, {
        avatar: "/avatars/avatar-1.svg", username: `test_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
        preparingFor: [], needsPhone: true, verifiedPhone: "+919800000002",
      });
      const state = await loadOnboardingState(client, id);
      expect(state.complete).toBe(true);
      expect(state.privateProfile?.phone_number).toBe("+919800000002");
      expect(state.profile?.phone_verified).toBe(true);

      // The user still cannot update private IP fields.
      const { error } = await client.from("profile_private").update({ signup_ip: "203.0.113.7" }).eq("id", id);
      expect(error?.code).toBe("42501");
    } finally {
      // profiles_id_fkey does not cascade from auth.users in this project.
      const { error: profileError } = await adminClient.from("profiles").delete().eq("id", id);
      if (profileError) throw new Error(`Could not remove onboarding test profile: ${profileError.code}`);
      const { error: userError } = await adminClient.auth.admin.deleteUser(id);
      if (userError) throw new Error("Could not remove onboarding test auth account");
    }
  });
});
