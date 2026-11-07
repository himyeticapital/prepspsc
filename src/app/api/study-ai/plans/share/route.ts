import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// POST /api/study-ai/plans/share
// Body: { planId: string, matchId: number }
// Copies an existing study plan to the matched buddy's account and notifies them via DM.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { planId, matchId } = body;

    if (!planId || !matchId) {
      return NextResponse.json({ error: "planId and matchId are required" }, { status: 400 });
    }

    // 1. Load the plan and verify ownership
    const { data: plan, error: planError } = await supabase
      .from("study_plans")
      .select("*")
      .eq("id", planId)
      .eq("user_id", user.id)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // 2. Verify active buddy match and get buddy_id
    const { data: match, error: matchError } = await supabase
      .from("buddy_matches")
      .select("id, user_a_id, user_b_id, status")
      .eq("id", matchId)
      .eq("status", "active")
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: "Active buddy match not found" }, { status: 404 });
    }

    const buddyId = match.user_a_id === user.id ? match.user_b_id : match.user_a_id;

    // Use service role for the write operations (buddy's data)
    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Copy plan to buddy's account (reset progress, keep all content)
    const { data: newPlan, error: copyError } = await service
      .from("study_plans")
      .insert({
        user_id: buddyId,
        title: plan.title,
        exam_type: plan.exam_type,
        duration_weeks: plan.duration_weeks,
        hours_per_day: plan.hours_per_day,
        focus_areas: plan.focus_areas,
        schedule: plan.schedule,
        resources: plan.resources,
        microthemes: plan.microthemes,
        progress: 0,
      })
      .select("id")
      .single();

    if (copyError || !newPlan) {
      console.error("Failed to copy plan:", copyError);
      return NextResponse.json({ error: "Failed to share plan" }, { status: 500 });
    }

    // 4. Get sharer's display name for the DM
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", user.id)
      .single();
    const senderName = (myProfile as any)?.full_name || (myProfile as any)?.username || "Your buddy";

    // 5. Send DM to buddy
    await service
      .from("buddy_messages")
      .insert({
        match_id: matchId,
        sender_id: user.id,
        content: `📚 *${senderName}* shared their study plan **"${plan.title}"** with you! Check it out in [Study with AI → Planner](/study-ai?tab=planner).`,
      });

    return NextResponse.json({ success: true, sharedPlanId: newPlan.id });
  } catch (error) {
    console.error("Share plan error:", error);
    return NextResponse.json({ error: "Failed to share plan" }, { status: 500 });
  }
}
