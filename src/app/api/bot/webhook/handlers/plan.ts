/**
 * Plan Handler
 * Returns today's study plan for the user
 */

import { createClient } from "@supabase/supabase-js";
import type { BotConnection, BotResponse } from "@/lib/bot/types";
import * as personality from "@/lib/bot/personality";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Get today's study plan for user
 */
export async function handlePlan(connection: BotConnection): Promise<BotResponse> {
  try {
    // Get user's profile for streak
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_streak")
      .eq("id", connection.user_id)
      .single();

    const streak = profile?.current_streak || 0;

    // Get today's scheduled topics from study plan
    const today = new Date().toISOString().split("T")[0];

    const { data: scheduledTopics } = await supabase
      .from("study_schedule")
      .select(`
        study_topic:study_topics(name),
        is_completed
      `)
      .eq("user_id", connection.user_id)
      .eq("scheduled_date", today);

    // Get completed topics count
    const completedToday = scheduledTopics?.filter((t) => t.is_completed).length || 0;

    // Extract topic names
    const todayTopics: string[] = scheduledTopics
      ?.filter((t) => !t.is_completed)
      ?.map((t) => {
        const topic = t.study_topic as unknown as { name: string } | { name: string }[] | null;
        if (Array.isArray(topic)) return topic[0]?.name;
        return topic?.name;
      })
      ?.filter((name): name is string => Boolean(name)) || [];

    // Get due flashcards count
    const { count: dueFlashcards } = await supabase
      .from("flashcard_progress")
      .select("*", { count: "exact", head: true })
      .eq("user_id", connection.user_id)
      .lte("next_review_at", new Date().toISOString());

    // If no plan exists, show prompt to create one
    if (!scheduledTopics || scheduledTopics.length === 0) {
      return personality.noPlanYet();
    }

    return personality.studyPlan(
      todayTopics,
      completedToday,
      streak,
      dueFlashcards || 0
    );
  } catch (error) {
    console.error("Plan handler error:", error);
    return personality.noPlanYet();
  }
}
