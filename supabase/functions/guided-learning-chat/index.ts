// Supabase Edge Function for Guided Learning Chat
// Runs with longer timeout than Vercel Hobby (10s)
// Handles Socratic tutoring with Gemini AI - STREAMING ENABLED

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = Deno.env.get("GEMINI_BASIC_MODEL") ?? "gemini-3.1-flash-lite"; // cheap default (see src/lib/ai-models.ts)
const FREE_SESSIONS_PER_DAY = 3;
// Abuse guard for everyone, including Pro / free-for-all mode (resets daily, UTC)
const MAX_SESSIONS_PER_DAY = 30;

// Types
interface TutoringContext {
  subject: string;
  topics: string[];
  examType: string;
  conversationHistory: string;
  conceptsMastered: string[];
  conceptsStruggling: string[];
  totalExchanges: number;
  checkpointsPassed: number;
  studentMessage: string;
}

interface GeminiTutorResponse {
  content: string;
  messageType: string;
  checkpoint?: {
    question: string;
    options: { id: string; text: string }[];
    correctAnswer: string;
    explanation: string;
  };
  media?: {
    videos?: { title: string; searchQuery: string; reason: string }[];
    diagrams?: { title: string; searchQuery: string; type: string }[];
  };
  conceptProgress: {
    currentConcept: string;
    assessedUnderstanding: string;
    suggestCheckpoint: boolean;
  };
  sessionSuggestion: string;
}

// Format conversation history
function formatConversationHistory(
  messages: { role: string; content: string }[],
  maxMessages = 10
): string {
  const recentMessages = messages.slice(-maxMessages);
  if (recentMessages.length === 0) {
    return "This is the beginning of the session.";
  }
  return recentMessages
    .map((msg) => {
      const role = msg.role === "tutor" ? "🤖 Tutor" : "👤 Student";
      const content = msg.content.length > 500 ? msg.content.substring(0, 500) + "..." : msg.content;
      return `${role}: ${content}`;
    })
    .join("\n\n");
}

// Build Socratic tutoring prompt
function buildSocraticTutoringPrompt(context: TutoringContext): string {
  const examName = context.examType === "sikkim-psc" ? "Sikkim PSC" : "UPSC";
  const topicsList = context.topics.join(", ");

  return `You are a LearnLM-powered Socratic tutor helping a ${examName} aspirant deeply understand:
SUBJECT: ${context.subject}
TOPICS: ${topicsList}

═══════════════════════════════════════════════════════════════════════════════
                    LEARNLM LEARNING SCIENCE PRINCIPLES
═══════════════════════════════════════════════════════════════════════════════

You must implement these 5 evidence-based learning principles in EVERY response:

## PRINCIPLE 1: INSPIRE ACTIVE LEARNING 🧠
- **NEVER give direct answers** - This is your MOST important rule
- Create "productive struggle" - challenge that stretches but doesn't frustrate
- Use the Socratic method: Answer questions with better questions
- Allow students to make mistakes - mistakes are learning opportunities

## PRINCIPLE 2: MULTIMODAL PRESENTATION 📚🎬📊
Include media when helpful:
- YouTube videos from trusted channels (StudyIQ IAS, Drishti IAS, Khan Academy)
- Diagrams for complex concepts

## PRINCIPLE 3: DYNAMIC ADAPTATION 🎯
Adjust based on student's demonstrated understanding level.

## PRINCIPLE 4: MOTIVATIONAL ENGAGEMENT 🌟
Keep the student motivated with encouragement and curiosity sparks.

## PRINCIPLE 5: METACOGNITIVE REFLECTION 🔍
Help students think about their thinking.

═══════════════════════════════════════════════════════════════════════════════
                           RESPONSE FORMAT (JSON)
═══════════════════════════════════════════════════════════════════════════════

Return VALID JSON only:

{
  "content": "Your conversational message using markdown.",
  "messageType": "message" | "probing_question" | "checkpoint" | "hint" | "concept_summary" | "encouragement",
  "media": {
    "videos": [{ "title": "...", "searchQuery": "...", "reason": "..." }],
    "diagrams": [{ "title": "...", "searchQuery": "...", "type": "flowchart|map|structure|timeline|infographic" }]
  },
  "checkpoint": {
    "question": "...",
    "options": [{ "id": "a", "text": "..." }, ...],
    "correctAnswer": "a",
    "explanation": "..."
  },
  "conceptProgress": {
    "currentConcept": "...",
    "assessedUnderstanding": "strong" | "partial" | "weak",
    "suggestCheckpoint": true | false
  },
  "sessionSuggestion": "continue" | "ready_for_checkpoint" | "consider_ending"
}

═══════════════════════════════════════════════════════════════════════════════
                           CURRENT SESSION STATE
═══════════════════════════════════════════════════════════════════════════════

📊 **Session Progress:**
- Exchanges completed: ${context.totalExchanges}
- Checkpoints passed: ${context.checkpointsPassed}
- Concepts mastered: ${context.conceptsMastered.length > 0 ? context.conceptsMastered.join(", ") : "None yet"}
- Concepts struggling: ${context.conceptsStruggling.length > 0 ? context.conceptsStruggling.join(", ") : "None identified"}

📜 **Conversation History:**
${context.conversationHistory || "This is the beginning of the session."}

💬 **Student's Latest Message:**
"${context.studentMessage}"

Return JSON only:`;
}

