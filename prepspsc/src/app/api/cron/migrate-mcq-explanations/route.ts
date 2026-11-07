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
 * Cron job to migrate existing MCQ questions to have pregenerated AI explanations.
 *
 * This should be called periodically (e.g., every minute) by external cron service.
 * Processes a small batch (3 questions) per run to complete within 30-second timeout.
 *
 * Security: Protected by CRON_SECRET environment variable
 */
export async function GET(request: NextRequest) {
  // Verify cron secret for Vercel cron jobs
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Allow if: has correct cron secret OR request is from localhost (development)
  const isAuthorized =
    authHeader === `Bearer ${cronSecret}` ||
    request.headers.get("host")?.includes("localhost");

  if (!isAuthorized && cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  try {
    // Find MCQ questions without AI explanations (batch of 3 for 30s timeout)
    const { data: questions, error: fetchError } = await supabase
      .from("questions")
      .select("id, content, options, correct_answer, type")
      .eq("type", "mcq")
      .is("ai_explanation", null)
      .not("options", "is", null)
      .not("correct_answer", "is", null)
      .limit(3);

    if (fetchError) {
      console.error("Failed to fetch questions:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch questions" },
        { status: 500 }
      );
    }

    if (!questions || questions.length === 0) {
      return NextResponse.json({
        migrated: 0,
        message: "All MCQ questions have been migrated!",
        complete: true,
      });
    }

    console.log(`Migration: Processing ${questions.length} MCQ questions...`);

    let migratedCount = 0;
    const errors: Array<{ questionId: number; error: string }> = [];

    for (const question of questions) {
      try {
        // Generate explanation
        const explanation = await generateMCQExplanation({
          content: question.content,
          options: question.options as QuestionOption[],
          correctAnswer: question.correct_answer!,
        });

        // Save to question
        const { error: updateError } = await supabase
          .from("questions")
          .update({ ai_explanation: explanation })
          .eq("id", question.id);

        if (updateError) {
          console.error(`Failed to save explanation for question ${question.id}:`, updateError);
          errors.push({ questionId: question.id, error: updateError.message });
        } else {
          migratedCount++;
          console.log(`Migration: Question ${question.id} migrated successfully`);
        }

        // Delay between questions to avoid rate limits (1 second)
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        const errorMessage = (error as Error).message || "Unknown error";
        console.error(`Failed to migrate question ${question.id}:`, errorMessage);
        errors.push({ questionId: question.id, error: errorMessage });

        // If we hit a rate limit, stop processing this batch
        if (errorMessage.includes("429") || errorMessage.includes("rate") || errorMessage.includes("quota")) {
          console.log("Migration: Rate limit hit, stopping batch");
          break;
        }
      }
    }

    // Get remaining count
    const { count: remainingCount } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("type", "mcq")
      .is("ai_explanation", null);

    return NextResponse.json({
      migrated: migratedCount,
      attempted: questions.length,
      remaining: remainingCount || 0,
      errors: errors.length > 0 ? errors : undefined,
      complete: (remainingCount || 0) === 0,
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { error: "Migration failed" },
      { status: 500 }
    );
  }
}
