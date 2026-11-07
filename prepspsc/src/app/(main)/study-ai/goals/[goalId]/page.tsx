import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { GoalDetailClient } from "./goal-detail-client";

// Disable caching to always show fresh data
export const dynamic = "force-dynamic";

interface GoalDetailPageProps {
  params: Promise<{ goalId: string }>;
}

export async function generateMetadata({ params }: GoalDetailPageProps) {
  const { goalId } = await params;
  const supabase = await createClient();

  const { data: goal } = await supabase
    .from("study_ai_goals")
    .select("goal_text")
    .eq("id", parseInt(goalId))
    .single();

  return {
    title: goal ? `${goal.goal_text} | Study with AI` : "Study Goal | PrepSPSC",
  };
}

export default async function GoalDetailPage({ params }: GoalDetailPageProps) {
  const { goalId } = await params;
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
    .select("is_pro_member")
    .eq("id", user.id)
    .single();

  // Get today's generation counts per type
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: todayGenerations } = await supabase
    .from("ai_generations")
    .select("generation_type")
    .eq("user_id", user.id)
    .gte("created_at", todayStart.toISOString());

  // Count generations by type for today
  const generationsByType: Record<string, number> = {
    summary: 0,
    mindmap: 0,
    flashcards: 0,
    quiz: 0,
    infographic: 0,
  };

  (todayGenerations || []).forEach((gen) => {
    if (gen.generation_type in generationsByType) {
      generationsByType[gen.generation_type]++;
    }
  });

  // Fetch the goal
  const { data: goal, error: goalError } = await supabase
    .from("study_ai_goals")
    .select("*")
    .eq("id", parseInt(goalId))
    .eq("user_id", user.id)
    .single();

  if (goalError || !goal) {
    notFound();
  }

  // Fetch uploads for this goal
  const { data: uploads } = await supabase
    .from("study_uploads")
    .select("*")
    .eq("goal_id", goal.id)
    .order("created_at", { ascending: true });

  // Fetch generations for this goal
  const { data: generations } = await supabase
    .from("ai_generations")
    .select("*")
    .eq("goal_id", goal.id)
    .order("created_at", { ascending: false });

  return (
    <GoalDetailClient
      userId={user.id}
      goal={goal}
      uploads={uploads || []}
      generations={generations || []}
      isPro={profile?.is_pro_member || false}
      generationsByType={generationsByType}
    />
  );
}
