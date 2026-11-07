/**
 * Daily Summary Cron Job
 * Sends end-of-day summary at 9 PM IST
 *
 * Vercel Cron: 0 15 * * * (9 PM IST = 3:30 PM UTC, using 15:30)
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendMessage } from "@/lib/bot/adapters/telegram";
import { generateDailySummary } from "@/lib/bot/ai";
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
    // Get users with daily summary enabled
    const { data: connections, error } = await supabase
      .from("bot_connections")
      .select("*, user:profiles(id, full_name, current_streak)")
      .eq("is_active", true)
      .contains("notification_preferences", { daily_summary: true });

    if (error) {
      console.error("Error fetching connections:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({ message: "No users to notify", sent: 0 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let sentCount = 0;
    const errors: string[] = [];

    for (const conn of connections as (BotConnection & { user: { id: string; full_name: string; current_streak: number } })[]) {
      try {
        const user = conn.user;
        if (!user) continue;

        // Get today's XP
        const { data: todayXP } = await supabase
          .from("xp_transactions")
          .select("amount")
          .eq("user_id", user.id)
          .gte("created_at", today.toISOString());

        const xpEarned = todayXP?.reduce((sum, t) => sum + t.amount, 0) || 0;

        // Get completed topics today
        const { count: topicsCompleted } = await supabase
          .from("study_schedule")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_completed", true)
          .gte("completed_at", today.toISOString());

        // Calculate accuracy from today's quizzes
        const { data: todayQuizzes } = await supabase
          .from("test_submissions")
          .select("correct_count, total_questions")
          .eq("user_id", user.id)
          .gte("completed_at", today.toISOString());

        let accuracy = 0;
        if (todayQuizzes && todayQuizzes.length > 0) {
          const totalCorrect = todayQuizzes.reduce((sum, q) => sum + (q.correct_count || 0), 0);
          const totalQuestions = todayQuizzes.reduce((sum, q) => sum + (q.total_questions || 0), 0);
          accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
        }

        // Get tomorrow's topics
        const { data: tomorrowSchedule } = await supabase
          .from("study_schedule")
          .select("study_topic:study_topics(name)")
          .eq("user_id", user.id)
          .eq("scheduled_date", tomorrow.toISOString().split("T")[0])
          .eq("is_completed", false)
          .limit(3);

        const tomorrowTopics: string[] = tomorrowSchedule
          ?.map((t) => {
            const topic = t.study_topic as unknown as { name: string } | { name: string }[] | null;
            if (Array.isArray(topic)) return topic[0]?.name;
            return topic?.name;
          })
          ?.filter((name): name is string => Boolean(name)) || [];

        // Only send if user had some activity (XP > 0)
        // Skip completely inactive users to avoid spam
        if (xpEarned === 0 && (topicsCompleted || 0) === 0) {
          continue;
        }

        // Generate summary
        const summaryText = await generateDailySummary({
          name: user.full_name || "Student",
          xpEarned,
          topicsCompleted: topicsCompleted || 0,
          accuracy,
          streak: user.current_streak || 0,
          tomorrowTopics,
        });

        // Send summary
        if (conn.platform === "telegram") {
          await sendMessage(conn.platform_user_id, {
            text: summaryText,
            parseMode: "HTML",
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
      message: "Daily summaries sent",
      sent: sentCount,
      total: connections.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Daily summary cron error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export const maxDuration = 60;
