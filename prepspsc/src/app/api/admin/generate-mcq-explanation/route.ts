import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateMCQExplanation } from "@/lib/gemini";
import type { QuestionOption } from "@/types/database.types";

// Create Supabase admin client
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key);
}

/**
 * Generate AI explanation for a single MCQ question
 * Called when:
 * 1. Admin creates a new MCQ question
 * 2. Admin edits an MCQ question content
 * 3. Admin manually triggers regeneration
 */
export async function POST(request: NextRequest) {
  try {
    const { questionId, regenerate } = await request.json();

    if (!questionId) {
      return NextResponse.json(
        { error: "Question ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch the question
    const { data: question, error: fetchError } = await supabase
      .from("questions")
      .select("*")
      .eq("id", questionId)
      .single();

    if (fetchError || !question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // Only generate for MCQ questions
    if (question.type !== "mcq") {
      return NextResponse.json(
        { error: "Only MCQ questions can have pregenerated explanations" },
        { status: 400 }
      );
    }

    // Skip if already has explanation (unless regenerate flag is set)
    if (question.ai_explanation && !regenerate) {
      return NextResponse.json({
        success: true,
        message: "Question already has an AI explanation",
        skipped: true,
      });
    }

    // Validate required fields
    if (!question.options || !question.correct_answer) {
      return NextResponse.json(
        { error: "Question must have options and a correct answer" },
        { status: 400 }
      );
    }

    console.log(`Generating AI explanation for question ${questionId}...`);

    // Generate explanation using Gemini
    const explanation = await generateMCQExplanation({
      content: question.content,
      options: question.options as QuestionOption[],
      correctAnswer: question.correct_answer,
    });

    // Save to question
    const { error: updateError } = await supabase
      .from("questions")
      .update({ ai_explanation: explanation })
      .eq("id", questionId);

    if (updateError) {
      console.error("Failed to save explanation:", updateError);
      return NextResponse.json(
        { error: "Failed to save explanation" },
        { status: 500 }
      );
    }

    console.log(`AI explanation generated for question ${questionId}`);

    return NextResponse.json({
      success: true,
      questionId,
      explanation,
    });
  } catch (error) {
    console.error("Error generating MCQ explanation:", error);
    return NextResponse.json(
      { error: "Failed to generate explanation" },
      { status: 500 }
    );
  }
}

/**
 * Get migration status - how many MCQ questions have pregenerated explanations
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // Count total MCQ questions
    const { count: totalCount } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("type", "mcq");

    // Count MCQ questions with pregenerated explanations
    const { count: migratedCount } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("type", "mcq")
      .not("ai_explanation", "is", null);

    const total = totalCount || 0;
    const migrated = migratedCount || 0;
    const remaining = total - migrated;
    const percent = total > 0 ? Math.round((migrated / total) * 100) : 100;

    return NextResponse.json({
      total,
      migrated,
      remaining,
      percent,
    });
  } catch (error) {
    console.error("Error getting migration status:", error);
    return NextResponse.json(
      { error: "Failed to get migration status" },
      { status: 500 }
    );
  }
}