// Parse Gemini response
function parseGeminiResponse(text: string): GeminiTutorResponse {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
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

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create authenticated client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the JWT and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { sessionId, goalId, plannerContext, message, checkpointResponse, stream = true } = body;

    if (!message && !checkpointResponse) {
      return new Response(
        JSON.stringify({ error: "Message or checkpoint response is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro_member, guided_sessions_today, guided_sessions_last_date")
      .eq("id", user.id)
      .single();

    // All features are free unless the ALL_FEATURES_FREE secret is set to "false" (see src/lib/access.ts)
    const allFeaturesFree = Deno.env.get("ALL_FEATURES_FREE") !== "false";
    const isPro = allFeaturesFree || profile?.is_pro_member || false;
    const today = new Date().toISOString().split("T")[0];

    // Daily cap on starting new sessions (low for free users, high abuse cap for everyone else)
    if (!sessionId) {
      const sessionsToday = profile?.guided_sessions_last_date === today
        ? (profile?.guided_sessions_today || 0)
        : 0;
      const sessionLimit = isPro ? MAX_SESSIONS_PER_DAY : FREE_SESSIONS_PER_DAY;

      if (sessionsToday >= sessionLimit) {
        return new Response(
          JSON.stringify({
            error: "Daily limit reached",
            message: isPro
              ? `Daily limit reached: you've started ${MAX_SESSIONS_PER_DAY} guided learning sessions today. Try again tomorrow.`
              : `Free users can start ${FREE_SESSIONS_PER_DAY} guided learning sessions per day. Upgrade to Pro for unlimited sessions.`,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let session: any;
    let messages: any[] = [];
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
        return new Response(
          JSON.stringify({ error: "Session not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (existingSession.status !== "active") {
        return new Response(
          JSON.stringify({ error: "Session is not active" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      session = existingSession;

      // Load existing messages
      const { data: existingMessages } = await supabase
        .from("guided_learning_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      messages = existingMessages || [];
    } else {
      // Create new session
      isNewSession = true;

      if (!goalId && !plannerContext) {
        return new Response(
          JSON.stringify({ error: "goalId or plannerContext is required for new session" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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
          subject = "General Studies";
          topics = [goal.goal_text];
        }
      }

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
        return new Response(
          JSON.stringify({ error: "Failed to create session" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      session = newSession;

      // Update daily session counter (every user, so the cap above works)
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

    // Handle checkpoint response
    if (checkpointResponse) {
      const { messageId, selectedAnswer } = checkpointResponse;
      const checkpointMessage = messages.find(
        (m: any) => m.id === messageId && m.message_type === "checkpoint"
      );

      if (checkpointMessage && checkpointMessage.checkpoint_data) {
        const isCorrect = selectedAnswer === checkpointMessage.checkpoint_data.correctAnswer;

        await supabase
          .from("guided_learning_messages")
          .update({
            student_checkpoint_response: selectedAnswer,
            checkpoint_correct: isCorrect,
          })
          .eq("id", messageId);

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
      messages.push(studentMessage);
    }

    // Build conversation history
    const conversationHistory = formatConversationHistory(
      messages.map((m: any) => ({ role: m.role, content: m.content }))
    );

    // Build prompt
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

    // Call Gemini with streaming
    console.log(`[guided-learning-chat] Calling Gemini model: ${GEMINI_MODEL} (streaming: ${stream})`);
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    if (stream) {
      // STREAMING MODE - Return text progressively
      const streamResult = await model.generateContentStream(prompt);

      // Create a TransformStream to process chunks
      const encoder = new TextEncoder();
      let fullText = "";

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // Send initial metadata
            const initData = JSON.stringify({
              type: "init",
              sessionId: session.id,
              studentMessage: studentMessage ? {
                id: studentMessage.id,
                role: "student",
                content: message,
                messageType: "message",
                createdAt: studentMessage.created_at,
              } : null,
            }) + "\n";
            controller.enqueue(encoder.encode(initData));

            // Stream text chunks
            for await (const chunk of streamResult.stream) {
              const chunkText = chunk.text();
              if (chunkText) {
                fullText += chunkText;
                const textChunk = JSON.stringify({
                  type: "text",
                  content: chunkText,
                }) + "\n";
                controller.enqueue(encoder.encode(textChunk));
              }
            }

            // Parse the complete response
            const tutorResponse = parseGeminiResponse(fullText);

            // Store tutor message in database
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

            // Send final metadata with parsed response
            const finalData = JSON.stringify({
              type: "done",
              tutorMessage: tutorMessage ? {
                id: tutorMessage.id,
                role: "tutor",
                content: tutorResponse.content,
                messageType: tutorResponse.messageType,
                checkpointData: tutorResponse.checkpoint,
                media: tutorResponse.media,
                createdAt: tutorMessage.created_at,
              } : null,
              sessionState: {
                status: newStatus,
                currentConcept: tutorResponse.conceptProgress?.currentConcept || null,
                conceptsMastered: newConceptsMastered,
                conceptsStruggling: newConceptsStruggling,
                understandingScore,
                checkpointsPassed: session.checkpoints_passed || 0,
                checkpointsTotal: totalCheckpoints,
                totalExchanges: (session.total_exchanges || 0) + 1,
              },
            }) + "\n";
            controller.enqueue(encoder.encode(finalData));

            controller.close();
          } catch (error) {
            console.error("[guided-learning-chat] Stream error:", error);
            const errorData = JSON.stringify({
              type: "error",
              error: error instanceof Error ? error.message : "Unknown error",
            }) + "\n";
            controller.enqueue(encoder.encode(errorData));
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    } else {
      // NON-STREAMING MODE - Original behavior
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
      const newMessages: any[] = [];

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

      const response = {
        sessionId: session.id,
        messages: newMessages,
        sessionState: {
          status: newStatus,
          currentConcept: tutorResponse.conceptProgress?.currentConcept || null,
          conceptsMastered: newConceptsMastered,
          conceptsStruggling: newConceptsStruggling,
          understandingScore,
          checkpointsPassed: session.checkpoints_passed || 0,
          checkpointsTotal: totalCheckpoints,
          totalExchanges: (session.total_exchanges || 0) + 1,
        },
      };

      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[guided-learning-chat] Error:", errorMessage);

    if (errorMessage.includes("429") || errorMessage.includes("quota")) {
      return new Response(
        JSON.stringify({ error: "AI service is busy. Please wait a minute and try again." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Failed to process message: ${errorMessage}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
