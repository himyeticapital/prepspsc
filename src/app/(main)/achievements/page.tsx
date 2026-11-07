import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AchievementsClient } from "./achievements-client";

export const metadata = {
  title: "Achievements | PrepSPSC",
  description: "Track your achievements and progress",
};

export default async function AchievementsPage() {
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

  // Fetch all achievements
  const { data: achievements } = await supabase
    .from("achievements")
    .select("*")
    .order("sort_order");

  // Fetch user's unlocked achievements
  const { data: userAchievements } = await supabase
    .from("user_achievements")
    .select("*, achievement:achievements(*)")
    .eq("user_id", user.id);

  // Get test stats for context
  const { count: testsCompleted } = await supabase
    .from("test_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "completed");

  return (
    <AchievementsClient
      profile={profile}
      achievements={achievements || []}
      userAchievements={userAchievements || []}
      testsCompleted={testsCompleted || 0}
    />
  );
}
