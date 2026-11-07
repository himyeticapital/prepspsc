import { hasProAccess } from "@/lib/access";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Leitner system intervals (in days)
const LEITNER_INTERVALS = {
  1: 1,   // Box 1: 1 day
  2: 3,   // Box 2: 3 days
  3: 7,   // Box 3: 7 days
  4: 14,  // Box 4: 14 days
  5: 30,  // Box 5: 30 days
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { goalId, rating } = await request.json();

    if (!goalId || !rating) {
      return NextResponse.json(
        { error: "Missing required fields: goalId, rating" },
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

    // Fetch the goal
    const { data: goal, error: fetchError } = await supabase
      .from("study_ai_goals")
      .select("*")
      .eq("id", goalId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    // Calculate new Leitner box based on rating
    let currentBox = goal.leitner_box || 1;
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

    // Calculate next revision date
    const daysUntilNext = LEITNER_INTERVALS[newBox as keyof typeof LEITNER_INTERVALS] || 1;
    const nextRevisionAt = new Date();
    nextRevisionAt.setDate(nextRevisionAt.getDate() + daysUntilNext);

    // Update the goal
    const { error: updateError } = await supabase
      .from("study_ai_goals")
      .update({
        leitner_box: newBox,
        next_revision_at: nextRevisionAt.toISOString(),
        last_revised_at: new Date().toISOString(),
        revision_count: (goal.revision_count || 0) + 1,
      })
      .eq("id", goalId);

    if (updateError) {
      console.error("Failed to update goal:", updateError);
      return NextResponse.json(
        { error: "Failed to schedule revision" },
        { status: 500 }
      );
    }

    // Award XP for completing revision
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
      reason: "revision_completed",
      multiplier: isPro ? 1.5 : 1,
      reference_id: goalId.toString(),
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
      nextRevisionAt: nextRevisionAt.toISOString(),
      daysUntilNext,
      xpEarned: finalXp,
    });
  } catch (error) {
    console.error("Schedule revision error:", error);
    return NextResponse.json(
      { error: "Failed to schedule revision" },
      { status: 500 }
    );
  }
}
