import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isPrivateIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("172.17.") ||
    ip.startsWith("172.18.") ||
    ip.startsWith("172.19.") ||
    ip.startsWith("172.20.") ||
    ip.startsWith("172.21.") ||
    ip.startsWith("172.22.") ||
    ip.startsWith("172.23.") ||
    ip.startsWith("172.24.") ||
    ip.startsWith("172.25.") ||
    ip.startsWith("172.26.") ||
    ip.startsWith("172.27.") ||
    ip.startsWith("172.28.") ||
    ip.startsWith("172.29.") ||
    ip.startsWith("172.30.") ||
    ip.startsWith("172.31.") ||
    ip === "localhost"
  );
}

export async function POST(request: Request) {
  try {
    // Authenticate the user
    const authClient = await createAuthClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if signup_ip is already set (don't overwrite on re-login)
    const { data: profile } = await supabase
      .from("profile_private")
      .select("signup_ip")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.signup_ip) {
      return NextResponse.json({
        success: true,
        already_recorded: true,
      });
    }

    // Extract IP from headers
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    let isVpn = false;
    let ipLocation = "Unknown";

    if (ip === "unknown" || isPrivateIp(ip)) {
      // Local/private IP — skip external lookup
      isVpn = false;
      ipLocation = "Local";
    } else {
      // Call ip-api.com for VPN detection (free tier: http only)
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(
          `http://ip-api.com/json/${ip}?fields=status,country,regionName,city,proxy,hosting`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          if (data.status === "success") {
            isVpn = data.proxy === true || data.hosting === true;
            ipLocation = [data.city, data.regionName, data.country]
              .filter(Boolean)
              .join(", ");
          }
        }
      } catch {
        // ip-api call failed — store what we have
        console.error("ip-api.com lookup failed for IP:", ip);
      }
    }

    // Store IP data privately (profile_private is readable only by the user and admins)
    await supabase
      .from("profile_private")
      .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });
    const { error: updateError } = await supabase
      .from("profile_private")
      .update({
        signup_ip: ip,
        is_vpn: isVpn,
        ip_location: ipLocation,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .is("signup_ip", null);

    if (updateError) {
      console.error("Failed to update profile with IP data:", updateError);
      return NextResponse.json(
        { error: "Failed to record IP data" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ip,
      location: ipLocation,
      is_vpn: isVpn,
    });
  } catch (error) {
    console.error("Error in log-signup-ip:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
