import { AI_MODELS } from "@/lib/ai-models";
import { hasProAccess } from "@/lib/access";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  buildSocraticTutoringPrompt,
  formatConversationHistory,
} from "@/lib/guided-learning/prompts";
import type {
  GuidedLearningChatRequest,
  GuidedLearningChatResponse,
  GuidedMessage,
  SessionState,
  GeminiTutorResponse,
  GuidedLearningSessionRow,
  GuidedLearningMessageRow,
} from "@/lib/guided-learning/types";

export const dynamic = "force-dynamic";

// Rate limits
const FREE_SESSIONS_PER_DAY = 3;

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_NOT_CONFIGURED");
  }
  return new GoogleGenerativeAI(apiKey);
}

// Clean JSON response from Gemini
function cleanJsonResponse(text: string): string {
  return text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
}

// Parse Gemini response with fallback
function parseGeminiResponse(text: string): GeminiTutorResponse {
  const cleaned = cleanJsonResponse(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to extract JSON object if parsing fails
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // Return a fallback response
        return {
          content: cleaned,
          messageType: "message",
          conceptProgress: {
            currentConcept: "",
            assessedUnderstanding: "partial",
            suggestCheckpoint: false,
          },
          sessionSuggestion: "continue",
        };
      }
    }

    // Return fallback with raw content
    return {
      content: text,
      messageType: "message",
      conceptProgress: {
        currentConcept: "",
        assessedUnderstanding: "partial",
        suggestCheckpoint: false,
      },
      sessionSuggestion: "continue",
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: GuidedLearningChatRequest = await request.json();
    const { sessionId, goalId, plannerContext, message, checkpointResponse } = body;

    // Validate request
    if (!message && !checkpointResponse) {
      return NextResponse.json(
        { error: "Message or checkpoint response is required" },
        { status: 400 }
      );
    }

    // Get user profile to check pro status and rate limits
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro_member, guided_sessions_today, guided_sessions_last_date")
      .eq("id", user.id)
      .single();

    const isPro = hasProAccess(profile);
    const today = new Date().toISOString().split("T")[0];

    // Check rate limits for free users
    if (!isPro && !sessionId) {
      // Only check when starting a new session
      const sessionsToday = profile?.guided_sessions_last_date === today
        ? (profile?.guided_sessions_today || 0)
        : 0;

      if (sessionsToday >= FREE_SESSIONS_PER_DAY) {
        return NextResponse.json(
          {
            error: "Daily limit reached",
            message: `Free users can start ${FREE_SESSIONS_PER_DAY} guided learning sessions per day. Upgrade to Pro for unlimited sessions.`,
          },
          { status: 429 }
        );
      }
    }

    let session: GuidedLearningSessionRow;
    let messages: GuidedLearningMessageRow[] = [];
    let isNewSession = false;

    if (sessionId) {
      // Resume existing session
      const { data: existingSession, error: sessionError } = await supabase
        .from("guided_learning_sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .single();

      if (sessionError || !existingSession) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      if (existingSession.status !== "active") {
        return NextResponse.json(
          { error: "Session is not active" },
          { status: 400 }
        );
      }

      session = existingSession as GuidedLearningSessionRow;

      // Load existing messages
      const { data: existingMessages } = await supabase
        .from("guided_learning_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      messages = (existingMessages || []) as GuidedLearningMessageRow[];
    } else {
      // Create new session
      isNewSession = true;

      // Validate we have context
      if (!goalId && !plannerContext) {
        return NextResponse.json(
          { error: "goalId or plannerContext is required for new session" },
          { status: 400 }
        );
      }

      // Get goal details if goalId provided
      let subject = plannerContext?.subject || "";
      let topics = plannerContext?.topics || [];
      let examType = plannerContext?.examType || "upsc";

      if (goalId) {
        const { data: goal } = await supabase
          .from("study_ai_goals")
          .select("goal_text")
          .eq("id", goalId)
          .eq("user_id", user.id)
          .single();

        if (goal) {
          // Extract subject/topics from goal text
          subject = "General Studies";
          topics = [goal.goal_text];
        }
      }

      // Create session
      const { data: newSession, error: createError } = await supabase
        .from("guided_learning_sessions")
        .insert({
          user_id: user.id,
          goal_id: goalId || null,
          planner_plan_id: plannerContext?.planId || null,
          subject,
          topics,
          exam_type: examType,
          status: "active",
          concepts_mastered: [],
          concepts_struggling: [],
          total_exchanges: 0,
          checkpoints_passed: 0,
          checkpoints_total: 0,
        })
        .select()
        .single();

      if (createError || !newSession) {
        console.error("Error creating session:", createError);
        return NextResponse.json(
          { error: "Failed to create session" },
          { status: 500 }
        );
      }

      session = newSession as GuidedLearningSessionRow;

      // Update rate limit counters for free users
      if (!isPro) {
        const newCount = profile?.guided_sessions_last_date === today
          ? (profile?.guided_sessions_today || 0) + 1
          : 1;

        await supabase
          .from("profiles")
          .update({
            guided_sessions_today: newCount,
            guided_sessions_last_date: today,
          })
          .eq("id", user.id);
      }
    }

    // Handle checkpoint response if provided
    if (checkpointResponse) {
      const { messageId, selectedAnswer } = checkpointResponse;

      // Find the checkpoint message
      const checkpointMessage = messages.find(
        (m) => m.id === messageId && m.message_type === "checkpoint"
      );

      if (checkpointMessage && checkpointMessage.checkpoint_data) {
        const isCorrect =
          selectedAnswer === checkpointMessage.checkpoint_data.correctAnswer;

        // Update the message with student's response
        await supabase
          .from("guided_learning_messages")
          .update({
            student_checkpoint_response: selectedAnswer,
            checkpoint_correct: isCorrect,
          })
          .eq("id", messageId);

        // Update session checkpoint stats
        const newCheckpointsPassed = isCorrect
          ? (session.checkpoints_passed || 0) + 1
          : session.checkpoints_passed || 0;

        await supabase
          .from("guided_learning_sessions")
          .update({
            checkpoints_passed: newCheckpointsPassed,
            checkpoints_total: (session.checkpoints_total || 0) + 1,
          })
          .eq("id", session.id);

        session.checkpoints_passed = newCheckpointsPassed;
        session.checkpoints_total = (session.checkpoints_total || 0) + 1;
      }
    }

    // Store student message
    const { data: studentMessage } = await supabase
      .from("guided_learning_messages")
      .insert({
        session_id: session.id,
        role: "student",
        content: message,
        message_type: "message",
      })
      .select()
      .single();

    if (studentMessage) {
      messages.push(studentMessage as GuidedLearningMessageRow);
    }

    // Build conversation history for prompt
    const conversationHistory = formatConversationHistory(
      messages.map((m) => ({ role: m.role, content: m.content }))
    );

    // Build Socratic tutoring prompt
    const prompt = buildSocraticTutoringPrompt({
      subject: session.subject || "General Studies",
      topics: session.topics || [],
      examType: session.exam_type || "upsc",
      conversationHistory,
      conceptsMastered: session.concepts_mastered || [],
      conceptsStruggling: session.concepts_struggling || [],
      totalExchanges: session.total_exchanges || 0,
      checkpointsPassed: session.checkpoints_passed || 0,
      studentMessage: message,
    });

    // Call Gemini
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: AI_MODELS.basic });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse response
    const tutorResponse = parseGeminiResponse(responseText);

    // Store tutor message
    const { data: tutorMessage } = await supabase
      .from("guided_learning_messages")
      .insert({
        session_id: session.id,
        role: "tutor",
        content: tutorResponse.content,
        message_type: tutorResponse.messageType,
        checkpoint_data: tutorResponse.checkpoint || null,
        media_data: tutorResponse.media || null,
      })
      .select()
      .single();

    // Update session state
    const newConceptsMastered = [...(session.concepts_mastered || [])];
    const newConceptsStruggling = [...(session.concepts_struggling || [])];

    if (tutorResponse.conceptProgress) {
      const { currentConcept, assessedUnderstanding } = tutorResponse.conceptProgress;

      if (currentConcept) {
        if (assessedUnderstanding === "strong") {
          if (!newConceptsMastered.includes(currentConcept)) {
            newConceptsMastered.push(currentConcept);
          }
          // Remove from struggling if it was there
          const struggleIndex = newConceptsStruggling.indexOf(currentConcept);
          if (struggleIndex > -1) {
            newConceptsStruggling.splice(struggleIndex, 1);
          }
        } else if (assessedUnderstanding === "weak") {
          if (!newConceptsStruggling.includes(currentConcept)) {
            newConceptsStruggling.push(currentConcept);
          }
        }
      }
    }

    // Calculate understanding score
    const totalCheckpoints = (session.checkpoints_total || 0) + (tutorResponse.checkpoint ? 1 : 0);
    const understandingScore = totalCheckpoints > 0
      ? Math.round((session.checkpoints_passed / totalCheckpoints) * 100)
      : null;

    // Check if session should be completed
    const shouldComplete =
      tutorResponse.sessionSuggestion === "consider_ending" ||
      (session.total_exchanges || 0) >= 20;

    const newStatus = shouldComplete ? "completed" : "active";

    // Update session
    await supabase
      .from("guided_learning_sessions")
      .update({
        current_concept: tutorResponse.conceptProgress?.currentConcept || session.current_concept,
        concepts_mastered: newConceptsMastered,
        concepts_struggling: newConceptsStruggling,
        total_exchanges: (session.total_exchanges || 0) + 1,
        understanding_score: understandingScore,
        status: newStatus,
        completed_at: shouldComplete ? new Date().toISOString() : null,
      })
      .eq("id", session.id);

    // Build response
    const newMessages: GuidedMessage[] = [];

    if (studentMessage) {
      newMessages.push({
        id: studentMessage.id,
        role: "student",
        content: message,
        messageType: "message",
        createdAt: studentMessage.created_at,
      });
    }

    if (tutorMessage) {
      newMessages.push({
        id: tutorMessage.id,
        role: "tutor",
        content: tutorResponse.content,
        messageType: tutorResponse.messageType,
        checkpointData: tutorResponse.checkpoint,
        media: tutorResponse.media,
        createdAt: tutorMessage.created_at,
      });
    }

    const sessionState: SessionState = {
      status: newStatus,
      currentConcept: tutorResponse.conceptProgress?.currentConcept || null,
      conceptsMastered: newConceptsMastered,
      conceptsStruggling: newConceptsStruggling,
      understandingScore,
      checkpointsPassed: session.checkpoints_passed || 0,
      checkpointsTotal: totalCheckpoints,
      totalExchanges: (session.total_exchanges || 0) + 1,
    };

    const response: GuidedLearningChatResponse = {
      sessionId: session.id,
      messages: newMessages,
      sessionState,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Guided learning chat error:", error);

    // Log the full error details for debugging
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage === "GEMINI_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 503 }
      );
    }

    // Handle rate limit errors from Gemini
    if (errorMessage.includes("429") || errorMessage.includes("Too Many Requests") || errorMessage.includes("quota")) {
      return NextResponse.json(
        { error: "AI service is busy. Please wait a minute and try again." },
        { status: 429 }
      );
    }

    // Return more specific error message for debugging
    return NextResponse.json(
      { error: `Failed to process message: ${errorMessage}` },
      { status: 500 }
    );
  }
}
