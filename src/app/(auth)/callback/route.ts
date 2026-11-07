import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isPresetAvatar } from "@/lib/avatars";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") || "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if profile exists, create if not
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, avatar_url")
          .eq("id", user.id)
          .single();

        if (!profile) {
          // Create profile for new user (fallback - trigger usually handles this)
          await supabase.from("profiles").insert({
            id: user.id,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name,
            avatar_url: null, // Will be set during onboarding
            username: user.email?.split("@")[0],
          });
          // Phone numbers are private (profile_private), not on the public profile
          await supabase.from("profile_private").upsert(
            { id: user.id, phone_number: user.user_metadata?.phone_number || null },
            { onConflict: "id" }
          );

          // Redirect new users to onboarding to select avatar
          return NextResponse.redirect(`${origin}/onboarding`);
        }

        // Any user without a valid preset avatar must complete onboarding
        if (!isPresetAvatar(profile.avatar_url)) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }

      // Log signup IP (fire-and-forget, don't block auth flow)
      if (user) {
        try {
          const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
            || request.headers.get("x-real-ip")
            || "unknown";

          if (ip !== "unknown") {
            const serviceSupabase = createServiceClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            const { data: ipProfile } = await serviceSupabase
              .from("profile_private")
              .select("signup_ip")
              .eq("id", user.id)
              .maybeSingle();

            if (!ipProfile?.signup_ip) {
              let isVpn = false;
              let ipLocation = "Unknown";

              const isPrivateIp = ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.");

              if (!isPrivateIp) {
                try {
                  const ipRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,proxy,hosting`);
                  const ipData = await ipRes.json();
                  if (ipData.status === "success") {
                    isVpn = ipData.proxy === true || ipData.hosting === true;
                    ipLocation = [ipData.city, ipData.regionName, ipData.country].filter(Boolean).join(", ");
                  }
                } catch {}
              } else {
                ipLocation = "Local";
              }

              await serviceSupabase
                .from("profile_private")
                .upsert(
                  { id: user.id, signup_ip: ip, is_vpn: isVpn, ip_location: ipLocation },
                  { onConflict: "id" }
                );
            }
          }
        } catch {}
      }

      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  // Return to login on error
  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}
