import { hasProAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { RevisionClient } from "./revision-client";

// Special goal name for planner saves - should be hidden from revision list
const PLANNER_GOAL_NAME = "📋 Study Planner Saves";

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

  // Fetch user profile for isPro status
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_pro_member")
    .eq("id", user.id)
    .single();

  const isPro = hasProAccess(profile);

  // Fetch goals due for revision (next_revision_at <= now, excluding planner saves)
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
    .neq("goal_text", PLANNER_GOAL_NAME)
    .lte("next_revision_at", now)
    .order("next_revision_at", { ascending: true });

  // Fetch upcoming goals (next_revision_at > now, excluding planner saves)
  const { data: upcomingGoals } = await supabase
    .from("study_ai_goals")
    .select(`
      *,
      study_uploads(count),
      ai_generations(count)
    `)
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .neq("goal_text", PLANNER_GOAL_NAME)
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

  // Fetch planner topics due for review
  const { data: duePlannerTopics } = await supabase
    .from("study_plan_topic_reviews")
    .select(`
      *,
      study_plans(id, title, exam_type)
    `)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .lte("next_review_at", now)
    .order("next_review_at", { ascending: true });

  // Fetch upcoming planner topics
  const { data: upcomingPlannerTopics } = await supabase
    .from("study_plan_topic_reviews")
    .select(`
      *,
      study_plans(id, title, exam_type)
    `)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .gt("next_review_at", now)
    .order("next_review_at", { ascending: true })
    .limit(10);

  return (
    <RevisionClient
      dueGoals={dueGoals || []}
      upcomingGoals={upcomingGoals || []}
      recentSessions={recentSessions || []}
      duePlannerTopics={duePlannerTopics || []}
      upcomingPlannerTopics={upcomingPlannerTopics || []}
      isPro={isPro}
    />
  );
}
