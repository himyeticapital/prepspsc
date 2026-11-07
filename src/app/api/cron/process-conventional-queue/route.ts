import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { evaluateConventional } from "@/lib/gemini";

// Create Supabase admin client
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key);
}

/**
 * Download a file from Supabase Storage
 */
async function downloadAnswerFile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  fileUrl: string
): Promise<{ base64: string; mimeType: string }> {
  // Extract storage path from signed URL
  const extractStoragePath = (signedUrl: string): { bucket: string; path: string } | null => {
    try {
      const url = new URL(signedUrl);
      const match = url.pathname.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)/);
      if (match) {
        return { bucket: match[1], path: match[2] };
      }
      return null;
    } catch {
      return null;
    }
  };

  const storagePath = extractStoragePath(fileUrl);

  if (storagePath) {
    const { data, error } = await supabase.storage
      .from(storagePath.bucket)
      .download(storagePath.path);

    if (!error && data) {
      const arrayBuffer = await data.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const mimeType = data.type || "image/jpeg";

      if (arrayBuffer.byteLength < 100) {
        throw new Error("Downloaded file is too small or empty");
      }

      return { base64, mimeType };
    }
  }

  // Fallback: fetch from URL directly
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = response.headers.get("content-type") || "image/jpeg";

  if (arrayBuffer.byteLength < 100) {
    throw new Error("Fetched file is too small or empty");
  }

  return { base64, mimeType };
}

/**
 * Cron job to process conventional question evaluation queue.
 *
 * This should be called every minute by Vercel cron.
 * Processes one task at a time since conventional evaluation is complex.
 *
 * Security: Protected by CRON_SECRET environment variable
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  const isAuthorized =
    authHeader === `Bearer ${cronSecret}` ||
    request.headers.get("host")?.includes("localhost");

  if (!isAuthorized && cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  try {
    // Fetch the next pending task (highest priority, oldest first)
    const { data: task, error: fetchError } = await supabase
      .from("ai_evaluation_tasks")
      .select("*")
      .eq("status", "pending")
      .eq("task_type", "conventional")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (fetchError || !task) {
      // No tasks in queue
      return NextResponse.json({
        processed: 0,
        message: "Queue empty",
      });
    }

    console.log(`Processing conventional task ${task.id} for answer ${task.answer_id}...`);

    // Mark as processing
    await supabase
      .from("ai_evaluation_tasks")
      .update({
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id);

    try {
      // Fetch the answer with question details
      const { data: answer, error: answerError } = await supabase
        .from("user_answers")
        .select("*, question:questions(*)")
        .eq("id", task.answer_id)
        .single();

      if (answerError || !answer || !answer.question) {
        throw new Error("Answer or question not found");
      }

      const question = answer.question;

      // Check if answer has a file
      if (!answer.answer_file_url) {
        // No file uploaded - mark as completed with zero score
        await supabase.from("user_answers").update({
          marks_obtained: 0,
          grading_status: "completed",
          ai_feedback: {
            score: 0,
            feedback: "No answer submitted.",
            strengths: [],
            improvements: ["Submit an answer to receive feedback"],
          },
        }).eq("id", answer.id);

        await supabase.from("ai_evaluation_tasks").update({
          status: "completed",
          processed_at: new Date().toISOString(),
        }).eq("id", task.id);

        return NextResponse.json({
          processed: 1,
          message: "No answer file - marked as zero",
        });
      }

      // Download the answer file
      const { base64, mimeType } = await downloadAnswerFile(supabase, answer.answer_file_url);

      // Evaluate using Gemini
      const feedback = await evaluateConventional(
        base64,
        mimeType,
        question.content,
        question.word_limit,
        question.marks
      );

      // Update user answer with feedback and marks
      await supabase.from("user_answers").update({
        ai_feedback: feedback,
        marks_obtained: feedback.score,
        grading_status: "completed",
      }).eq("id", answer.id);

      // Update attempt score (add this answer's marks)
      const { data: attemptAnswers } = await supabase
        .from("user_answers")
        .select("marks_obtained")
        .eq("attempt_id", task.attempt_id);

      if (attemptAnswers) {
        const totalScore = attemptAnswers.reduce((sum, a) => sum + (a.marks_obtained || 0), 0);

        await supabase.from("test_attempts").update({
          score: Math.round(totalScore),
        }).eq("id", task.attempt_id);
      }

      // Mark task as completed
      await supabase.from("ai_evaluation_tasks").update({
        status: "completed",
        processed_at: new Date().toISOString(),
      }).eq("id", task.id);

      console.log(`Conventional task ${task.id} completed: score ${feedback.score}/${question.marks}`);

      return NextResponse.json({
        processed: 1,
        success: true,
        answerId: answer.id,
        score: feedback.score,
      });

    } catch (error) {
      const errorMessage = (error as Error).message || "Unknown error";
      console.error(`Task ${task.id} failed:`, errorMessage);

      // Increment retry count
      const newRetryCount = task.retry_count + 1;
      const shouldRetry = newRetryCount < task.max_retries;

      await supabase.from("ai_evaluation_tasks").update({
        status: shouldRetry ? "pending" : "failed",
        retry_count: newRetryCount,
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      }).eq("id", task.id);

      // If failed permanently, update the answer
      if (!shouldRetry) {
        await supabase.from("user_answers").update({
          grading_status: "failed",
          ai_feedback: {
            error: "Evaluation failed after multiple attempts",
            message: "AI evaluation is temporarily unavailable. Please contact support.",
            errorCategory: "max_retries",
          },
        }).eq("id", task.answer_id);
      }

      return NextResponse.json({
        error: errorMessage,
        retrying: shouldRetry,
        retryCount: newRetryCount,
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Queue processor error:", error);
    return NextResponse.json(
      { error: "Queue processing failed" },
      { status: 500 }
    );
  }
}

/**
 * Get queue status
 */
export async function POST(request: NextRequest) {
  try {
    const { attemptId } = await request.json();

    if (!attemptId) {
      return NextResponse.json(
        { error: "Attempt ID required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Get tasks for this attempt
    const { data: tasks } = await supabase
      .from("ai_evaluation_tasks")
      .select("id, status, question_id")
      .eq("attempt_id", attemptId);

    const pending = tasks?.filter(t => t.status === "pending").length || 0;
    const processing = tasks?.filter(t => t.status === "processing").length || 0;
    const completed = tasks?.filter(t => t.status === "completed").length || 0;
    const failed = tasks?.filter(t => t.status === "failed").length || 0;

    return NextResponse.json({
      attemptId,
      pending,
      processing,
      completed,
      failed,
      total: tasks?.length || 0,
      allComplete: pending === 0 && processing === 0,
    });
  } catch (error) {
    console.error("Queue status error:", error);
    return NextResponse.json(
      { error: "Failed to get queue status" },
      { status: 500 }
    );
  }
}
