import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileClient } from "./profile-client";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Fetch study logs for heatmap
  const { data: studyLogs } = await supabase
    .from("daily_study_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("study_date", { ascending: false })
    .limit(365);

  // Fetch completed tests count
  const { count: completedTests } = await supabase
    .from("test_attempts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "completed");

  // Calculate total bookmarks
  const { count: totalBookmarks } = await supabase
    .from("bookmarks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Fetch achievements
  const { data: achievements } = await supabase
    .from("achievements")
    .select("*")
    .order("sort_order");

  // Fetch user's unlocked achievements
  const { data: userAchievements } = await supabase
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", user.id);

  const unlockedAchievementIds = (userAchievements || []).map((ua) => ua.achievement_id);

  // Fetch profile frames
  const { data: profileFrames } = await supabase
    .from("profile_frames")
    .select("*")
    .order("sort_order");

  return (
    <ProfileClient
      profile={profile}
      studyLogs={studyLogs || []}
      completedTests={completedTests || 0}
      totalBookmarks={totalBookmarks || 0}
      userEmail={user.email || ""}
      achievements={achievements || []}
      unlockedAchievementIds={unlockedAchievementIds}
      profileFrames={profileFrames || []}
    />
  );
}
