/**
 * Streak Alert Cron Job
 * Sends nudge at 6 PM IST if user hasn't studied today
 *
 * Vercel Cron: 0 12 * * * (6 PM IST = 12:30 PM UTC, using 12 PM)
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendMessage } from "@/lib/bot/adapters/telegram";
import { generateStreakAlert } from "@/lib/bot/ai";
import type { BotConnection } from "@/lib/bot/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  // Verify cron authorization
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get users with streak alerts enabled
    const { data: connections, error } = await supabase
      .from("bot_connections")
      .select("*, user:profiles(id, full_name, current_streak)")
      .eq("is_active", true)
      .contains("notification_preferences", { streak_alerts: true });

    if (error) {
      console.error("Error fetching connections:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({ message: "No users to notify", sent: 0 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let sentCount = 0;
    const errors: string[] = [];

    for (const conn of connections as (BotConnection & { user: { id: string; full_name: string; current_streak: number } })[]) {
      try {
        const user = conn.user;
        if (!user) continue;

        // Check if user has any activity today
        // Look for: completed topics, quiz submissions, XP earned
        const { count: todayActivity } = await supabase
          .from("xp_transactions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", today.toISOString());

        // Skip if user already studied today
        if (todayActivity && todayActivity > 0) {
          continue;
        }

        // Get last activity time
        const { data: lastActivity } = await supabase
          .from("xp_transactions")
          .select("created_at, source")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        let lastActivityText: string | undefined;
        if (lastActivity) {
          const lastDate = new Date(lastActivity.created_at);
          const daysAgo = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
          lastActivityText = daysAgo === 1
            ? "Yesterday"
            : `${daysAgo} days ago`;
        }

        // Generate streak alert
        const alertText = await generateStreakAlert({
          name: user.full_name || "Student",
          streak: user.current_streak || 0,
          lastActivity: lastActivityText,
        });

        // Send alert
        if (conn.platform === "telegram") {
          await sendMessage(conn.platform_user_id, {
            text: alertText,
            parseMode: "HTML",
            buttons: [
              { text: "⚡ Quick Quiz", callbackData: "cmd_quiz" },
              { text: "📋 Today's Plan", callbackData: "cmd_plan" },
            ],
          });
        }

        sentCount++;
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (sendError) {
        console.error(`Error sending to ${conn.platform_user_id}:`, sendError);
        errors.push(conn.platform_user_id);
      }
    }

    return NextResponse.json({
      message: "Streak alerts sent",
      sent: sentCount,
      total: connections.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Streak alert cron error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export const maxDuration = 60;
