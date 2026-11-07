/**
 * Bot AI Integration
 * - Uses existing Gemini integration for chat, quiz, explanations
 * - Uses Groq Whisper for voice transcription
 */

import { AI_MODELS, BASIC_MODEL_CHAIN } from "@/lib/ai-models";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini (reuse existing config)
const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Model configuration (same as main gemini.ts)
const CHAT_MODEL = AI_MODELS.basic;
const FALLBACK_MODEL = BASIC_MODEL_CHAIN[1] ?? AI_MODELS.basic;

// Groq API for Whisper
const GROQ_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

/**
 * Get Gemini model for bot chat
 */
function getModel() {
  if (!genAI) {
    throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
  }
  return genAI.getGenerativeModel({ model: CHAT_MODEL });
}

/**
 * Message format for chat context
 */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Generate a chat response using Gemini
 * @param systemPrompt - System prompt defining bot behavior
 * @param messages - Conversation history
 * @param userMessage - Current user message
 */
export async function generateChatResponse(
  systemPrompt: string,
  messages: ChatMessage[],
  userMessage: string
): Promise<string> {
  const model = getModel();

  // Build conversation context
  const conversationParts = messages.map((msg) =>
    `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
  ).join("\n");

  const fullPrompt = `${systemPrompt}

${conversationParts ? `Previous conversation:\n${conversationParts}\n\n` : ""}User: ${userMessage}

Respond naturally as the PrepSPSC study buddy. Be helpful, encouraging, and educational. Keep responses concise for chat (2-4 sentences for simple queries, more for explanations).`;

  try {
    const result = await model.generateContent(fullPrompt);
    const response = result.response.text().trim();
    return response;
  } catch (error) {
    console.error("Bot chat error:", error);

    // Try fallback model
    try {
      const fallbackModel = genAI!.getGenerativeModel({ model: FALLBACK_MODEL });
      const result = await fallbackModel.generateContent(fullPrompt);
      return result.response.text().trim();
    } catch (fallbackError) {
      console.error("Fallback model also failed:", fallbackError);
      throw new Error("AI service temporarily unavailable");
    }
  }
}

/**
 * Generate a quick quiz question on a topic
 */
export async function generateQuizQuestion(topic: string): Promise<{
  question: string;
  options: { id: string; text: string }[];
  correctAnswer: string;
  explanation: string;
}> {
  const model = getModel();

  const prompt = `Generate a single MCQ question for UPSC/SPSC exam preparation on the topic: "${topic}"

The question should be:
- Relevant to competitive exams (UPSC, State PSCs)
- Clear and unambiguous
- Medium difficulty
- Educational and factual

Return ONLY valid JSON (no markdown):
{
  "question": "The question text...",
  "options": [
    { "id": "a", "text": "Option A text" },
    { "id": "b", "text": "Option B text" },
    { "id": "c", "text": "Option C text" },
    { "id": "d", "text": "Option D text" }
  ],
  "correctAnswer": "a",
  "explanation": "Brief explanation of why this is correct (2-3 sentences)..."
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text()
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    return JSON.parse(text);
  } catch (error) {
    console.error("Quiz generation error:", error);
    throw new Error("Failed to generate quiz question");
  }
}

/**
 * Generate multiple quiz questions for a topic
 */
export async function generateQuizBatch(
  topic: string,
  count: number = 5
): Promise<Array<{
  question: string;
  options: { id: string; text: string }[];
  correctAnswer: string;
  explanation: string;
}>> {
  const model = getModel();

  const prompt = `Generate ${count} MCQ questions for UPSC/SPSC exam preparation on the topic: "${topic}"

Requirements:
- Each question should test different aspects of the topic
- Mix of factual and conceptual questions
- Medium to high difficulty
- Educational and accurate

Return ONLY valid JSON array (no markdown):
[
  {
    "question": "Question 1 text...",
    "options": [
      { "id": "a", "text": "Option A" },
      { "id": "b", "text": "Option B" },
      { "id": "c", "text": "Option C" },
      { "id": "d", "text": "Option D" }
    ],
    "correctAnswer": "a",
    "explanation": "Brief explanation..."
  },
  ...
]`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text()
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    return JSON.parse(text);
  } catch (error) {
    console.error("Quiz batch generation error:", error);
    throw new Error("Failed to generate quiz questions");
  }
}

