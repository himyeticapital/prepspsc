import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LeaderboardClient } from "./leaderboard-client";

export const metadata = {
  title: "Leaderboard | PrepSPSC",
  description: "See top performers this week",
};

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get date range for this week (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split("T")[0];

  // Fetch study logs for this week
  const { data: studyData } = await supabase
    .from("daily_study_logs")
    .select("user_id, minutes_studied")
    .gte("study_date", weekAgoStr);

  // Aggregate minutes by user
  const userMinutes: Record<string, number> = {};
  studyData?.forEach((log) => {
    userMinutes[log.user_id] = (userMinutes[log.user_id] || 0) + log.minutes_studied;
  });

  const userIds = Object.keys(userMinutes);

  // Fetch profiles for users with study time
  let profiles: any[] = [];
  if (userIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, profile_frame, current_streak, is_pro_member, trial_ends_at, xp_points")
      .in("id", userIds);
    profiles = data || [];
  }

  // Combine and sort
  const leaderboard = profiles
    .map((profile) => ({
      id: profile.id,
      username: profile.username,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      profile_frame: profile.profile_frame,
      total_minutes: userMinutes[profile.id] || 0,
      current_streak: profile.current_streak || 0,
      is_pro_member: profile.is_pro_member || false,
      trial_ends_at: profile.trial_ends_at || null,
      xp_points: profile.xp_points || 0,
    }))
    .sort((a, b) => b.total_minutes - a.total_minutes);

  // Fetch current user's profile
  const { data: currentUserProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Find current user's rank
  const userRank = leaderboard.findIndex((u) => u.id === user.id) + 1;

  return (
    <LeaderboardClient
      leaderboard={leaderboard}
      currentUserId={user.id}
      currentUserProfile={currentUserProfile}
      userRank={userRank > 0 ? userRank : null}
    />
  );
}
