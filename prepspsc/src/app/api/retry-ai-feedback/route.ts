import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { evaluateMCQBatch } from "@/lib/gemini";
import type { QuestionOption } from "@/types/database.types";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
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
    const { answerId } = await request.json();

    if (!answerId) {
      return NextResponse.json({ error: "Answer ID required" }, { status: 400 });
    }

    console.log(`Retry AI feedback requested for answer ${answerId}`);

    // Fetch the answer with question
    const { data: answer, error } = await supabase
      .from("user_answers")
      .select("*, question:questions(*)")
      .eq("id", answerId)
      .single();

    if (error || !answer) {
      console.error("Answer not found:", error);
      return NextResponse.json({ error: "Answer not found" }, { status: 404 });
    }

    // Only retry if AI was unavailable
    const feedback = answer.ai_feedback as { aiUnavailable?: boolean } | null;
    if (!feedback?.aiUnavailable) {
      return NextResponse.json(
        { error: "AI feedback already available", alreadyAvailable: true },
        { status: 400 }
      );
    }

    // Retry AI evaluation
    const question = answer.question;
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    console.log(`Retrying AI evaluation for question ${question.id}...`);

    const batchInput = [{
      id: question.id,
      content: question.content,
      options: (question.options as QuestionOption[]) || [],
      userAnswer: answer.user_answer || "",
      correctAnswer: question.correct_answer || "",
    }];

    const feedbackMap = await evaluateMCQBatch(batchInput);
    const newFeedback = feedbackMap.get(question.id);

    if (newFeedback) {
      await supabase
        .from("user_answers")
        .update({
          ai_feedback: newFeedback,
          grading_status: "completed",
        })
        .eq("id", answerId);

      console.log(`Retry successful for question ${question.id}`);
      return NextResponse.json({ success: true, feedback: newFeedback });
    }

    console.log(`Retry failed - AI still unavailable for question ${question.id}`);
    return NextResponse.json(
      { error: "AI still unavailable. Please try again later." },
      { status: 503 }
    );
  } catch (error) {
    console.error("Retry AI feedback error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Check if it's a rate limit error
    if (errorMessage.includes("429") || errorMessage.includes("rate") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
      return NextResponse.json(
        { error: "Rate limited. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Retry failed. Please try again later." },
      { status: 500 }
    );
  }
}