/**
 * Explain a topic concisely for chat
 */
export async function explainTopic(topic: string): Promise<string> {
  const model = getModel();

  const prompt = `You are an expert UPSC/SPSC exam coach. Explain the following topic concisely for a student preparing for competitive exams:

Topic: "${topic}"

Requirements:
- Start with a clear definition or key point
- Include 2-3 important facts, dates, or figures
- Mention relevance to UPSC/State PSC exams
- Keep it under 200 words
- Use simple language

Format the response for chat (no markdown headers, just clear paragraphs).`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("Topic explanation error:", error);
    throw new Error("Failed to explain topic");
  }
}

/**
 * Extract tags from a note using AI
 */
export async function extractNoteTags(noteContent: string): Promise<string[]> {
  const model = getModel();

  const prompt = `Extract relevant study tags from this note for a UPSC/State PSC exam student.

Note: "${noteContent}"

Return 2-5 tags that categorize this note by:
- Subject (polity, history, geography, economics, current-affairs, etc.)
- Specific topic (article-21, fundamental-rights, indian-constitution, etc.)
- Exam relevance if clear

Return ONLY a JSON array of lowercase tags with hyphens (no markdown):
["tag-1", "tag-2", "tag-3"]`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text()
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    return JSON.parse(text);
  } catch (error) {
    console.error("Tag extraction error:", error);
    // Return empty array on failure - tags are optional
    return [];
  }
}

/**
 * Transcribe voice message using Groq Whisper
 */
export async function transcribeVoice(audioBuffer: Buffer): Promise<string> {
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  // Create form data with audio file
  const formData = new FormData();
  const uint8Array = new Uint8Array(audioBuffer);
  formData.append("file", new Blob([uint8Array], { type: "audio/ogg" }), "voice.ogg");
  formData.append("model", "whisper-large-v3");
  formData.append("language", "en"); // Can auto-detect, but English is most common
  formData.append("response_format", "text");

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Groq Whisper error:", error);
      throw new Error(`Transcription failed: ${response.status}`);
    }

    const text = await response.text();
    return text.trim();
  } catch (error) {
    console.error("Voice transcription error:", error);
    throw new Error("Failed to transcribe voice message");
  }
}

/**
 * Detect user intent from message
 */
