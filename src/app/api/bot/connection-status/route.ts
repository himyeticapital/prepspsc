/**
 * Bot Connection Status API
 * Check if a user has connected their Telegram account
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId parameter" },
        { status: 400 }
      );
    }

    // Check for active Telegram connection
    const { data: connection } = await supabase
      .from("bot_connections")
      .select("id, platform, connected_at")
      .eq("user_id", userId)
      .eq("platform", "telegram")
      .eq("is_active", true)
      .single();

    return NextResponse.json({
      connected: !!connection,
      platform: connection?.platform || null,
      connectedAt: connection?.connected_at || null,
    });
  } catch (error) {
    console.error("Connection status error:", error);
    return NextResponse.json(
      { connected: false, error: "Failed to check status" },
      { status: 500 }
    );
  }
}
