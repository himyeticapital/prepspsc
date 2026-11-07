/**
 * Hybrid Handler
 * Handles features that work best on web but have quick bot actions
 */

import { createClient } from "@supabase/supabase-js";
import type { BotConnection, BotResponse } from "@/lib/bot/types";
import * as personality from "@/lib/bot/personality";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Handle hybrid features that need deep links to web
 */
export async function handleHybrid(
  connection: BotConnection,
  feature: string
): Promise<BotResponse> {
  switch (feature) {
    case "test":
      return personality.mockTestOptions();

    case "room":
      return await handleRooms(connection);

    case "rank":
      return await handleRank(connection);

    case "course":
      return await handleCourse(connection);

    default:
      return personality.featureUnavailable(feature);
  }
}

/**
 * Get active study rooms
 */
async function handleRooms(connection: BotConnection): Promise<BotResponse> {
  try {
    // Get active rooms (if rooms table exists)
    const { data: rooms } = await supabase
      .from("study_rooms")
      .select("name, participant_count")
      .eq("is_active", true)
      .order("participant_count", { ascending: false })
      .limit(3);

    const activeRooms = rooms?.map((r) => ({
      name: r.name,
      count: r.participant_count || 0,
    })) || [];

    return personality.studyRoomOptions(activeRooms);
  } catch (error) {
    // Table might not exist, return empty rooms
    return personality.studyRoomOptions([]);
  }
}

/**
 * Get user's leaderboard position
 */
async function handleRank(connection: BotConnection): Promise<BotResponse> {
  try {
    // Get user's XP
    const { data: profile } = await supabase
      .from("profiles")
      .select("total_xp")
      .eq("id", connection.user_id)
      .single();

    const userXP = profile?.total_xp || 0;

    // Get rank (count of users with more XP)
    const { count: usersAbove } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gt("total_xp", userXP);

    const rank = (usersAbove || 0) + 1;

    // Get top 3 users
    const { data: topUsers } = await supabase
      .from("profiles")
      .select("full_name, username, total_xp")
      .order("total_xp", { ascending: false })
      .limit(3);

    const top3 = topUsers?.map((u) => ({
      name: u.full_name || u.username || "Anonymous",
      xp: u.total_xp || 0,
    })) || [];

    // Calculate XP to next rank
    let xpToNext = 0;
    if (rank > 1 && topUsers && topUsers.length > 0) {
      // Find user just above current user
      const { data: nextUser } = await supabase
        .from("profiles")
        .select("total_xp")
        .gt("total_xp", userXP)
        .order("total_xp", { ascending: true })
        .limit(1)
        .single();

      if (nextUser) {
        xpToNext = nextUser.total_xp - userXP;
      }
    }

    return personality.leaderboardPosition(rank, userXP, xpToNext, top3);
  } catch (error) {
    console.error("Rank handler error:", error);
    return personality.errorMessage();
  }
}

/**
 * Get user's course progress
 */
async function handleCourse(connection: BotConnection): Promise<BotResponse> {
  try {
    // Get user's active course purchases
    const { data: purchases } = await supabase
      .from("course_purchases")
      .select(`
        course:courses(title, slug),
        expires_at
      `)
      .eq("user_id", connection.user_id)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .limit(1);

    if (!purchases || purchases.length === 0) {
      return {
        text: `📺 <b>Video Courses</b>

Explore our coaching courses with:
• Expert video lessons
• Notes & MCQs
• Progress tracking

Start learning today!`,
        parseMode: "HTML",
        buttons: [
          { text: "🎓 Browse Courses", url: `${process.env.NEXT_PUBLIC_APP_URL}/coaching` },
        ],
      };
    }

    const purchase = purchases[0];
    const courseData = purchase.course as unknown as { title: string; slug: string } | { title: string; slug: string }[] | null;
    const course = Array.isArray(courseData) ? courseData[0] : courseData;

    if (!course) {
      return {
        text: "Course information not available. Please try again later.",
        buttons: [
          { text: "🎓 Browse Courses", url: `${process.env.NEXT_PUBLIC_APP_URL}/coaching` },
        ],
      };
    }

    // Get progress for this course
    const { data: progress } = await supabase
      .from("course_progress")
      .select("lesson_id")
      .eq("user_id", connection.user_id)
      .not("completed_at", "is", null);

    // Get total lessons for course
    const { count: totalLessons } = await supabase
      .from("course_lessons")
      .select("*", { count: "exact", head: true })
      .eq("module_id", course.slug); // Simplified - in production, join through modules

    const completedLessons = progress?.length || 0;
    const progressPercent = totalLessons
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;

    // Get next lesson
    const { data: nextLesson } = await supabase
      .from("course_lessons")
      .select("title")
      .not("id", "in", `(${progress?.map((p) => `'${p.lesson_id}'`).join(",") || "''"})`)
      .order("order_index", { ascending: true })
      .limit(1)
      .single();

    return personality.courseProgress(
      course.title,
      progressPercent,
      nextLesson?.title
    );
  } catch (error) {
    // Course tables might not exist yet
    console.log("Course handler error:", error);
    return {
      text: `📺 <b>Video Courses</b>

Coaching courses coming soon! Stay tuned for expert-led video lessons.`,
      parseMode: "HTML",
      buttons: [
        { text: "🌐 Visit Website", url: process.env.NEXT_PUBLIC_APP_URL || "https://prepspsc.com" },
      ],
    };
  }
}
