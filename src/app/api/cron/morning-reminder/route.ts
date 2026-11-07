/**
 * Morning Reminder Cron Job
 * Sends daily study reminders at 8 AM IST
 *
 * Vercel Cron: 0 2 * * * (8 AM IST = 2:30 AM UTC, using 2 AM for buffer)
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendMessage } from "@/lib/bot/adapters/telegram";
import { generateMorningReminder } from "@/lib/bot/ai";
import type { BotConnection } from "@/lib/bot/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  // Verify cron authorization
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Reset broken streaks before reading (ensures fresh values)
    const { error: streakErr } = await supabase.rpc("reset_broken_streaks");
    if (streakErr) console.error("Failed to reset streaks:", streakErr);

    // Get all users with morning reminder enabled
    const { data: connections, error } = await supabase
      .from("bot_connections")
      .select("*, user:profiles(id, full_name, current_streak)")
      .eq("is_active", true)
      .contains("notification_preferences", { morning_reminder: true });

    if (error) {
      console.error("Error fetching connections:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({ message: "No users to notify", sent: 0 });
    }

    let sentCount = 0;
    const errors: string[] = [];

    // Send reminders to each user
    for (const conn of connections as (BotConnection & { user: { id: string; full_name: string; current_streak: number } })[]) {
      try {
        const user = conn.user;
        if (!user) continue;

        // Get today's scheduled topics
        const today = new Date().toISOString().split("T")[0];
        const { data: scheduledTopics } = await supabase
          .from("study_schedule")
          .select("study_topic:study_topics(name)")
          .eq("user_id", user.id)
          .eq("scheduled_date", today)
          .eq("is_completed", false);

        const todayTopics: string[] = scheduledTopics
          ?.map((t) => {
            const topic = t.study_topic as unknown as { name: string } | { name: string }[] | null;
            if (Array.isArray(topic)) return topic[0]?.name;
            return topic?.name;
          })
          ?.filter((name): name is string => Boolean(name)) || [];

        // Get due flashcards
        const { count: dueFlashcards } = await supabase
          .from("flashcard_progress")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .lte("next_review_at", new Date().toISOString());

        // Generate personalized reminder
        const reminderText = await generateMorningReminder({
          name: user.full_name || "Student",
          streak: user.current_streak || 0,
          todayTopics,
          dueFlashcards: dueFlashcards || 0,
          examName: "SPSC", // Could be personalized based on user's selected exam
        });

        // Send via appropriate platform
        if (conn.platform === "telegram") {
          await sendMessage(conn.platform_user_id, {
            text: reminderText,
            parseMode: "HTML",
            buttons: [
              { text: "📋 See Plan", callbackData: "cmd_plan" },
              { text: "📝 Quick Quiz", callbackData: "cmd_quiz" },
            ],
          });
        }
        // WhatsApp would be added in Phase 2

        sentCount++;

        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (sendError) {
        console.error(`Error sending to ${conn.platform_user_id}:`, sendError);
        errors.push(conn.platform_user_id);
      }
    }

    return NextResponse.json({
      message: "Morning reminders sent",
      sent: sentCount,
      total: connections.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Morning reminder cron error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Vercel Cron configuration
export const maxDuration = 60;
