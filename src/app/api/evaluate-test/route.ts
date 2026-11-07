import { hasProAccess } from "@/lib/access";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { evaluateMCQBatch, evaluateConventional } from "@/lib/gemini";
import { calculateTestXP, getLevelFromXP } from "@/lib/xp";
import type { QuestionOption, MCQPregenExplanation, MCQFeedback } from "@/types/database.types";

// Create Supabase client lazily to ensure env vars are available
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(url, key);
}

/**
 * Extract the storage file path from a Supabase signed URL.
 * Format: https://<project>.supabase.co/storage/v1/object/sign/<bucket>/<path>?token=...
 */
function extractStoragePath(signedUrl: string): { bucket: string; path: string } | null {
  try {
    const url = new URL(signedUrl);
    // Match: /storage/v1/object/sign/<bucket>/<rest-of-path>
    const match = url.pathname.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)/);
    if (match) {
      return { bucket: match[1], path: match[2] };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Download a file from Supabase Storage using service_role client.
 * Falls back to direct URL fetch if path extraction fails.
 */
async function downloadAnswerFile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  fileUrl: string
): Promise<{ base64: string; mimeType: string }> {
  // Try to extract the storage path and download directly (avoids signed URL expiry issues)
  const storagePath = extractStoragePath(fileUrl);

  if (storagePath) {
    console.log(`Downloading file directly from storage: ${storagePath.bucket}/${storagePath.path}`);
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

      console.log(`File downloaded successfully. Size: ${arrayBuffer.byteLength} bytes, Type: ${mimeType}`);
      return { base64, mimeType };
    }

    console.warn(`Direct storage download failed: ${error?.message}. Falling back to URL fetch.`);
  }

  // Fallback: fetch from the signed URL directly
  console.log("Fetching file from signed URL:", fileUrl.substring(0, 80) + "...");
  const response = await fetch(fileUrl);

  if (!response.ok) {
    const statusText = `${response.status} ${response.statusText}`;
    console.error(`Failed to fetch file from signed URL: ${statusText}`);
    throw new Error(
      `Failed to fetch answer file (${statusText}). The signed URL may have expired.`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = response.headers.get("content-type") || "image/jpeg";

  if (arrayBuffer.byteLength < 100) {
    throw new Error("Fetched file is too small or empty");
  }

  console.log(`File fetched via URL. Size: ${arrayBuffer.byteLength} bytes, Type: ${mimeType}`);
  return { base64, mimeType };
}

export async function POST(request: NextRequest) {
  // Check for required environment variables early
  const geminiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!geminiKey) {
    console.error("GOOGLE_GEMINI_API_KEY is not set in environment variables");
    return NextResponse.json(
      { error: "AI service not configured. Please contact support." },
      { status: 500 }
    );
  }

  let supabase;
  try {
    supabase = getSupabase();
  } catch (error) {
    console.error("Failed to initialize Supabase:", error);
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  try {

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { attemptId, timeTakenSeconds, completedAt, mcqScore, userAnswers } = body;
    console.log("Evaluating attempt:", attemptId, { timeTakenSeconds, completedAt, mcqScore, hasUserAnswers: !!userAnswers });

    if (!attemptId) {
      return NextResponse.json(
        { error: "Attempt ID is required" },
        { status: 400 }
      );
    }

    // Fetch attempt with test info
    const { data: attempt, error: attemptError } = await supabase
      .from("test_attempts")
      .select("*, test:tests(*)")
      .eq("id", attemptId)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json(
        { error: "Attempt not found" },
        { status: 404 }
      );
    }

    // Immediately set completion data AND score if provided
    // This ensures the score is saved BEFORE any slow AI processing
    // The mcqScore from client is accurate - calculated client-side from correct answers
    const immediateUpdate: Record<string, unknown> = {
      status: "completed",
    };

    if (timeTakenSeconds && !attempt.time_taken_seconds) {
      immediateUpdate.time_taken_seconds = timeTakenSeconds;
    }
    if (completedAt && !attempt.completed_at) {
      immediateUpdate.completed_at = completedAt;
    }

    // Use client-calculated mcqScore immediately - this is the most important data
    // Don't wait for AI processing which can take 90+ seconds with retries
    if (mcqScore !== undefined && mcqScore !== null) {
      const maxMarks = attempt.test?.total_marks || 100;
      const cappedScore = Math.round(Math.min(Math.max(0, mcqScore), maxMarks));
      immediateUpdate.score = cappedScore;
      console.log(`Setting score immediately from client: ${cappedScore} (raw: ${mcqScore}, max: ${maxMarks})`);
    }

    if (Object.keys(immediateUpdate).length > 0) {
      console.log("Setting completion data immediately:", immediateUpdate);
      await supabase.from("test_attempts").update(immediateUpdate).eq("id", attemptId);
    }

    // Check if already completed with AI feedback - skip re-evaluation of AI explanations
    // But always allow score updates if needed
    const alreadyHasAIFeedback = attempt.status === "completed" && attempt.score !== null;
    if (alreadyHasAIFeedback) {
      console.log(`Attempt ${attemptId} already evaluated with score ${attempt.score}. Skipping AI processing.`);
      // Still return success with the existing score
      return NextResponse.json({
        success: true,
        attemptId,
        totalScore: attempt.score,
        message: "Already evaluated",
        skipped: true,
      });
    }

    // If userAnswers provided from client (client-side insert failed), insert them now
    if (userAnswers && Array.isArray(userAnswers) && userAnswers.length > 0) {
      console.log(`Inserting ${userAnswers.length} answers via API (client-side insert failed)`);
      // Delete any existing answers first
      await supabase.from("user_answers").delete().eq("attempt_id", attemptId);
      // Insert the answers
      const { error: insertError } = await supabase.from("user_answers").insert(userAnswers);
      if (insertError) {
        console.error("Failed to insert answers via API:", insertError);
        return NextResponse.json(
          { error: "Failed to save answers" },
          { status: 500 }
        );
      }
      console.log("Answers inserted successfully via API");
    }

    // Fetch all user answers with questions
    const { data: dbUserAnswers, error: answersError } = await supabase
      .from("user_answers")
      .select("*, question:questions(*)")
      .eq("attempt_id", attemptId);

    if (answersError || !dbUserAnswers) {
      return NextResponse.json(
        { error: "Failed to fetch answers" },
        { status: 500 }
      );
    }

    let totalScore = 0;
    const evaluationResults: Array<{
      questionId: number;
      type: string;
      isCorrect?: boolean;
      marksObtained?: number;
      feedback?: unknown;
      pendingAIReview?: boolean;
      aiUnavailable?: boolean;
      error?: string;
      reason?: string;
    }> = [];

    // Separate MCQ and conventional answers for different processing
    const mcqAnswers = dbUserAnswers.filter((a) => a.question?.type === "mcq");
    const conventionalAnswers = dbUserAnswers.filter((a) => a.question?.type === "conventional");

    // =========================================================================
    // PHASE 1: Process MCQ answers with BATCH API call (automatic, efficient)
    // =========================================================================

    // First, calculate all MCQ scores (deterministic)
    // ALWAYS recalculate marks server-side based on is_correct - don't trust client values
    // This fixes issues where question.marks might be 0/undefined on client side
    const marksUpdates: { id: number; marks: number }[] = [];

    for (const answer of mcqAnswers) {
      const questionMarks = answer.question?.marks || 2; // Default 2 marks per question
      const negativeMarking = attempt.test?.negative_marking ?? 0.5; // Default -0.5 for wrong

      // Always calculate marks server-side based on is_correct (authoritative source)
      let calculatedMarks: number;
      if (answer.is_correct === true) {
        calculatedMarks = questionMarks;
      } else if (answer.user_answer && answer.is_correct === false) {
        // Wrong answer - apply negative marking
        calculatedMarks = -negativeMarking;
      } else {
        // Skipped - no marks
        calculatedMarks = 0;
      }

      // Update database if stored value differs from calculated value
      if (answer.marks_obtained !== calculatedMarks) {
        marksUpdates.push({ id: answer.id, marks: calculatedMarks });
      }

      totalScore += calculatedMarks;
    }

    // Batch update marks in parallel (much faster than sequential)
    if (marksUpdates.length > 0) {
      const BATCH_SIZE = 25;
      for (let i = 0; i < marksUpdates.length; i += BATCH_SIZE) {
        const batch = marksUpdates.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(({ id, marks }) =>
            supabase.from("user_answers").update({ marks_obtained: marks }).eq("id", id)
          )
        );
      }
      console.log(`Updated marks for ${marksUpdates.length} answers in parallel batches`);
    }

    // Batch process AI explanations for MCQs that need them
    const mcqsNeedingExplanation = mcqAnswers.filter((a) => !a.ai_feedback && a.question);

    if (mcqsNeedingExplanation.length > 0) {
      console.log(`Processing ${mcqsNeedingExplanation.length} MCQ explanations...`);

      // =======================================================================
      // PHASE 1A: Use PREGENERATED explanations for MCQs that have them (INSTANT)
      // =======================================================================
      const mcqsWithPregen: typeof mcqsNeedingExplanation = [];
      const mcqsNeedingRealTimeAI: typeof mcqsNeedingExplanation = [];

      for (const answer of mcqsNeedingExplanation) {
        const pregenExplanation = answer.question.ai_explanation as MCQPregenExplanation | null;

        if (pregenExplanation?.explanation && pregenExplanation?.incorrectOptionsExplanation) {
          // Has pregenerated explanation - use it instantly!
          mcqsWithPregen.push(answer);
        } else {
          // No pregenerated explanation - needs real-time AI
          mcqsNeedingRealTimeAI.push(answer);
        }
      }

      console.log(`MCQs with pregenerated explanations: ${mcqsWithPregen.length}`);
      console.log(`MCQs needing real-time AI: ${mcqsNeedingRealTimeAI.length}`);

      // Process pregenerated MCQs instantly - build all updates first
      const pregenUpdates: { id: number; feedback: MCQFeedback; questionId: number; isCorrect: boolean | null; marksObtained: number }[] = [];

      for (const answer of mcqsWithPregen) {
        const pregen = answer.question.ai_explanation as MCQPregenExplanation;
        const isCorrect = answer.is_correct;

        // Build personalized feedback using pregenerated data
        const feedback: MCQFeedback = {
          isCorrect: isCorrect ?? false,
          explanation: pregen.explanation,
          incorrectOptionsExplanation: pregen.incorrectOptionsExplanation,
          // Add personalized "why YOUR answer was wrong" by looking up user's choice
          userChoiceExplanation: !isCorrect && answer.user_answer && pregen.incorrectOptionsExplanation
            ? pregen.incorrectOptionsExplanation[answer.user_answer]
            : undefined,
        };

        pregenUpdates.push({
          id: answer.id,
          feedback,
          questionId: answer.question.id,
          isCorrect: answer.is_correct,
          marksObtained: answer.marks_obtained || 0,
        });
      }

      // Batch update pregenerated feedback in parallel (much faster than sequential)
      const PREGEN_BATCH_SIZE = 25;
      for (let i = 0; i < pregenUpdates.length; i += PREGEN_BATCH_SIZE) {
        const batch = pregenUpdates.slice(i, i + PREGEN_BATCH_SIZE);
        await Promise.all(
          batch.map(({ id, feedback }) =>
            supabase.from("user_answers").update({
              ai_feedback: feedback,
              grading_status: "completed",
            }).eq("id", id)
          )
        );
      }

      // Add all results to evaluationResults
      for (const update of pregenUpdates) {
        evaluationResults.push({
          questionId: update.questionId,
          type: "mcq",
          isCorrect: update.isCorrect ?? undefined,
          marksObtained: update.marksObtained,
          feedback: update.feedback,
        });
      }

      console.log(`Processed ${mcqsWithPregen.length} MCQs instantly using pregenerated explanations (parallel batches)`);

      // =======================================================================
      // PHASE 1B: Process MCQs without pregenerated explanations (legacy/fallback)
      // =======================================================================
      if (mcqsNeedingRealTimeAI.length > 0) {
        console.log(`Processing ${mcqsNeedingRealTimeAI.length} MCQs with real-time AI...`);

        // FIRST: Save basic fallback feedback for ALL questions immediately
        // This ensures every question has at least basic feedback even if AI processing fails
        console.log("Saving initial fallback feedback for real-time AI questions...");
        for (const answer of mcqsNeedingRealTimeAI) {
          const storedExplanation = answer.question.explanation;
          const basicFeedback = {
            isCorrect: answer.is_correct,
            explanation: storedExplanation
              ? storedExplanation
              : answer.is_correct
                ? "Correct! Detailed AI analysis is being generated..."
                : `The correct answer is ${answer.question.correct_answer?.toUpperCase() || 'as marked'}. AI analysis is being generated...`,
            pendingAIReview: true,
          };
          await supabase
            .from("user_answers")
            .update({
              ai_feedback: basicFeedback,
              grading_status: "pending_review",
            })
            .eq("id", answer.id);
        }
        console.log("Initial fallback feedback saved for real-time AI questions");

        // Balanced settings - sequential processing to avoid rate limits
        // Batch size of 10 works reliably, process one at a time
        const BATCH_SIZE = 10; // Moderate batch size for reliability
        const PARALLEL_BATCHES = 1; // Sequential to avoid rate limit collisions
        const BATCH_DELAY_MS = 2000; // 2 second delay between batches
        const batches: typeof mcqsNeedingRealTimeAI[] = [];
        for (let i = 0; i < mcqsNeedingRealTimeAI.length; i += BATCH_SIZE) {
          batches.push(mcqsNeedingRealTimeAI.slice(i, i + BATCH_SIZE));
        }

        // Process batches in parallel groups
        for (let i = 0; i < batches.length; i += PARALLEL_BATCHES) {
          const parallelBatches = batches.slice(i, i + PARALLEL_BATCHES);
          console.log(`Processing ${parallelBatches.length} batches in parallel (${i + 1}-${Math.min(i + PARALLEL_BATCHES, batches.length)} of ${batches.length})...`);

          const batchResults = await Promise.allSettled(
            parallelBatches.map(async (batch) => {
              const batchInput = batch.map((a) => ({
                id: a.question.id,
                content: a.question.content,
                options: (a.question.options as QuestionOption[]) || [],
                userAnswer: a.user_answer || "",
                correctAnswer: a.question.correct_answer || "",
              }));

              const feedbackMap = await evaluateMCQBatch(batchInput);
              return { batch, feedbackMap };
            })
          );

          // Process results from parallel batches
          // Fallback feedback already saved - only update if AI feedback is available
          for (const result of batchResults) {
            if (result.status === "fulfilled") {
              const { batch, feedbackMap } = result.value;
              let successCount = 0;
              for (const answer of batch) {
                const feedback = feedbackMap.get(answer.question.id);

                if (feedback) {
                  // UPDATE with AI feedback (replaces the initial fallback)
                  await supabase
                    .from("user_answers")
                    .update({
                      ai_feedback: feedback,
                      grading_status: "completed",
                    })
                    .eq("id", answer.id);
                  successCount++;

                  evaluationResults.push({
                    questionId: answer.question.id,
                    type: "mcq",
                    isCorrect: answer.is_correct,
                    marksObtained: answer.marks_obtained || 0,
                    feedback,
                  });
                } else {
                  // No AI feedback for this question - fallback already saved
                  evaluationResults.push({
                    questionId: answer.question.id,
                    type: "mcq",
                    isCorrect: answer.is_correct,
                    marksObtained: answer.marks_obtained || 0,
                    pendingAIReview: true,
                  });
                }
              }
              console.log(`Batch completed: ${successCount}/${batch.length} questions got AI feedback`);
            } else {
              // Batch failed - UPDATE the feedback to indicate failure (not "being generated")
              console.error("Batch MCQ evaluation failed:", result.reason);
              const batchIndex = batchResults.indexOf(result);
              const failedBatch = parallelBatches[batchIndex];
              if (failedBatch) {
                console.log(`Updating ${failedBatch.length} questions with failure status...`);
                for (const answer of failedBatch) {
                  // Update feedback to indicate AI analysis is unavailable (not "being generated")
                  const storedExplanation = answer.question.explanation;
                  const failureFeedback = {
                    isCorrect: answer.is_correct,
                    explanation: storedExplanation
                      ? storedExplanation
                      : answer.is_correct
                        ? "Correct! AI analysis is temporarily unavailable due to high demand."
                        : `The correct answer is ${answer.question.correct_answer?.toUpperCase() || 'as marked'}. AI analysis is temporarily unavailable.`,
                    aiUnavailable: true,
                    pendingAIReview: false, // Not pending - it failed
                  };

                  await supabase
                    .from("user_answers")
                    .update({
                      ai_feedback: failureFeedback,
                      grading_status: "completed", // Mark as completed (with fallback)
                    })
                    .eq("id", answer.id);

                  evaluationResults.push({
                    questionId: answer.question.id,
                    type: "mcq",
                    isCorrect: answer.is_correct,
                    marksObtained: answer.marks_obtained || 0,
                    aiUnavailable: true,
                  });
                }
                console.log(`Updated ${failedBatch.length} questions with failure status`);
              }
            }
          }

          // Short delay between batch groups for stability
          if (i + PARALLEL_BATCHES < batches.length) {
            console.log(`Waiting ${BATCH_DELAY_MS}ms before next batch group...`);
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
          }
        }

        // =========================================================================
        // RECOVERY: Retry failed questions after a delay
        // =========================================================================
        const failedAnswers = mcqsNeedingRealTimeAI.filter(a => {
          const result = evaluationResults.find(r => r.questionId === a.question.id);
          return (result as { aiUnavailable?: boolean })?.aiUnavailable === true;
        });

        if (failedAnswers.length > 0) {
          console.log(`Recovery: ${failedAnswers.length} questions failed. Waiting 30s before retry...`);
          await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30s for rate limit to reset

          console.log("Recovery: Retrying failed questions...");
          const RETRY_BATCH_SIZE = 5; // Smaller batches for retry
          let recoveredCount = 0;

          for (let i = 0; i < failedAnswers.length; i += RETRY_BATCH_SIZE) {
            const retryBatch = failedAnswers.slice(i, i + RETRY_BATCH_SIZE);

            try {
              const batchInput = retryBatch.map((a) => ({
                id: a.question.id,
                content: a.question.content,
                options: (a.question.options as QuestionOption[]) || [],
                userAnswer: a.user_answer || "",
                correctAnswer: a.question.correct_answer || "",
              }));

              const feedbackMap = await evaluateMCQBatch(batchInput);

              for (const answer of retryBatch) {
                const feedback = feedbackMap.get(answer.question.id);
                if (feedback) {
                  await supabase
                    .from("user_answers")
                    .update({
                      ai_feedback: feedback,
                      grading_status: "completed",
                    })
                    .eq("id", answer.id);
                  recoveredCount++;
                  console.log(`Recovery: Question ${answer.question.id} recovered successfully`);

                  // Update the evaluation result
                  const resultIndex = evaluationResults.findIndex(r => r.questionId === answer.question.id);
                  if (resultIndex !== -1) {
                    evaluationResults[resultIndex] = {
                      questionId: answer.question.id,
                      type: "mcq",
                      isCorrect: answer.is_correct,
                      marksObtained: answer.marks_obtained || 0,
                      feedback,
                    };
                  }
                }
              }
            } catch (retryError) {
              console.log(`Recovery: Retry batch failed, remaining questions keep fallback`);
            }

            // Delay between retry batches
            if (i + RETRY_BATCH_SIZE < failedAnswers.length) {
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
          }

          console.log(`Recovery complete: ${recoveredCount}/${failedAnswers.length} questions recovered`);
        }
      } // End of mcqsNeedingRealTimeAI.length > 0 block
    }

    // Add results for MCQs that already had feedback
    for (const answer of mcqAnswers) {
      if (!evaluationResults.find((r) => r.questionId === answer.question?.id)) {
        evaluationResults.push({
          questionId: answer.question?.id,
          type: "mcq",
          isCorrect: answer.is_correct,
          marksObtained: answer.marks_obtained || 0,
          feedback: answer.ai_feedback,
        });
      }
    }

    // =========================================================================
    // PHASE 2: Enqueue conventional answers for background processing
    // =========================================================================
    // Conventional questions need personalized AI evaluation (analyzing handwritten answers)
    // These are processed asynchronously to avoid blocking and rate limiting issues
    let hasQueuedConventional = false;

    for (const answer of conventionalAnswers) {
      const question = answer.question;

      if (!question) continue;

      try {
        if (question.type === "conventional") {
          if (answer.answer_file_url) {
            // Has an uploaded file - enqueue for background processing
            console.log(`Enqueueing conventional answer ${answer.id} for background processing...`);

            // Save placeholder feedback immediately so results page knows evaluation is pending
            await supabase.from("user_answers").update({
              ai_feedback: {
                pendingAIReview: true,
                message: "Your answer is being evaluated by AI...",
              },
              grading_status: "queued",
            }).eq("id", answer.id);

            // Check if task already exists (avoid duplicates)
            const { data: existingTask } = await supabase
              .from("ai_evaluation_tasks")
              .select("id")
              .eq("answer_id", answer.id)
              .single();

            if (!existingTask) {
              // Enqueue for background processing
              await supabase.from("ai_evaluation_tasks").insert({
                attempt_id: attemptId,
                question_id: question.id,
                answer_id: answer.id,
                task_type: "conventional",
                status: "pending",
                priority: 3, // Higher priority than MCQ migration
              });
            }

            hasQueuedConventional = true;

            evaluationResults.push({
              questionId: question.id,
              type: "conventional",
              pendingAIReview: true,
            });
          } else {
            // No file uploaded - mark as completed with zero score immediately
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

            evaluationResults.push({
              questionId: question.id,
              type: "conventional",
              marksObtained: 0,
              feedback: { message: "No answer submitted" },
            });
          }
        }
      } catch (error) {
        console.error(`Error processing question ${question.id}:`, error);
      }
    }

    if (hasQueuedConventional) {
      console.log(`Conventional answers queued for background processing. Attempt ${attemptId} will be updated as evaluations complete.`);
    }

    // Update test attempt with final score
    // Cap score at total marks to prevent exceeding max
    // Round to integer since database column is INTEGER type
    const maxMarks = attempt.test.total_marks || 0;
    const rawCappedScore = maxMarks > 0 ? Math.min(Math.max(0, totalScore), maxMarks) : Math.max(0, totalScore);
    const cappedScore = Math.round(rawCappedScore);

    console.log(`Updating attempt ${attemptId} with score: ${cappedScore} (raw: ${totalScore}, max: ${maxMarks})`);

    // Build update payload - also set completed_at and time_taken_seconds if not already set
    // This serves as a fallback if the client-side update failed (e.g., RLS issues, session expiry)
    const updatePayload: Record<string, unknown> = {
      score: cappedScore,
      status: "completed",
    };

    // Set completed_at if not already set
    if (!attempt.completed_at) {
      updatePayload.completed_at = new Date().toISOString();
    }

    // Calculate time_taken_seconds if not already set
    if (!attempt.time_taken_seconds && attempt.started_at) {
      const startTime = new Date(attempt.started_at).getTime();
      const endTime = attempt.completed_at
        ? new Date(attempt.completed_at).getTime()
        : Date.now();
      const calculatedTime = Math.floor((endTime - startTime) / 1000);
      const maxTime = (attempt.test?.duration_minutes || 60) * 60;
      updatePayload.time_taken_seconds = Math.min(Math.max(calculatedTime, 1), maxTime);
    }

    const { error: updateError } = await supabase
      .from("test_attempts")
      .update(updatePayload)
      .eq("id", attemptId);

    if (updateError) {
      console.error("Failed to update attempt score:", updateError);
    }

    // Calculate section performance
    let sectionPerformance: Record<string, number> = {};
    try {
      // Fetch sections for this test
      const { data: sections } = await supabase
        .from("test_sections")
        .select("id, name")
        .eq("test_id", attempt.test_id);

      if (sections && sections.length > 0) {
        // Group answers by section and calculate performance
        const sectionStats: Record<number, { earned: number; total: number }> = {};

        for (const answer of dbUserAnswers) {
          const sectionId = answer.question?.section_id;
          if (sectionId) {
            if (!sectionStats[sectionId]) {
              sectionStats[sectionId] = { earned: 0, total: 0 };
            }
            sectionStats[sectionId].total += answer.question?.marks || 0;
            sectionStats[sectionId].earned += answer.marks_obtained || 0;
          }
        }

        // Convert to section name -> percentage map
        for (const section of sections) {
          const stats = sectionStats[section.id];
          if (stats && stats.total > 0) {
            sectionPerformance[section.name] = Math.round((stats.earned / stats.total) * 100);
          }
        }
      }
    } catch (sectionError) {
      console.error("Failed to calculate section performance:", sectionError);
    }

    // Update or create test analytics
    try {
      await updateTestAnalytics(supabase, attempt.user_id, attempt.test_id, cappedScore, attempt.test.total_marks || 0, sectionPerformance);
    } catch (analyticsError) {
      console.error("Failed to update analytics:", analyticsError);
      // Don't fail the request for analytics errors
    }

    // Award XP for test completion
    let xpAwarded = 0;
    try {
      // Get user's previous best score for this test (for improvement bonus)
      const { data: previousAttempts } = await supabase
        .from("test_attempts")
        .select("score")
        .eq("user_id", attempt.user_id)
        .eq("test_id", attempt.test_id)
        .eq("status", "completed")
        .neq("id", attemptId)
        .order("score", { ascending: false })
        .limit(1);

      const previousBestScore = previousAttempts?.[0]?.score ?? null;

      // Get user's Pro status and current XP
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_pro_member, xp_points")
        .eq("id", attempt.user_id)
        .single();

      const isPro = hasProAccess(profile);
      const currentXP = profile?.xp_points ?? 0;

      // Calculate XP
      const { finalXP, breakdown } = calculateTestXP(
        cappedScore,
        maxMarks,
        attempt.test.passing_marks || Math.round(maxMarks * 0.4),
        previousBestScore,
        isPro
      );

      if (finalXP > 0) {
        // Insert XP transaction
        await supabase.from("xp_transactions").insert({
          user_id: attempt.user_id,
          amount: finalXP,
          reason: "test_complete",
          multiplier: isPro ? 1.5 : 1,
          reference_id: attemptId.toString(),
        });

        // Update user profile with new XP and level
        const newXP = currentXP + finalXP;
        const newLevel = getLevelFromXP(newXP);

        await supabase
          .from("profiles")
          .update({
            xp_points: newXP,
            xp_level: newLevel,
          })
          .eq("id", attempt.user_id);

        xpAwarded = finalXP;
        console.log(`Awarded ${finalXP} XP to user ${attempt.user_id} for test completion`, breakdown);
      }
    } catch (xpError) {
      console.error("Failed to award XP:", xpError);
      // Don't fail the request for XP errors
    }

    return NextResponse.json({
      success: true,
      attemptId,
      totalScore: cappedScore,
      results: evaluationResults,
      xpAwarded,
      hasQueuedConventional, // True if conventional answers are being processed in background
    });
  } catch (error) {
    console.error("Evaluation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function updateTestAnalytics(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  testId: number,
  score: number,
  totalMarks: number,
  sectionPerformance: Record<string, number> = {}
) {
  const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;

  // Check if analytics record exists
  const { data: existing } = await supabase
    .from("test_analytics")
    .select("*")
    .eq("user_id", userId)
    .eq("test_id", testId)
    .single();

  if (existing) {
    // Update existing record
    const newTotalAttempts = existing.total_attempts + 1;
    const newBestScore = Math.max(existing.best_score, percentage);
    const newAverageScore =
      (existing.average_score * existing.total_attempts + percentage) /
      newTotalAttempts;

    const improvementTrend = [
      ...(Array.isArray(existing.improvement_trend) ? existing.improvement_trend : []),
      {
        attempt: newTotalAttempts,
        score: percentage,
        date: new Date().toISOString(),
      },
    ];

    // Merge section performance (new values override old)
    const existingSectionPerf = (existing.section_performance as Record<string, number>) || {};
    const mergedSectionPerformance = {
      ...existingSectionPerf,
      ...sectionPerformance,
    };

    await supabase
      .from("test_analytics")
      .update({
        total_attempts: newTotalAttempts,
        best_score: newBestScore,
        average_score: newAverageScore,
        last_attempt_at: new Date().toISOString(),
        improvement_trend: improvementTrend,
        section_performance: mergedSectionPerformance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    // Create new record
    await supabase.from("test_analytics").insert({
      user_id: userId,
      test_id: testId,
      total_attempts: 1,
      best_score: percentage,
      average_score: percentage,
      last_attempt_at: new Date().toISOString(),
      improvement_trend: [
        {
          attempt: 1,
          score: percentage,
          date: new Date().toISOString(),
        },
      ],
      strengths: [],
      weaknesses: [],
      section_performance: sectionPerformance,
    });
  }
}
