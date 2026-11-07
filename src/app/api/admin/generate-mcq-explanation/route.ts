import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateMCQExplanation } from "@/lib/gemini";
import type { QuestionOption } from "@/types/database.types";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key);
}

/**
 * POST - Generate AI explanation for a single MCQ question
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

    if (question.type !== "mcq") {
      return NextResponse.json(
        { error: "Only MCQ questions support pregenerated explanations" },
        { status: 400 }
      );
    }

    if (question.ai_explanation && !regenerate) {
      return NextResponse.json({
        success: true,
        message: "Already has AI explanation",
        skipped: true,
      });
    }

    if (!question.options || !question.correct_answer) {
      return NextResponse.json(
        { error: "Question must have options and a correct answer" },
        { status: 400 }
      );
    }

    const explanation = await generateMCQExplanation({
      content: question.content,
      options: question.options as QuestionOption[],
      correctAnswer: question.correct_answer,
    });

    const { error: updateError } = await supabase
      .from("questions")
      .update({ ai_explanation: explanation })
      .eq("id", questionId);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to save explanation" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, questionId, explanation });
  } catch (error) {
    console.error("Error generating MCQ explanation:", error);
    return NextResponse.json(
      { error: "Failed to generate explanation" },
      { status: 500 }
    );
  }
}

/**
 * PUT - Batch generate AI explanations for multiple MCQ questions
 * Used after CSV import to pregenerate explanations in background
 */
export async function PUT(request: NextRequest) {
  try {
    const { questionIds } = await request.json();

    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return NextResponse.json(
        { error: "questionIds array is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch all MCQ questions that need explanations
    const { data: questions, error: fetchError } = await supabase
      .from("questions")
      .select("*")
      .in("id", questionIds)
      .eq("type", "mcq")
      .is("ai_explanation", null);

    if (fetchError || !questions) {
      return NextResponse.json(
        { error: "Failed to fetch questions" },
        { status: 500 }
      );
    }

    let successCount = 0;
    let failCount = 0;

    // Process in parallel batches of 5 for speed, with delay between batches
    const BATCH_SIZE = 5;
    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      const batch = questions.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (question) => {
          if (!question.options || !question.correct_answer) {
            throw new Error("missing options/answer");
          }

          const explanation = await generateMCQExplanation({
            content: question.content,
            options: question.options as QuestionOption[],
            correctAnswer: question.correct_answer,
          });

          await supabase
            .from("questions")
            .update({ ai_explanation: explanation })
            .eq("id", question.id);

          return true;
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled") successCount++;
        else failCount++;
      }

      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < questions.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return NextResponse.json({
      success: true,
      total: questions.length,
      successCount,
      failCount,
    });
  } catch (error) {
    console.error("Batch generate explanation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET - Check how many MCQ questions have pregenerated explanations
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { count: totalCount } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("type", "mcq");

    const { count: migratedCount } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("type", "mcq")
      .not("ai_explanation", "is", null);

    const total = totalCount || 0;
    const migrated = migratedCount || 0;

    return NextResponse.json({
      total,
      migrated,
      remaining: total - migrated,
      percent: total > 0 ? Math.round((migrated / total) * 100) : 100,
    });
  } catch (error) {
    console.error("Error getting migration status:", error);
    return NextResponse.json(
      { error: "Failed to get migration status" },
      { status: 500 }
    );
  }
}
