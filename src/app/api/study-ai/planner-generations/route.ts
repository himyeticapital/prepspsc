import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PLANNER_GOAL_NAME = "📋 Study Planner Saves";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the Study Planner goal
    const { data: plannerGoal } = await supabase
      .from("study_ai_goals")
      .select("id")
      .eq("user_id", user.id)
      .eq("goal_text", PLANNER_GOAL_NAME)
      .single();

    if (!plannerGoal) {
      // No planner goal exists yet - return empty array
      return NextResponse.json({ generations: [] });
    }

    // Fetch all saved generations for this goal
    const { data: generations, error } = await supabase
      .from("ai_generations")
      .select("*")
      .eq("goal_id", plannerGoal.id)
      .eq("is_saved", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch planner generations:", error);
      return NextResponse.json(
        { error: "Failed to fetch generations" },
        { status: 500 }
      );
    }

    return NextResponse.json({ generations: generations || [] });
  } catch (error) {
    console.error("Planner generations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch generations" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { generationId } = await request.json();

    if (!generationId) {
      return NextResponse.json(
        { error: "Missing generationId" },
        { status: 400 }
      );
    }

    // Verify user owns the generation
    const { data: generation } = await supabase
      .from("ai_generations")
      .select("id, user_id")
      .eq("id", generationId)
      .single();

    if (!generation || generation.user_id !== user.id) {
      return NextResponse.json(
        { error: "Generation not found" },
        { status: 404 }
      );
    }

    // Delete the generation
    const { error } = await supabase
      .from("ai_generations")
      .delete()
      .eq("id", generationId);

    if (error) {
      console.error("Failed to delete generation:", error);
      return NextResponse.json(
        { error: "Failed to delete" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete generation error:", error);
    return NextResponse.json(
      { error: "Failed to delete" },
      { status: 500 }
    );
  }
}
