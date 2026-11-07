import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date().toISOString();

    // Fetch all stats in parallel
    const [
      goalsResult,
      generationsResult,
      savedResult,
      dueResult,
      blurtSessionsResult,
    ] = await Promise.all([
      // Total study goals
      supabase
        .from("study_ai_goals")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_archived", false),

      // Total materials generated
      supabase
        .from("ai_generations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),

      // Items saved/bookmarked
      supabase
        .from("ai_generations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_saved", true),

      // Items due for review
      supabase
        .from("study_ai_goals")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_archived", false)
        .lte("next_revision_at", now),

      // Recent blurt sessions (last 7 days for streak calculation)
      supabase
        .from("blurt_sessions")
        .select("created_at")
        .eq("user_id", user.id)
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false }),
    ]);

    // Calculate revision streak
    const calculateStreak = (sessions: { created_at: string }[] | null) => {
      if (!sessions || sessions.length === 0) return 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get unique dates
      const uniqueDates = new Set<string>();
      sessions.forEach((session) => {
        const date = new Date(session.created_at);
        date.setHours(0, 0, 0, 0);
        uniqueDates.add(date.toISOString());
      });

      const sortedDates = Array.from(uniqueDates).sort().reverse();
      let streak = 0;
      let expectedDate = today;

      for (const dateStr of sortedDates) {
        const date = new Date(dateStr);

        // Check if this date is the expected date or the day before
        const diffDays = Math.round((expectedDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0 || diffDays === 1) {
          streak++;
          expectedDate = date;
          expectedDate.setDate(expectedDate.getDate() - 1);
        } else {
          break;
        }
      }

      return streak;
    };

    const revisionStreak = calculateStreak(blurtSessionsResult.data);

    // Get last activity
    const { data: lastActivity } = await supabase
      .from("ai_generations")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      totalStudyGoals: goalsResult.count || 0,
      materialsGenerated: generationsResult.count || 0,
      itemsSaved: savedResult.count || 0,
      dueForReview: dueResult.count || 0,
      revisionStreak,
      lastActivityAt: lastActivity?.created_at || null,
    });
  } catch (error) {
    console.error("Study AI stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
