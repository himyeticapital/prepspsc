import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPresetAvatar } from "@/lib/avatars";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") || "/dashboard";
  const isOnboardingRequested = redirect === "/onboarding";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if profile exists, create if not
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, avatar_url, created_at")
          .eq("id", user.id)
          .single();

        if (!profile) {
          // Create profile for new user
          await supabase.from("profiles").insert({
            id: user.id,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name,
            avatar_url: null, // Will be set during onboarding
            username: user.email?.split("@")[0],
          });

          // Redirect new users to onboarding to select avatar
          return NextResponse.redirect(`${origin}/onboarding`);
        }

        // If avatar_url is null, user has never completed onboarding
        // Always redirect to onboarding regardless of account age
        // This handles email signups where users confirm days later
        if (profile.avatar_url === null) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }

        // If onboarding was explicitly requested (from signup page) AND
        // user hasn't selected a preset avatar yet, redirect to onboarding
        // This handles cases where user has a Google photo but should pick a preset
        if (isOnboardingRequested && !isPresetAvatar(profile.avatar_url)) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }

      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  // Return to login on error
  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}
