import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date().toISOString();

    // Fetch topics due for review (next_review_at <= now)
    const { data: dueTopics, error: dueError } = await supabase
      .from("study_plan_topic_reviews")
      .select(`
        *,
        study_plans!inner (
          id,
          title,
          exam_type
        )
      `)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .lte("next_review_at", now)
      .order("next_review_at", { ascending: true });

    if (dueError) {
      console.error("Failed to fetch due topics:", dueError);
      return NextResponse.json(
        { error: "Failed to fetch due topics" },
        { status: 500 }
      );
    }

    // Fetch upcoming reviews (next_review_at > now), limit to 10
    const { data: upcomingTopics, error: upcomingError } = await supabase
      .from("study_plan_topic_reviews")
      .select(`
        *,
        study_plans!inner (
          id,
          title,
          exam_type
        )
      `)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .gt("next_review_at", now)
      .order("next_review_at", { ascending: true })
      .limit(10);

    if (upcomingError) {
      console.error("Failed to fetch upcoming topics:", upcomingError);
      return NextResponse.json(
        { error: "Failed to fetch upcoming topics" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      dueTopics: dueTopics || [],
      upcomingTopics: upcomingTopics || [],
      dueCount: dueTopics?.length || 0,
    });
  } catch (error) {
    console.error("Fetch due reviews error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}
