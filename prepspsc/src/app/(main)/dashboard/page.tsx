import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Fetch study logs for heatmap (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: studyLogs } = await supabase
    .from("daily_study_logs")
    .select("*")
    .eq("user_id", user.id)
    .gte("study_date", sixMonthsAgo.toISOString().split("T")[0])
    .order("study_date", { ascending: true });

  // Fetch weekly study data for chart
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: weeklyLogs } = await supabase
    .from("daily_study_logs")
    .select("*")
    .eq("user_id", user.id)
    .gte("study_date", weekAgo.toISOString().split("T")[0])
    .order("study_date", { ascending: true });

  // Prepare weekly chart data
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyChartData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const log = weeklyLogs?.find((l) => l.study_date === dateStr);
    weeklyChartData.push({
      day: days[date.getDay()],
      minutes: log?.minutes_studied || 0,
    });
  }

  // Fetch leaderboard (top 10 users by study time)
  const { data: leaderboardUsers } = await supabase
    .from("profiles")
    .select("*")
    .order("total_minutes_all_time", { ascending: false })
    .limit(10);

  // Fetch user's test stats
  const { data: testAttempts } = await supabase
    .from("test_attempts")
    .select("id, status")
    .eq("user_id", user.id);

  const completedTests = testAttempts?.filter((t) => t.status === "completed").length || 0;

  // Check if user has studied today (for streak-at-risk detection)
  const today = new Date().toISOString().split("T")[0];
  const hasStudiedToday = weeklyLogs?.some(
    (l) => l.study_date === today && l.minutes_studied > 0
  ) ?? false;

  // Fetch achievements based on user's pro status
  // Free users see only non-pro achievements, Pro users see pro-exclusive achievements
  const isPro = profile?.is_pro_member ?? false;

  const { data: achievements } = await supabase
    .from("achievements")
    .select("*")
    .eq("is_pro_only", isPro) // Free users: is_pro_only=false, Pro users: is_pro_only=true
    .order("sort_order");

  // Fetch user's unlocked achievements
  const { data: userAchievements } = await supabase
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", user.id);

  const unlockedAchievementIds = (userAchievements || []).map((ua) => ua.achievement_id);

  return (
    <DashboardClient
      profile={profile}
      studyLogs={studyLogs || []}
      weeklyChartData={weeklyChartData}
      leaderboardUsers={leaderboardUsers || []}
      completedTests={completedTests}
      userId={user.id}
      achievements={achievements || []}
      unlockedAchievementIds={unlockedAchievementIds}
      hasStudiedToday={hasStudiedToday}
    />
  );
}
