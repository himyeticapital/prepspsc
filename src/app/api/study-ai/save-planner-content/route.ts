import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PLANNER_GOAL_NAME = "📋 Study Planner Saves";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, generationType, outputData, subject, topics } = body;

    if (!title || !generationType || !outputData) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Find or create the Study Planner goal for this user
    let { data: plannerGoal } = await supabase
      .from("study_ai_goals")
      .select("id")
      .eq("user_id", user.id)
      .eq("goal_text", PLANNER_GOAL_NAME)
      .single();

    // If no planner goal exists, create one
    if (!plannerGoal) {
      const { data: newGoal, error: createError } = await supabase
        .from("study_ai_goals")
        .insert({
          user_id: user.id,
          goal_text: PLANNER_GOAL_NAME,
          is_archived: false,
        })
        .select("id")
        .single();

      if (createError) {
        console.error("Failed to create planner goal:", createError);
        return NextResponse.json(
          { error: "Failed to create planner goal" },
          { status: 500 }
        );
      }

      plannerGoal = newGoal;
    }

    // Insert the generation with is_saved = true
    const { data: generation, error: insertError } = await supabase
      .from("ai_generations")
      .insert({
        user_id: user.id,
        goal_id: plannerGoal.id,
        generation_type: generationType,
        output_data: {
          ...outputData,
          _planner_meta: {
            subject,
            topics,
            savedFrom: "study-planner",
          },
        },
        title,
        is_saved: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to save content:", insertError);
      return NextResponse.json(
        { error: "Failed to save content" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      generation,
      message: "Content saved successfully!",
    });
  } catch (error) {
    console.error("Save planner content error:", error);
    return NextResponse.json(
      { error: "Failed to save content" },
      { status: 500 }
    );
  }
}
