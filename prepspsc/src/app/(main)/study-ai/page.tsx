import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StudyAIClient } from "./study-ai-client";

export const metadata = {
  title: "Study with AI | PrepSPSC",
  description: "AI-powered study materials - mindmaps, summaries, flashcards, quizzes, and more",
};

export default async function StudyAIPage() {
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

  // Fetch user's study goals (non-archived)
  const { data: goals } = await supabase
    .from("study_ai_goals")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  // Fetch recent generations
  const { data: generations } = await supabase
    .from("ai_generations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Fetch saved generations
  const { data: savedGenerations } = await supabase
    .from("ai_generations")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_saved", true)
    .order("created_at", { ascending: false });

  return (
    <StudyAIClient
      userId={user.id}
      isPro={profile?.is_pro_member || false}
      generationsByType={generationsByType}
      goals={goals || []}
      recentGenerations={generations || []}
      savedGenerations={savedGenerations || []}
    />
  );
}
