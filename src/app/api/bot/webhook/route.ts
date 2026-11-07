/**
 * Bot Webhook Handler
 * Receives messages from Telegram (and WhatsApp in Phase 2)
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { BotConnection, BotMessage, Telegram } from "@/lib/bot/types";
import { parseUpdate, sendMessage, answerCallbackQuery, sendTypingAction } from "@/lib/bot/adapters/telegram";
import { detectIntent, parseCallback } from "@/lib/bot/intent-detector";
import * as personality from "@/lib/bot/personality";
import { handlePlan } from "./handlers/plan";
import { handleQuiz, handleQuizAnswer, handleQuizTopic } from "./handlers/quiz";
import { handleProgress } from "./handlers/progress";
import { handleSave } from "./handlers/save";
import { handleHybrid } from "./handlers/hybrid";
import { handleChat } from "./handlers/chat";
import { handleCurrentAffairs } from "./handlers/current-affairs";
import { handleSettings, handleSettingsToggle } from "./handlers/settings";
import { handleRegistration, isInRegistration, getConnectAccountPrompt } from "./handlers/registration";
import { handleSpscForm, isInSpscFormFlow, cancelSpscFormFlow } from "./handlers/spsc-form";

// Initialize Supabase with service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Look up user connection by platform user ID
 */
async function getConnection(
  platform: "telegram" | "whatsapp",
  platformUserId: string
): Promise<BotConnection | null> {
  const { data, error } = await supabase
    .from("bot_connections")
    .select("*")
    .eq("platform", platform)
    .eq("platform_user_id", platformUserId)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    return null;
  }

  return data as BotConnection;
}

/**
 * Update last interaction timestamp
 */
async function updateLastInteraction(connectionId: string): Promise<void> {
  await supabase
    .from("bot_connections")
    .update({ last_interaction_at: new Date().toISOString() })
    .eq("id", connectionId);
}

/**
 * Log message to history
 */
async function logMessage(
  connectionId: string,
  direction: "incoming" | "outgoing",
  messageType: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await supabase.from("bot_messages").insert({
    connection_id: connectionId,
    direction,
    message_type: messageType,
    content,
    metadata,
  });
}

