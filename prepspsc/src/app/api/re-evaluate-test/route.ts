import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { evaluateMCQBatch, evaluateConventional } from "@/lib/gemini";
import type { QuestionOption } from "@/types/database.types";

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
 */
function extractStoragePath(signedUrl: string): { bucket: string; path: string } | null {
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

  // Fallback: fetch from the signed URL
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch answer file (${response.status} ${response.statusText}). The signed URL may have expired.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = response.headers.get("content-type") || "image/jpeg";

  if (arrayBuffer.byteLength < 100) {
    throw new Error("Fetched file is too small or empty");
  }

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
    const { attemptId, forceReevaluate = false } = await request.json();

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

    // Fetch all user answers with questions
    const { data: userAnswers, error: answersError } = await supabase
      .from("user_answers")
      .select("*, question:questions(*)")
      .eq("attempt_id", attemptId);

    if (answersError || !userAnswers) {
      return NextResponse.json(
        { error: "Failed to fetch answers" },
        { status: 500 }
      );
    }

    let totalScore = 0;
    const evaluationResults = [];

    // Separate MCQ and conventional answers for different processing
    const mcqAnswers = userAnswers.filter((a) => a.question?.type === "mcq");
    const conventionalAnswers = userAnswers.filter((a) => a.question?.type === "conventional");

    // =========================================================================
    // PHASE 1: Process MCQ answers with BATCH API call (much more efficient)
    // =========================================================================

    // First, update all MCQ scores immediately (deterministic, no AI needed)
    for (const answer of mcqAnswers) {
      const question = answer.question;
      if (!question) continue;

      const isCorrect = answer.user_answer === question.correct_answer;
      let marksObtained = 0;

      if (answer.user_answer) {
        if (isCorrect) {
          marksObtained = question.marks;
        } else if (question.negative_marks > 0) {
          marksObtained = -question.negative_marks;
        }
      }

      totalScore += marksObtained;

      // Update marks in database (score is deterministic)
      await supabase
        .from("user_answers")
        .update({
          is_correct: isCorrect,
          marks_obtained: marksObtained,
        })
        .eq("id", answer.id);
    }

    // Now batch process AI explanations for MCQs that need them
    const mcqsNeedingExplanation = mcqAnswers.filter((a) => {
      if (!a.question) return false;
      const feedback = a.ai_feedback as { pendingAIReview?: boolean } | null;
      return forceReevaluate || !a.ai_feedback || feedback?.pendingAIReview === true;
    });

    if (mcqsNeedingExplanation.length > 0) {
      console.log(`Batch evaluating ${mcqsNeedingExplanation.length} MCQ explanations...`);

      // Larger batches (15) + parallel processing (2 at a time) for ~3x speedup
      const BATCH_SIZE = 15;
      const PARALLEL_BATCHES = 2;
      const batches: typeof mcqsNeedingExplanation[] = [];
      for (let i = 0; i < mcqsNeedingExplanation.length; i += BATCH_SIZE) {
        batches.push(mcqsNeedingExplanation.slice(i, i + BATCH_SIZE));
      }

      // Process batches in parallel groups
      for (let i = 0; i < batches.length; i += PARALLEL_BATCHES) {
        const parallelBatches = batches.slice(i, i + PARALLEL_BATCHES);
        console.log(`Processing ${parallelBatches.length} batches in parallel...`);

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
        for (const result of batchResults) {
          if (result.status === "fulfilled") {
            const { batch, feedbackMap } = result.value;
            for (const answer of batch) {
              const feedback = feedbackMap.get(answer.question.id);
              const isCorrect = answer.user_answer === answer.question.correct_answer;

              if (feedback) {
                await supabase
                  .from("user_answers")
                  .update({
                    ai_feedback: feedback,
                    grading_status: "completed",
                  })
                  .eq("id", answer.id);

                evaluationResults.push({
                  questionId: answer.question.id,
                  type: "mcq",
                  isCorrect,
                  marksObtained: answer.marks_obtained || 0,
                  feedback,
                });
              } else {
                const fallbackFeedback = {
                  isCorrect,
                  explanation: isCorrect
                    ? "Correct! Detailed explanation will be available soon."
                    : `The correct answer is ${answer.question.correct_answer?.toUpperCase() || 'as marked'}.`,
                  pendingAIReview: true,
                };
                await supabase
                  .from("user_answers")
                  .update({
                    ai_feedback: fallbackFeedback,
                    grading_status: "pending_review",
                  })
                  .eq("id", answer.id);

                evaluationResults.push({
                  questionId: answer.question.id,
                  type: "mcq",
                  isCorrect,
                  marksObtained: answer.marks_obtained || 0,
                  pendingAIReview: true,
                });
              }
            }
          } else {
            console.error("Batch MCQ evaluation failed:", result.reason);
            const batchIndex = batchResults.indexOf(result);
            const failedBatch = parallelBatches[batchIndex];
            if (failedBatch) {
              for (const answer of failedBatch) {
                const isCorrect = answer.user_answer === answer.question.correct_answer;
                const fallbackFeedback = {
                  isCorrect,
                  explanation: isCorrect
                    ? "Correct! AI explanation temporarily unavailable."
                    : `The correct answer is ${answer.question.correct_answer?.toUpperCase() || 'as marked'}.`,
                  pendingAIReview: true,
                };
                await supabase
                  .from("user_answers")
                  .update({
                    ai_feedback: fallbackFeedback,
                    grading_status: "pending_review",
                  })
                  .eq("id", answer.id);

                evaluationResults.push({
                  questionId: answer.question.id,
                  type: "mcq",
                  isCorrect,
                  marksObtained: answer.marks_obtained || 0,
                  pendingAIReview: true,
                });
              }
            }
          }
        }

        // Small delay between parallel groups to avoid rate limiting
        if (i + PARALLEL_BATCHES < batches.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
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
    // PHASE 2: Process conventional answers (these still need individual calls)
    // =========================================================================
    for (const answer of conventionalAnswers) {
      const question = answer.question;

      if (!question) continue;

      try {
        // Re-evaluate conventional answer
        if (answer.answer_file_url && (forceReevaluate || !answer.ai_feedback || answer.marks_obtained === 0)) {
          try {
            console.log(`Re-evaluating conventional question ${question.id}...`);

            // Download file using service_role client (handles expired signed URLs)
            const { base64, mimeType } = await downloadAnswerFile(
              supabase,
              answer.answer_file_url
            );

            const feedback = await evaluateConventional(
              base64,
              mimeType,
              question.content,
              question.word_limit,
              question.marks
            );

            totalScore += feedback.score;

            // Update user answer with AI feedback
            await supabase
              .from("user_answers")
              .update({
                is_correct: null,
                marks_obtained: feedback.score,
                ai_feedback: feedback,
                grading_status: "completed",
              })
              .eq("id", answer.id);

            evaluationResults.push({
              questionId: question.id,
              type: "conventional",
              marksObtained: feedback.score,
              feedback,
            });
          } catch (evalError) {
            const err = evalError as Error;
            const errorMsg = err?.message || "Unknown error";
            console.error(
              `Failed to evaluate question ${question.id}:`,
              errorMsg,
              evalError
            );

            let userMessage = "Please ensure the uploaded image is clear and readable.";
            let errorCategory = "unknown";

            if (errorMsg.includes("API key") || errorMsg.includes("API_KEY") || errorMsg.includes("INVALID_API_KEY") || errorMsg.includes("invalid key")) {
              userMessage = "AI service configuration error. Please contact support.";
              errorCategory = "api_key";
              console.error("CRITICAL: Gemini API key error in production:", errorMsg);
            } else if (errorMsg.includes("expired") || errorMsg.includes("Failed to fetch")) {
              userMessage = "The uploaded file could not be accessed. Please re-upload your answer and try again.";
              errorCategory = "file_access";
            } else if (errorMsg.includes("quota") || errorMsg.includes("rate") || errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("Too Many Requests")) {
              userMessage = "AI evaluation is temporarily unavailable due to high demand. Please try again in a few minutes.";
              errorCategory = "rate_limit";
            } else if (errorMsg.includes("SAFETY") || errorMsg.includes("blocked") || errorMsg.includes("HARM")) {
              userMessage = "The image could not be processed. Please ensure it contains only your handwritten answer.";
              errorCategory = "safety";
            } else if (errorMsg.includes("not found") || errorMsg.includes("404")) {
              userMessage = "AI model not available. Please try again later.";
              errorCategory = "model_not_found";
            } else if (errorMsg.includes("timeout") || errorMsg.includes("DEADLINE_EXCEEDED") || errorMsg.includes("timed out")) {
              userMessage = "AI evaluation timed out. Please try again.";
              errorCategory = "timeout";
            } else if (errorMsg.includes("JSON") || errorMsg.includes("parse") || errorMsg.includes("Unexpected token")) {
              userMessage = "AI returned an invalid response. Please try again.";
              errorCategory = "parse_error";
            } else {
              console.error("UNKNOWN ERROR TYPE - Please add handling for:", errorMsg);
              errorCategory = "unknown";
            }

            // Mark as failed
            await supabase
              .from("user_answers")
              .update({
                grading_status: "failed",
                ai_feedback: {
                  error: "Failed to evaluate answer",
                  message: userMessage,
                  errorCategory,
                  debugInfo: errorMsg.substring(0, 300),
                },
              })
              .eq("id", answer.id);

            evaluationResults.push({
              questionId: question.id,
              type: "conventional",
              error: "Evaluation failed",
              reason: errorMsg.substring(0, 100),
            });
          }
        } else if (!answer.answer_file_url) {
          // No file uploaded
          await supabase
            .from("user_answers")
            .update({
              marks_obtained: 0,
              grading_status: "completed",
              ai_feedback: {
                score: 0,
                feedback: "No answer submitted.",
                strengths: [],
                improvements: ["Submit an answer to receive feedback"],
              },
            })
            .eq("id", answer.id);

          evaluationResults.push({
            questionId: question.id,
            type: "conventional",
            marksObtained: 0,
            feedback: { message: "No answer submitted" },
          });
        } else {
          // Use existing evaluation
          totalScore += answer.marks_obtained || 0;
          evaluationResults.push({
            questionId: question.id,
            type: "conventional",
            marksObtained: answer.marks_obtained || 0,
            feedback: answer.ai_feedback,
          });
        }
      } catch (error) {
        console.error(`Error processing question ${question.id}:`, error);
      }
    }

    // Update test attempt with final score
    // Round to integer since database column is INTEGER type
    const finalScore = Math.round(Math.max(0, totalScore));
    console.log(`Updating attempt ${attemptId} with score: ${finalScore} (raw: ${totalScore})`);
    const { error: updateError } = await supabase
      .from("test_attempts")
      .update({
        score: finalScore,
        status: "completed",
      })
      .eq("id", attemptId);

    if (updateError) {
      console.error("Failed to update attempt score:", updateError);
    }

    return NextResponse.json({
      success: true,
      attemptId,
      totalScore: finalScore,
      results: evaluationResults,
    });
  } catch (error) {
    console.error("Re-evaluation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
