/**
 * Quiz Handler
 * Handles quiz generation and answers
 */

import { createClient } from "@supabase/supabase-js";
import type { BotConnection, BotResponse } from "@/lib/bot/types";
import * as personality from "@/lib/bot/personality";
import { generateQuizQuestion } from "@/lib/bot/ai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Store active quiz sessions (in production, use Redis or database)
const quizSessions = new Map<string, {
  questions: Array<{
    question: string;
    options: { id: string; text: string }[];
    correctAnswer: string;
    explanation: string;
  }>;
  currentIndex: number;
  correct: number;
  topic: string;
  startedAt: Date;
}>();

/**
 * Start a quiz on a specific topic
 */
export async function handleQuizTopic(
  connection: BotConnection,
  topic: string
): Promise<BotResponse> {
  try {
    // Handle "random" topic
    const actualTopic = topic === "random"
      ? ["polity", "history", "geography", "economics", "current affairs"][Math.floor(Math.random() * 5)]
      : topic;

    // Generate a quiz question using AI
    const question = await generateQuizQuestion(actualTopic);

    // Create quiz session
    const sessionKey = `${connection.user_id}_quiz`;
    quizSessions.set(sessionKey, {
      questions: [question],
      currentIndex: 0,
      correct: 0,
      topic: actualTopic,
      startedAt: new Date(),
    });

    return personality.quizQuestion(
      1,
      5, // Default 5 questions per quiz
      question.question,
      question.options
    );
  } catch (error) {
    console.error("Quiz topic handler error:", error);
    return {
      text: "Sorry, I couldn't generate a quiz right now. Please try again!",
      buttons: [
        { text: "🔄 Try Again", callbackData: `quiz_topic_${topic}` },
      ],
    };
  }
}

/**
 * Handle quiz answer
 */
export async function handleQuizAnswer(
  connection: BotConnection,
  answer: string
): Promise<BotResponse> {
  const sessionKey = `${connection.user_id}_quiz`;
  const session = quizSessions.get(sessionKey);

  if (!session) {
    return personality.noQuizTopic();
  }

  const currentQuestion = session.questions[session.currentIndex];
  const isCorrect = answer.toLowerCase() === currentQuestion.correctAnswer.toLowerCase();

  // Update session
  if (isCorrect) {
    session.correct++;
  }

  // Calculate XP (10 per correct answer, bonus for streaks)
  const xpEarned = isCorrect ? 10 : 0;

  // Award XP if correct
  if (isCorrect) {
    await awardXP(connection.user_id, xpEarned, "quiz_correct");
  }

  // Check if quiz is complete (after 5 questions)
  if (session.currentIndex >= 4) {
    // Quiz complete
    const totalCorrect = session.correct;
    const totalXP = totalCorrect * 10;

    // Clean up session
    quizSessions.delete(sessionKey);

    // Record quiz completion in database
    await recordQuizCompletion(connection.user_id, session.topic, totalCorrect, 5);

    return personality.quizComplete(totalCorrect, 5, totalXP);
  }

  // Generate next question
  try {
    const nextQuestion = await generateQuizQuestion(session.topic);
    session.questions.push(nextQuestion);
    session.currentIndex++;

    // Return feedback + next question
    const feedbackResponse = isCorrect
      ? personality.quizCorrect(currentQuestion.explanation, xpEarned)
      : personality.quizIncorrect(
          currentQuestion.correctAnswer,
          currentQuestion.explanation
        );

    const nextQuestionResponse = personality.quizQuestion(
      session.currentIndex + 1,
      5,
      nextQuestion.question,
      nextQuestion.options
    );

    // Combine feedback and next question
    return {
      text: `${feedbackResponse.text}\n\n---\n\n${nextQuestionResponse.text}`,
      parseMode: "HTML",
      buttons: nextQuestionResponse.buttons,
    };
  } catch (error) {
    console.error("Error generating next question:", error);
    // End quiz early
    quizSessions.delete(sessionKey);
    return personality.quizComplete(session.correct, session.currentIndex + 1, session.correct * 10);
  }
}

/**
 * Award XP to user
 */
async function awardXP(
  userId: string,
  xp: number,
  source: string
): Promise<void> {
  try {
    // Get current XP
    const { data: profile } = await supabase
      .from("profiles")
      .select("total_xp")
      .eq("id", userId)
      .single();

    const currentXP = profile?.total_xp || 0;

    // Update XP
    await supabase
      .from("profiles")
      .update({ total_xp: currentXP + xp })
      .eq("id", userId);

    // Log XP transaction
    await supabase.from("xp_transactions").insert({
      user_id: userId,
      amount: xp,
      source,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error awarding XP:", error);
  }
}

/**
 * Record quiz completion for analytics
 */
async function recordQuizCompletion(
  userId: string,
  topic: string,
  correct: number,
  total: number
): Promise<void> {
  try {
    await supabase.from("quiz_history").insert({
      user_id: userId,
      topic,
      correct_count: correct,
      total_count: total,
      source: "telegram_bot",
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    // Quiz history table might not exist, ignore error
    console.log("Could not record quiz history:", error);
  }
}

/**
 * Get active quiz session for user
 */
export function getQuizSession(userId: string) {
  return quizSessions.get(`${userId}_quiz`);
}

/**
 * Handle the /quiz command without a topic
 */
export async function handleQuiz(connection: BotConnection): Promise<BotResponse> {
  // Check if there's an active session
  const session = getQuizSession(connection.user_id);
  if (session) {
    // Resume existing quiz
    const currentQuestion = session.questions[session.currentIndex];
    return personality.quizQuestion(
      session.currentIndex + 1,
      5,
      currentQuestion.question,
      currentQuestion.options
    );
  }

  // No active session, show topic selection
  return personality.noQuizTopic();
}
