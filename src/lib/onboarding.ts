import type { SupabaseClient } from "@supabase/supabase-js";
import { isPresetAvatar } from "@/lib/avatars";

type Profile = { avatar_url: string | null; username: string | null; phone_verified: boolean | null };
type PrivateProfile = { phone_number: string | null };

export function isOnboardingComplete(profile: Profile | null, privateProfile: PrivateProfile | null): boolean {
  return Boolean(
    isPresetAvatar(profile?.avatar_url) && profile?.username?.trim() &&
    profile?.phone_verified && privateProfile?.phone_number?.trim()
  );
}

export async function loadOnboardingState(supabase: SupabaseClient, userId: string) {
  const signal = AbortSignal.timeout(15_000);
  const [profileResult, privateResult] = await Promise.all([
    supabase.from("profiles").select("username, avatar_url, phone_verified").eq("id", userId).abortSignal(signal).maybeSingle(),
    supabase.from("profile_private").select("phone_number").eq("id", userId).abortSignal(signal).maybeSingle(),
  ]);
  if (profileResult.error || privateResult.error) {
    throw new Error("Could not load your profile. Please try again.");
  }
  const profile = profileResult.data as Profile | null;
  const privateProfile = privateResult.data as PrivateProfile | null;
  return { profile, privateProfile, complete: isOnboardingComplete(profile, privateProfile) };
}

type OnboardingInput = {
  avatar: string;
  username: string;
  preparingFor: string[];
  needsPhone: boolean;
  verifiedPhone: string | null;
};

export async function saveOnboardingProfile(supabase: SupabaseClient, userId: string, input: OnboardingInput) {
  const username = input.username.toLowerCase().replace(/\s+/g, "_").trim();
  if (!isPresetAvatar(input.avatar)) throw new Error("Please select an avatar to continue.");
  if (!/^[a-z0-9_]{3,}$/.test(username)) throw new Error("Please enter a valid username.");
  if (input.needsPhone && !input.verifiedPhone) throw new Error("Please verify your phone number to continue.");
  const signal = AbortSignal.timeout(15_000);

  if (input.verifiedPhone) {
    // Upsert also tries to UPDATE id, but authenticated users may only UPDATE phone_number.
    // Confirm that the update matched a row; an empty response is not a successful save.
    const { data, error } = await supabase.from("profile_private")
      .update({ phone_number: input.verifiedPhone }).eq("id", userId).select("id").abortSignal(signal).maybeSingle();
    if (error) throw new Error("Failed to save your phone number. Please try again.");
    if (!data) {
      // Recover accounts whose private row predates the signup trigger.
      const { error: insertError } = await supabase.from("profile_private")
        .insert({ id: userId, phone_number: input.verifiedPhone }).select("id").abortSignal(signal).single();
      if (insertError?.code === "23505") {
        // Another request created the row in between. Still update only the phone column.
        const { data: retried, error: retryError } = await supabase.from("profile_private")
          .update({ phone_number: input.verifiedPhone }).eq("id", userId).select("id").abortSignal(signal).maybeSingle();
        if (retryError || !retried) throw new Error("Failed to save your phone number. Please try again.");
      } else if (insertError) {
        throw new Error("Failed to save your phone number. Please try again.");
      }
    }
  }

  // Publish the avatar and verification flag only after the phone is safely stored.
  const { data, error } = await supabase.from("profiles").update({
    avatar_url: input.avatar,
    username,
    ...(input.preparingFor.length ? { preparing_for: input.preparingFor } : {}),
    ...(input.verifiedPhone ? { phone_verified: true } : {}),
  }).eq("id", userId).select("id").abortSignal(signal).single();
  if (error || !data) throw new Error("Failed to save profile. Please check your username and try again.");
}
