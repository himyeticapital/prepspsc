import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateExplanation } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  // Initialize client inside handler to avoid build-time errors
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { questionId } = await request.json();

    if (!questionId) {
      return NextResponse.json(
        { error: "Question ID is required" },
        { status: 400 }
      );
    }

    // Fetch the question
    const { data: question, error: questionError } = await supabase
      .from("questions")
      .select("*")
      .eq("id", questionId)
      .single();

    if (questionError || !question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // Generate explanation
    const explanation = await generateExplanation(
      question.content,
      question.type as "mcq" | "conventional",
      question.options as { id: string; text: string }[] | undefined,
      question.correct_answer || undefined
    );

    // Update the question with the generated explanation
    const { error: updateError } = await supabase
      .from("questions")
      .update({ explanation })
      .eq("id", questionId);

    if (updateError) {
      console.error("Failed to update question with explanation:", updateError);
      return NextResponse.json(
        { error: "Failed to save explanation" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      questionId,
      explanation,
    });
  } catch (error) {
    console.error("Generate explanation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Batch generate explanations for multiple questions
export async function PUT(request: NextRequest) {
  // Initialize client inside handler to avoid build-time errors
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { questionIds } = await request.json();

    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return NextResponse.json(
        { error: "Question IDs array is required" },
        { status: 400 }
      );
    }

    // Fetch all questions
    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("*")
      .in("id", questionIds);

    if (questionsError || !questions) {
      return NextResponse.json(
        { error: "Failed to fetch questions" },
        { status: 500 }
      );
    }

    const results = [];

    // Generate explanations for each question
    for (const question of questions) {
      try {
        const explanation = await generateExplanation(
          question.content,
          question.type as "mcq" | "conventional",
          question.options as { id: string; text: string }[] | undefined,
          question.correct_answer || undefined
        );

        // Update the question
        await supabase
          .from("questions")
          .update({ explanation })
          .eq("id", question.id);

        results.push({
          questionId: question.id,
          success: true,
          explanation,
        });
      } catch (error) {
        console.error(`Failed to generate explanation for question ${question.id}:`, error);
        results.push({
          questionId: question.id,
          success: false,
          error: "Generation failed",
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      totalProcessed: questions.length,
      successCount: results.filter((r) => r.success).length,
    });
  } catch (error) {
    console.error("Batch generate explanation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
