import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/study-ai/notebook-activity
 *
 * Called when a user interacts with a notebook tied to a study plan topic.
 * Upserts a study_plan_topic_reviews entry so the topic appears in spaced revision.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId, topicKey, subject, topics } = await request.json();

    if (!planId || !subject || !topics?.length) {
      return NextResponse.json(
        { error: "Missing required fields: planId, subject, topics" },
        { status: 400 }
      );
    }

    // Parse week/day from topicKey (e.g., "week-1-day-0")
    let weekNumber = 1;
    let dayNumber = 0;
    if (topicKey) {
      const match = topicKey.match(/week-(\d+)-day-(\d+)/);
      if (match) {
        weekNumber = parseInt(match[1], 10);
        dayNumber = parseInt(match[2], 10);
      }
    }

    // Check if review entry already exists
    const { data: existing } = await supabase
      .from("study_plan_topic_reviews")
      .select("id")
      .eq("plan_id", planId)
      .eq("subject", subject)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Already tracked — no need to create again
      return NextResponse.json({ success: true, alreadyTracked: true });
    }

    // Calculate next review date (Leitner Box 1 = 1 day)
    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + 1);

    // Create new review entry
    const { error: insertError } = await supabase
      .from("study_plan_topic_reviews")
      .upsert(
        {
          user_id: user.id,
          plan_id: planId,
          week_number: weekNumber,
          day_number: dayNumber,
          subject,
          topics,
          leitner_box: 1,
          next_review_at: nextReviewAt.toISOString(),
          is_active: true,
        },
        { onConflict: "plan_id,week_number,day_number" }
      );

    if (insertError) {
      console.error("Failed to create review entry:", insertError);
      return NextResponse.json(
        { error: "Failed to create review entry" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, created: true });
  } catch (error) {
    console.error("Notebook activity error:", error);
    return NextResponse.json(
      { error: "Failed to track notebook activity" },
      { status: 500 }
    );
  }
}
