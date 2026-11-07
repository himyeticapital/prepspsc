import { hasProAccess } from "@/lib/access";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/study-ai/collab-plan/save-guest
// Called by the guest after receiving the plan_generated broadcast.
// Inserts an independent study_plans row for the guest's account.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { sessionId, plan } = body;

  if (!sessionId || !plan) {
    return NextResponse.json({ error: "sessionId and plan are required" }, { status: 400 });
  }

  // Verify the caller is the guest for this session
  const { data: session } = await supabase
    .from("collab_plan_sessions")
    .select("guest_id, host_id, status")
    .eq("id", sessionId)
    .single();

  if (!session || session.guest_id !== user.id) {
    return NextResponse.json({ error: "Not authorized for this session" }, { status: 403 });
  }

  if (session.status !== "completed") {
    return NextResponse.json({ error: "Session is not completed yet" }, { status: 400 });
  }

  // Rate-limit: free users 1 plan per week (same as host)
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_pro_member")
    .eq("id", user.id)
    .single();

  if (!hasProAccess(profile)) {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const { count } = await supabase
      .from("study_plans")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneWeekAgo.toISOString());

    if ((count ?? 0) >= 1) {
      return NextResponse.json(
        { error: "Weekly plan limit reached. Upgrade to Pro for unlimited plans.", code: "WEEKLY_LIMIT" },
        { status: 429 }
      );
    }
  }

  // Insert a new study_plans row for the guest (independent copy)
  const { data: savedPlan, error: saveError } = await supabase
    .from("study_plans")
    .insert({
      user_id: user.id,
      title: plan.title,
      exam_type: plan.examType,
      duration_weeks: plan.durationWeeks,
      hours_per_day: plan.hoursPerDay,
      focus_areas: plan.focusAreas || [],
      schedule: plan.schedule,
      resources: plan.resources || [],
      microthemes: plan.microthemes || null,
    })
    .select()
    .single();

  if (saveError || !savedPlan) {
    console.error("[save-guest] Failed to save plan:", saveError);
    return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
  }

  // Record the guest's plan ID on the session
  await supabase
    .from("collab_plan_sessions")
    .update({ guest_plan_id: savedPlan.id })
    .eq("id", sessionId);

  return NextResponse.json({
    planId: savedPlan.id,
    plan: {
      id: savedPlan.id,
      title: savedPlan.title,
      examType: savedPlan.exam_type,
      durationWeeks: savedPlan.duration_weeks,
      hoursPerDay: savedPlan.hours_per_day,
      createdAt: savedPlan.created_at,
      schedule: savedPlan.schedule,
      resources: savedPlan.resources,
      progress: savedPlan.progress,
      microthemes: savedPlan.microthemes || [],
    },
  });
}
