import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { RevisionClient } from "./revision-client";

export const metadata = {
  title: "Revision | Study with AI",
};

export default async function RevisionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch goals due for revision (next_revision_at <= now)
  const now = new Date().toISOString();

  const { data: dueGoals } = await supabase
    .from("study_ai_goals")
    .select(`
      *,
      study_uploads(count),
      ai_generations(count)
    `)
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .lte("next_revision_at", now)
    .order("next_revision_at", { ascending: true });

  // Fetch upcoming goals (next_revision_at > now)
  const { data: upcomingGoals } = await supabase
    .from("study_ai_goals")
    .select(`
      *,
      study_uploads(count),
      ai_generations(count)
    `)
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .gt("next_revision_at", now)
    .order("next_revision_at", { ascending: true })
    .limit(10);

  // Fetch recent blurt sessions
  const { data: recentSessions } = await supabase
    .from("blurt_sessions")
    .select("*, study_ai_goals(goal_text)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <RevisionClient
      dueGoals={dueGoals || []}
      upcomingGoals={upcomingGoals || []}
      recentSessions={recentSessions || []}
    />
  );
}