/**
 * Handle Telegram webhook POST request
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Determine platform from request (for now, only Telegram)
    // In Phase 2, we'll add WhatsApp detection based on headers/body structure
    const platform = "telegram" as const;

    // Parse the update based on platform
    let message: BotMessage | null = null;

    if (platform === "telegram") {
      const update = body as Telegram.Update;
      message = parseUpdate(update);

      // Answer callback query immediately to remove loading state
      if (update.callback_query) {
        const callbackId = update.callback_query.id;
        await answerCallbackQuery(callbackId);
      }
    }

    if (!message) {
      console.log("Could not parse message from update");
      return NextResponse.json({ ok: true });
    }

    // Look up connection
    let connection = await getConnection(platform, message.chatId);

    // Handle /start command with user ID for account linking
    if (message.text?.startsWith("/start ")) {
      const startParam = message.text.replace("/start ", "").trim();

      // If it looks like a UUID (user ID from onboarding)
      if (startParam.match(/^[0-9a-f-]{36}$/i)) {
        const userId = startParam;

        // Create connection
        const { error } = await supabase
          .from("bot_connections")
          .upsert({
            user_id: userId,
            platform,
            platform_user_id: message.chatId,
            username: (message.metadata?.username as string) || null,
            is_active: true,
            connected_at: new Date().toISOString(),
            last_interaction_at: new Date().toISOString(),
          }, {
            onConflict: "platform,platform_user_id",
          });

        if (!error) {
          // Refresh connection
          connection = await getConnection(platform, message.chatId);

          // Get user's name for personalized welcome
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", userId)
            .single();

          await sendMessage(message.chatId, personality.welcomeMessage(profile?.full_name));
          return NextResponse.json({ ok: true });
        }
      }
    }

    // If user not connected, check for registration flow or show connect prompt
    if (!connection) {
      // Check if user wants to start registration
      if (message.callbackData === "reg_start") {
        const response = await handleRegistration(
          platform,
          message.chatId,
          "",
          message.callbackData,
          message.metadata?.username as string
        );
        await sendMessage(message.chatId, response);
        return NextResponse.json({ ok: true });
      }

      // Check if user is in registration flow
      const inRegistration = await isInRegistration(platform, message.chatId);
      if (inRegistration || message.callbackData?.startsWith("reg_")) {
        const response = await handleRegistration(
          platform,
          message.chatId,
          message.text || "",
          message.callbackData,
          message.metadata?.username as string
        );
        await sendMessage(message.chatId, response);
        return NextResponse.json({ ok: true });
      }

      // Show connect/register prompt for /start command
      if (message.text === "/start") {
        await sendMessage(message.chatId, getConnectAccountPrompt());
      } else {
        // For any other message, also show the prompt
        await sendMessage(message.chatId, getConnectAccountPrompt());
      }
      return NextResponse.json({ ok: true });
    }

    // Show typing indicator
    await sendTypingAction(message.chatId);

    // === SPSC FORM FLOW (intercepts callbacks, text, photos, documents) ===
    const inSpscForm = await isInSpscFormFlow("telegram", message.chatId);
    if (inSpscForm || message.callbackData?.startsWith("spsc_")) {
      // Allow users to exit the form flow with commands
      const exitCommands = /^\/(help|plan|quiz|ca|stats|save|start|cancel|stop|exit)$/i;
      const cancelWords = /^(cancel|stop|exit|quit|back|nevermind|never mind)$/i;
      if (message.text && (exitCommands.test(message.text) || cancelWords.test(message.text))) {
        // Clean up the form collection
        await cancelSpscFormFlow("telegram", message.chatId);
        if (cancelWords.test(message.text) || /^\/(cancel|stop|exit)$/i.test(message.text)) {
          await sendMessage(message.chatId, {
            text: "Form cancelled. You can restart anytime with /fillspscform",
            parseMode: "HTML",
          });
          return NextResponse.json({ ok: true });
        }
        // For other commands (/help, /plan, etc.), fall through to normal routing
      } else {
        const response = await handleSpscForm(connection, message, message.callbackData);
        await sendMessage(message.chatId, response);
        await logMessage(connection.id, "outgoing", "text", response.text);
        await updateLastInteraction(connection.id);
        return NextResponse.json({ ok: true });
      }
    }

    // Handle callback (inline button press)
    if (message.callbackData) {
      const callback = parseCallback(message.callbackData);

      if (callback) {
        // Route callback to appropriate handler
        if (callback.action === "cmd") {
          // Command callbacks like cmd_plan, cmd_quiz
          const cmdIntent = callback.value as string;
          return await handleCommandIntent(cmdIntent, connection, message);
        } else if (callback.action === "quiz") {
          if (callback.value.startsWith("answer_")) {
            const answer = callback.value.replace("answer_", "");
            const response = await handleQuizAnswer(connection, answer);
            await sendMessage(message.chatId, response);
          } else if (callback.value.startsWith("topic_")) {
            const topic = callback.value.replace("topic_", "");
            const response = await handleQuizTopic(connection, topic);
            await sendMessage(message.chatId, response);
          }
        } else if (callback.action === "settings") {
          const response = await handleSettingsToggle(connection, callback.value);
          await sendMessage(message.chatId, response);
        }
      }

      return NextResponse.json({ ok: true });
    }

    // Handle text message
    if (message.text) {
      // Log incoming message
      await logMessage(connection.id, "incoming", "text", message.text);

      // Detect intent
      const { intent, data } = await detectIntent(message.text);

      // Route to handler
      const response = await routeToHandler(intent, data, connection, message);

      // Send response
      await sendMessage(message.chatId, response);

      // Log outgoing message
      await logMessage(connection.id, "outgoing", "text", response.text);

      // Update last interaction
      await updateLastInteraction(connection.id);
    }

    // Handle voice message with Groq Whisper transcription
    if (message.voiceUrl) {
      try {
        const { downloadFile } = await import("@/lib/bot/adapters/telegram");
        const { transcribeVoice } = await import("@/lib/bot/ai");

        // Show processing indicator
        await sendMessage(message.chatId, {
          text: "🎤 Transcribing your voice message...",
        });

        // Download voice file
        const audioBuffer = await downloadFile(message.voiceUrl);

        // Transcribe with Groq Whisper
        const transcribedText = await transcribeVoice(audioBuffer);

        if (transcribedText) {
          // Log the transcription
          await logMessage(connection.id, "incoming", "voice", transcribedText, {
            original_voice_url: message.voiceUrl,
          });

          // Detect intent from transcribed text
          const { intent, data } = await detectIntent(transcribedText);

          // Route to handler
          const response = await routeToHandler(intent, data, connection, {
            ...message,
            text: transcribedText,
          });

          // Send response with transcription preview
          await sendMessage(message.chatId, {
            text: `📝 <i>"${transcribedText.substring(0, 100)}${transcribedText.length > 100 ? "..." : ""}"</i>\n\n${response.text}`,
            parseMode: "HTML",
            buttons: response.buttons,
          });

          await logMessage(connection.id, "outgoing", "text", response.text);
          await updateLastInteraction(connection.id);
        } else {
          await sendMessage(message.chatId, {
            text: "Sorry, I couldn't understand that voice message. Please try again or type your message.",
          });
        }
      } catch (error) {
        console.error("Voice transcription error:", error);
        await sendMessage(message.chatId, {
          text: "Sorry, I had trouble processing your voice message. Please try typing instead.",
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ ok: true }); // Always return 200 to avoid Telegram retries
  }
}

/**
 * Handle command intent from callback
 */
