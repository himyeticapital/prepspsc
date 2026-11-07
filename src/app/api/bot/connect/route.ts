/**
 * Bot Connect API
 * Called by webhook when user starts bot with user ID parameter
 * Links Telegram account to PrepSPSC profile
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { platform, platformUserId, userId, username } = await request.json();

    // Validate required fields
    if (!platform || !platformUserId || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if user exists
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if this platform user is already connected to another account
    const { data: existingConnection } = await supabase
      .from("bot_connections")
      .select("user_id")
      .eq("platform", platform)
      .eq("platform_user_id", platformUserId)
      .single();

    if (existingConnection && existingConnection.user_id !== userId) {
      return NextResponse.json(
        { error: "This Telegram account is already connected to another user" },
        { status: 409 }
      );
    }

    // Upsert connection (create or update)
    const { error } = await supabase
      .from("bot_connections")
      .upsert({
        user_id: userId,
        platform,
        platform_user_id: platformUserId,
        username: username || null,
        is_active: true,
        connected_at: new Date().toISOString(),
        last_interaction_at: new Date().toISOString(),
      }, {
        onConflict: "platform,platform_user_id",
      });

    if (error) {
      console.error("Error creating connection:", error);
      return NextResponse.json(
        { error: "Failed to create connection" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Account connected successfully",
    });
  } catch (error) {
    console.error("Bot connect error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
