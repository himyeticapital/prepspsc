/**
 * Reset Streaks Cron Job
 * Resets current_streak to 0 for users who didn't study yesterday or today.
 * Runs daily at 2:00 AM UTC (7:30 AM IST) — before morning reminder.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { error } = await supabase.rpc("reset_broken_streaks");

    if (error) {
      console.error("Error resetting streaks:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Broken streaks reset", timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Reset streaks cron error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export const maxDuration = 10;
