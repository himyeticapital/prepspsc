/**
 * Chat Handler
 * Handles general conversation using AI
 */

import { createClient } from "@supabase/supabase-js";
import type { BotConnection, BotResponse } from "@/lib/bot/types";
import { generateChatResponse, explainTopic, type ChatMessage } from "@/lib/bot/ai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// System prompt for the bot
const SYSTEM_PROMPT = `You are PrepSPSC Bot, a friendly and knowledgeable AI study buddy for students preparing for UPSC and State PSC (especially Sikkim PSC) competitive exams.

Your personality:
- Encouraging and supportive (use relevant emojis sparingly)
- Knowledgeable about Indian polity, history, geography, economics, current affairs
- Especially well-versed in Sikkim-specific topics (history, geography, governance)
- Concise but helpful (keep responses under 200 words for chat)

Your capabilities:
- Answer questions about exam topics
- Explain concepts clearly
- Provide study tips and strategies
- Motivate students when they're struggling
- Suggest relevant topics to study

Remember:
- Be accurate with facts, dates, and figures
- If unsure, say so rather than making things up
- For complex topics, suggest checking official sources
- Keep responses formatted for chat (avoid long paragraphs)`;

/**
 * Handle general chat/questions
 */
export async function handleChat(
  connection: BotConnection,
  message: string,
  isExplainRequest: boolean = false
): Promise<BotResponse> {
  try {
    // If it's an explain request, use the dedicated explain function
    if (isExplainRequest) {
      const topic = message.replace(/^explain\s*/i, "").trim();
      if (topic) {
        const explanation = await explainTopic(topic);
        return {
          text: `📖 <b>${topic}</b>\n\n${explanation}`,
          parseMode: "HTML",
          buttons: [
            { text: "📝 Quiz Me", callbackData: `quiz_topic_${topic.split(" ")[0]}` },
            { text: "💾 Save Note", callbackData: `save_topic_${topic}` },
          ],
        };
      }
    }

    // Get recent conversation history for context
    const { data: recentMessages } = await supabase
      .from("bot_messages")
      .select("direction, content")
      .eq("connection_id", connection.id)
      .order("created_at", { ascending: false })
      .limit(6);

    // Convert to chat format (reverse to get chronological order)
    const conversationHistory: ChatMessage[] = (recentMessages || [])
      .reverse()
      .map((m) => ({
        role: m.direction === "incoming" ? "user" : "assistant",
        content: m.content,
      }))
      .filter((m) => m.content) as ChatMessage[];

    // Generate response
    const response = await generateChatResponse(
      SYSTEM_PROMPT,
      conversationHistory,
      message
    );

    // Check if response suggests a command
    const suggestedButtons = getSuggestedActions(response, message);

    return {
      text: response,
      parseMode: "HTML",
      buttons: suggestedButtons.length > 0 ? suggestedButtons : undefined,
    };
  } catch (error) {
    console.error("Chat handler error:", error);
    return {
      text: "I'm having trouble thinking right now. Please try again in a moment! 🤔",
      buttons: [
        { text: "📋 Today's Plan", callbackData: "cmd_plan" },
        { text: "📝 Quick Quiz", callbackData: "cmd_quiz" },
      ],
    };
  }
}

/**
 * Suggest action buttons based on conversation context
 */
function getSuggestedActions(
  response: string,
  userMessage: string
): Array<{ text: string; callbackData?: string; url?: string }> {
  const buttons: Array<{ text: string; callbackData?: string; url?: string }> = [];
  const lowerResponse = response.toLowerCase();
  const lowerMessage = userMessage.toLowerCase();

  // If discussing a topic, suggest quiz
  const topics = ["polity", "history", "geography", "economics", "sikkim", "constitution"];
  for (const topic of topics) {
    if (lowerResponse.includes(topic) || lowerMessage.includes(topic)) {
      buttons.push({ text: `📝 Quiz: ${topic}`, callbackData: `quiz_topic_${topic}` });
      break;
    }
  }

  // If user seems confused or struggling, suggest help
  if (
    lowerMessage.includes("confused") ||
    lowerMessage.includes("don't understand") ||
    lowerMessage.includes("help")
  ) {
    buttons.push({ text: "❓ See Commands", callbackData: "cmd_help" });
  }

  // If discussing preparation strategy, suggest plan
  if (
    lowerMessage.includes("prepare") ||
    lowerMessage.includes("study") ||
    lowerMessage.includes("plan")
  ) {
    buttons.push({ text: "📋 My Plan", callbackData: "cmd_plan" });
  }

  return buttons.slice(0, 2); // Max 2 buttons
}
