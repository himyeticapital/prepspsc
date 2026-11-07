// Leitner Integration for Guided Learning
// Updates goal's Leitner box based on session understanding score

import { createClient } from "@/lib/supabase/server";
import type { SessionResult } from "./types";

// Leitner box intervals in days
const LEITNER_INTERVALS: Record<number, number> = {
  1: 1,   // Review tomorrow
  2: 3,   // Review in 3 days
  3: 7,   // Review in 1 week
  4: 14,  // Review in 2 weeks
  5: 30,  // Review in 1 month
};

// XP rewards based on understanding score
function calculateXPReward(understandingScore: number): number {
  // 10-50 XP based on score
  return Math.max(10, Math.floor(understandingScore / 10) * 5);
}

// Calculate new Leitner box based on understanding score
function calculateNewLeitnerBox(
  currentBox: number,
  understandingScore: number
): number {
  if (understandingScore >= 80) {
    // Strong understanding - move up
    return Math.min(currentBox + 1, 5);
  } else if (understandingScore >= 50) {
    // Partial understanding - stay same
    return currentBox;
  } else {
    // Struggling - move down
    return Math.max(currentBox - 1, 1);
  }
}

// Calculate next revision date based on Leitner box
function calculateNextRevisionDate(leitnerBox: number): Date {
  const daysToAdd = LEITNER_INTERVALS[leitnerBox] || 1;
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + daysToAdd);
  return nextDate;
}

/**
 * Update a goal's Leitner box and revision schedule based on guided learning session result
 */
export async function updateGoalFromGuidedSession(
  goalId: number,
  userId: string,
  sessionResult: SessionResult
): Promise<{
  success: boolean;
  newLeitnerBox?: number;
  xpAwarded?: number;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Fetch current goal state
    const { data: goal, error: goalError } = await supabase
      .from("study_ai_goals")
      .select("leitner_box, revision_count")
      .eq("id", goalId)
      .eq("user_id", userId)
      .single();

    if (goalError || !goal) {
      return { success: false, error: "Goal not found" };
    }

    // Calculate new Leitner box
    const newBox = calculateNewLeitnerBox(
      goal.leitner_box,
      sessionResult.understandingScore
    );

    // Calculate next revision date
    const nextRevisionAt = calculateNextRevisionDate(newBox);

    // Update goal
    const { error: updateError } = await supabase
      .from("study_ai_goals")
      .update({
        leitner_box: newBox,
        revision_count: goal.revision_count + 1,
        last_revised_at: new Date().toISOString(),
        next_revision_at: nextRevisionAt.toISOString(),
      })
      .eq("id", goalId);

    if (updateError) {
      console.error("Error updating goal:", updateError);
      return { success: false, error: "Failed to update goal" };
    }

    // Award XP
    const xpAmount = calculateXPReward(sessionResult.understandingScore);

    // Insert XP transaction
    await supabase.from("xp_transactions").insert({
      user_id: userId,
      amount: xpAmount,
      reason: "guided_learning_complete",
      reference_id: `guided_session_${sessionResult.sessionId}`,
    });

    // Update profile XP using RPC function if available
    try {
      await supabase.rpc("increment_xp", {
        user_id: userId,
        xp_amount: xpAmount,
      });
    } catch {
      // If RPC doesn't exist, update directly
      const { data: profile } = await supabase
        .from("profiles")
        .select("xp_points")
        .eq("id", userId)
        .single();

      if (profile) {
        await supabase
          .from("profiles")
          .update({ xp_points: (profile.xp_points || 0) + xpAmount })
          .eq("id", userId);
      }
    }

    return {
      success: true,
      newLeitnerBox: newBox,
      xpAwarded: xpAmount,
    };
  } catch (error) {
    console.error("Error updating goal from guided session:", error);
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * Update planner topic review based on guided learning session result
 * For topics within study plans (not standalone goals)
 */
export async function updatePlannerTopicFromGuidedSession(
  planId: string,
  subject: string,
  topics: string[],
  userId: string,
  sessionResult: SessionResult
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Find the topic review entry
    const { data: review, error: findError } = await supabase
      .from("study_plan_topic_reviews")
      .select("*")
      .eq("plan_id", planId)
      .eq("subject", subject)
      .eq("user_id", userId)
      .single();

    if (findError || !review) {
      // No review entry exists - this is okay, planner topics may not have review entries
      return { success: true };
    }

    // Calculate new Leitner box
    const newBox = calculateNewLeitnerBox(
      review.leitner_box,
      sessionResult.understandingScore
    );

    // Calculate next revision date
    const nextReviewAt = calculateNextRevisionDate(newBox);

    // Update review
    await supabase
      .from("study_plan_topic_reviews")
      .update({
        leitner_box: newBox,
        next_review_at: nextReviewAt.toISOString(),
        last_reviewed_at: new Date().toISOString(),
        review_count: review.review_count + 1,
      })
      .eq("id", review.id);

    return { success: true };
  } catch (error) {
    console.error("Error updating planner topic from guided session:", error);
    return { success: false, error: "Unexpected error" };
  }
}
