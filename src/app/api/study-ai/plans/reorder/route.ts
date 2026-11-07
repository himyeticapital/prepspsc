import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Reorder schedule within a study plan
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { planId, schedule } = body;

    if (!planId || !schedule) {
      return NextResponse.json(
        { error: "Missing planId or schedule" },
        { status: 400 }
      );
    }

    // Verify the plan belongs to the user
    const { data: existingPlan, error: fetchError } = await supabase
      .from("study_plans")
      .select("id, user_id")
      .eq("id", planId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existingPlan) {
      return NextResponse.json(
        { error: "Plan not found or unauthorized" },
        { status: 404 }
      );
    }

    // Update the schedule
    const { error: updateError } = await supabase
      .from("study_plans")
      .update({ schedule })
      .eq("id", planId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[plans/reorder] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update schedule" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[plans/reorder] Error:", errorMessage);
    return NextResponse.json(
      { error: "Failed to reorder schedule" },
      { status: 500 }
    );
  }
}