export async function detectIntent(message: string): Promise<{
  intent: string;
  data?: string;
  confidence: number;
}> {
  const model = getModel();

  const prompt = `Classify the user's intent from this message. The user is interacting with a study app bot for UPSC/State PSC exam preparation.

Message: "${message}"

Possible intents:
- "plan" - User wants to see their study plan for today
- "quiz" - User wants to take a quiz (may include topic like "quiz polity")
- "explain" - User wants explanation of a topic (usually followed by topic name)
- "save" - User wants to save a note (usually starts with "save:" or "note:")
- "progress" - User wants to see their stats/progress
- "settings" - User wants to change notification preferences
- "help" - User needs help or list of commands
- "test" - User wants to take a full mock test (redirect to web)
- "room" - User wants to join/create study room (redirect to web)
- "rank" - User wants to see leaderboard position
- "course" - User asking about coaching/course content
- "register" - New user trying to sign up
- "chat" - General conversation or question (fallback)

Return ONLY JSON (no markdown):
{
  "intent": "<intent>",
  "data": "<extracted topic/content if applicable, or null>",
  "confidence": <0.0 to 1.0>
}

Examples:
- "quiz polity" → {"intent": "quiz", "data": "polity", "confidence": 0.95}
- "explain article 21" → {"intent": "explain", "data": "article 21", "confidence": 0.95}
- "save: Gandhi was born in 1869" → {"intent": "save", "data": "Gandhi was born in 1869", "confidence": 0.98}
- "how am I doing?" → {"intent": "progress", "data": null, "confidence": 0.85}
- "what is the capital of sikkim?" → {"intent": "chat", "data": "capital of sikkim", "confidence": 0.90}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text()
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    return JSON.parse(text);
  } catch (error) {
    console.error("Intent detection error:", error);
    // Default to chat intent on error
    return { intent: "chat", confidence: 0.5 };
  }
}

/**
 * Generate personalized morning reminder message
 */
export async function generateMorningReminder(userData: {
  name: string;
  streak: number;
  todayTopics: string[];
  dueFlashcards: number;
  examName?: string;
}): Promise<string> {
  const { name, streak, todayTopics, dueFlashcards, examName } = userData;

  const model = getModel();

  const prompt = `Generate a short, motivational morning study reminder for a student.

Student info:
- Name: ${name}
- Current streak: ${streak} days
- Exam: ${examName || "SPSC"}
- Today's topics: ${todayTopics.length > 0 ? todayTopics.join(", ") : "No specific topics planned"}
- Due flashcards: ${dueFlashcards}

Requirements:
- Keep it under 100 words
- Be encouraging and friendly
- Use 2-3 relevant emojis
- Mention the streak if > 0
- List today's key tasks
- End with a motivating call to action

Format for chat (no markdown headers).`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("Morning reminder generation error:", error);
    // Fallback to simple reminder
    return `Good morning, ${name}! 🌅\n\n${streak > 0 ? `🔥 ${streak} day streak! ` : ""}Time to study!\n\n${todayTopics.length > 0 ? `Today's focus: ${todayTopics.join(", ")}` : "Check your study plan for today's topics."}\n\nLet's make progress! 💪`;
  }
}

/**
 * Generate evening streak alert
 */
export async function generateStreakAlert(userData: {
  name: string;
  streak: number;
  lastActivity?: string;
}): Promise<string> {
  const { name, streak, lastActivity } = userData;

  // Simple template-based alert (no AI needed for this)
  if (streak === 0) {
    return `Hey ${name}! 👋\n\nStart your study streak today! Even 10 minutes of focused study counts.\n\n📚 Quick options:\n• Take a 5-question quiz\n• Review one topic\n• Save a study note\n\nType "quiz" to start! 🚀`;
  }

  return `Hey ${name}! ⚡\n\n🔥 Your ${streak}-day streak is at risk!\n\nDon't break the chain - even a quick quiz counts.\n\n${lastActivity ? `Last activity: ${lastActivity}` : ""}\n\nType "quiz" for a quick study session! 💪`;
}

/**
 * Generate daily summary message
 */
export async function generateDailySummary(userData: {
  name: string;
  xpEarned: number;
  topicsCompleted: number;
  accuracy: number;
  streak: number;
  tomorrowTopics: string[];
}): Promise<string> {
  const { name, xpEarned, topicsCompleted, accuracy, streak, tomorrowTopics } = userData;

  const emoji = accuracy >= 80 ? "🌟" : accuracy >= 60 ? "👍" : "💪";

  return `Good night, ${name}! 🌙\n\n📊 Today's Summary:\n• XP Earned: ${xpEarned} ⭐\n• Topics: ${topicsCompleted} completed 📚\n• Accuracy: ${accuracy}% ${emoji}\n• Streak: ${streak} days 🔥\n\n${tomorrowTopics.length > 0 ? `📅 Tomorrow: ${tomorrowTopics.slice(0, 2).join(", ")}${tomorrowTopics.length > 2 ? ` +${tomorrowTopics.length - 2} more` : ""}` : ""}\n\nRest well and come back stronger! 😴`;
}
