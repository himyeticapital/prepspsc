import { hasProAccess } from "@/lib/access";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Leitner system intervals (in days) - same as Goals page
const LEITNER_INTERVALS: Record<number, number> = {
  1: 1,   // Box 1: 1 day
  2: 3,   // Box 2: 3 days
  3: 7,   // Box 3: 7 days
  4: 14,  // Box 4: 14 days
  5: 30,  // Box 5: 30 days
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { reviewId, rating } = await request.json();

    if (!reviewId || !rating) {
      return NextResponse.json(
        { error: "Missing required fields: reviewId, rating" },
        { status: 400 }
      );
    }

    // Valid ratings: "easy", "hard", "again"
    if (!["easy", "hard", "again"].includes(rating)) {
      return NextResponse.json(
        { error: "Invalid rating. Must be: easy, hard, or again" },
        { status: 400 }
      );
    }

    // Fetch the review entry
    const { data: review, error: fetchError } = await supabase
      .from("study_plan_topic_reviews")
      .select("*")
      .eq("id", reviewId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Calculate new Leitner box based on rating
    const currentBox = review.leitner_box || 1;
    let newBox: number;

    switch (rating) {
      case "easy":
        // Move up one box (max 5)
        newBox = Math.min(currentBox + 1, 5);
        break;
      case "hard":
        // Stay in same box
        newBox = currentBox;
        break;
      case "again":
        // Reset to box 1
        newBox = 1;
        break;
      default:
        newBox = currentBox;
    }

    // Calculate next review date
    const daysUntilNext = LEITNER_INTERVALS[newBox] || 1;
    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + daysUntilNext);

    // Update the review entry
    const { error: updateError } = await supabase
      .from("study_plan_topic_reviews")
      .update({
        leitner_box: newBox,
        next_review_at: nextReviewAt.toISOString(),
        last_reviewed_at: new Date().toISOString(),
        review_count: (review.review_count || 0) + 1,
      })
      .eq("id", reviewId);

    if (updateError) {
      console.error("Failed to update review:", updateError);
      return NextResponse.json(
        { error: "Failed to update review" },
        { status: 500 }
      );
    }

    // Award XP for completing review
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro_member, xp_points")
      .eq("id", user.id)
      .single();

    const isPro = hasProAccess(profile);
    const baseXp = rating === "easy" ? 10 : rating === "hard" ? 8 : 5;
    const finalXp = isPro ? Math.floor(baseXp * 1.5) : baseXp;

    // Insert XP transaction
    await supabase.from("xp_transactions").insert({
      user_id: user.id,
      amount: finalXp,
      reason: "planner_topic_revision",
      multiplier: isPro ? 1.5 : 1,
      reference_id: `planner-review-${reviewId}`,
    });

    // Update profile XP
    if (profile) {
      const newXP = (profile.xp_points || 0) + finalXp;
      await supabase
        .from("profiles")
        .update({ xp_points: newXP })
        .eq("id", user.id);
    }

    return NextResponse.json({
      success: true,
      newBox,
      nextReviewAt: nextReviewAt.toISOString(),
      daysUntilNext,
      xpEarned: finalXp,
    });
  } catch (error) {
    console.error("Planner revision error:", error);
    return NextResponse.json(
      { error: "Failed to update review" },
      { status: 500 }
    );
  }
}