async function handleCommandIntent(
  cmdIntent: string,
  connection: BotConnection,
  message: BotMessage
) {
  // Handle news category callbacks: news_sikkim, news_national, news_intl
  if (cmdIntent.startsWith("news")) {
    const parts = cmdIntent.split("_");
    const category = parts[1] === "intl" ? "international" : parts[1];
    const response = await routeToHandler("news" as never, category, connection, message);
    await sendMessage(message.chatId, response);
    return NextResponse.json({ ok: true });
  }

  const response = await routeToHandler(cmdIntent as never, undefined, connection, message);
  await sendMessage(message.chatId, response);
  return NextResponse.json({ ok: true });
}

/**
 * Route to appropriate handler based on intent
 */
async function routeToHandler(
  intent: string,
  data: string | undefined,
  connection: BotConnection,
  message: BotMessage
) {
  switch (intent) {
    case "plan":
      return handlePlan(connection);

    case "quiz":
      if (data) {
        return handleQuizTopic(connection, data);
      }
      return personality.noQuizTopic();

    case "explain":
      return handleChat(connection, `explain ${data || ""}`, true);

    case "save":
      if (data) {
        return handleSave(connection, data);
      }
      return { text: "What would you like to save? Use: /save [your note]" };

    case "progress":
      return handleProgress(connection);

    case "news":
      return handleCurrentAffairs(connection, data);

    case "settings":
      return handleSettings(connection);

    case "help":
      return personality.helpMessage();

    case "test":
    case "room":
    case "rank":
    case "course":
      return handleHybrid(connection, intent);

    case "fillspscform":
      return handleSpscForm(connection, message);

    case "chat":
    default:
      return handleChat(connection, message.text || data || "hello");
  }
}

/**
 * Verify webhook (GET request from Telegram)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Handle Telegram webhook verification
  // Telegram doesn't use GET verification, but we can use this for health check
  return NextResponse.json({
    status: "ok",
    message: "PrepSPSC Bot Webhook",
    timestamp: new Date().toISOString(),
  });
}
