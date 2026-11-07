/**
 * Progress Handler
 * Returns user's study progress and stats
 */

import { createClient } from "@supabase/supabase-js";
import type { BotConnection, BotResponse } from "@/lib/bot/types";
import * as personality from "@/lib/bot/personality";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Get user's progress stats
 */
export async function handleProgress(connection: BotConnection): Promise<BotResponse> {
  try {
    // Get user profile with stats
    const { data: profile } = await supabase
      .from("profiles")
      .select("total_xp, current_streak, weekly_xp")
      .eq("id", connection.user_id)
      .single();

    if (!profile) {
      return personality.errorMessage();
    }

    // Get XP from last week for comparison
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data: lastWeekXP } = await supabase
      .from("xp_transactions")
      .select("amount")
      .eq("user_id", connection.user_id)
      .gte("created_at", oneWeekAgo.toISOString());

    const xpThisWeek = profile.weekly_xp || 0;
    const xpLastWeek = lastWeekXP?.reduce((sum, t) => sum + t.amount, 0) || xpThisWeek;
    const xpChange = xpLastWeek > 0 ? Math.round(((xpThisWeek - xpLastWeek) / xpLastWeek) * 100) : 0;

    // Get topics completed this week
    const { count: topicsCompleted } = await supabase
      .from("study_schedule")
      .select("*", { count: "exact", head: true })
      .eq("user_id", connection.user_id)
      .eq("is_completed", true)
      .gte("completed_at", oneWeekAgo.toISOString());

    // Calculate accuracy from recent quizzes
    const { data: recentQuizzes } = await supabase
      .from("test_submissions")
      .select("correct_count, total_questions")
      .eq("user_id", connection.user_id)
      .gte("completed_at", oneWeekAgo.toISOString())
      .limit(10);

    let accuracy = 0;
    if (recentQuizzes && recentQuizzes.length > 0) {
      const totalCorrect = recentQuizzes.reduce((sum, q) => sum + (q.correct_count || 0), 0);
      const totalQuestions = recentQuizzes.reduce((sum, q) => sum + (q.total_questions || 0), 0);
      accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    }

    // Get user rank
    const { count: usersWithMoreXP } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gt("total_xp", profile.total_xp);

    const rank = (usersWithMoreXP || 0) + 1;

    // Get subject performance (simplified - in production, track by subject)
    let topSubject: string | undefined;
    let weakSubject: string | undefined;

    // For now, use placeholder values
    // In production, you'd query quiz results grouped by subject

    return personality.progressStats({
      streak: profile.current_streak || 0,
      xpThisWeek,
      xpChange,
      topicsCompleted: topicsCompleted || 0,
      accuracy,
      topSubject,
      weakSubject,
      rank,
    });
  } catch (error) {
    console.error("Progress handler error:", error);
    return personality.errorMessage();
  }
}
