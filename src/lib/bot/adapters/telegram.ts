/**
 * Telegram Bot Adapter
 * Handles communication with Telegram Bot API
 */

import type {
  BotMessage,
  BotResponse,
  BotButton,
  Telegram,
} from "../types";

const TELEGRAM_API = "https://api.telegram.org/bot";

/**
 * Get the bot token from environment
 */
function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set");
  }
  return token;
}

/**
 * Make a request to Telegram Bot API
 */
async function telegramRequest<T>(
  method: string,
  body?: Record<string, unknown>
): Promise<T> {
  const token = getBotToken();
  const url = `${TELEGRAM_API}${token}/${method}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!data.ok) {
    console.error(`Telegram API error: ${data.description}`);
    throw new Error(data.description || "Telegram API error");
  }

  return data.result as T;
}

/**
 * Parse incoming Telegram update into BotMessage
 */
export function parseUpdate(update: Telegram.Update): BotMessage | null {
  // Handle callback query (inline button press)
  if (update.callback_query) {
    const callback = update.callback_query;
    return {
      platform: "telegram",
      chatId: callback.message?.chat.id.toString() || "",
      text: callback.data,
      callbackData: callback.data,
      metadata: {
        callbackQueryId: callback.id,
        fromUser: callback.from,
        messageId: callback.message?.message_id,
      },
    };
  }

  // Handle regular message
  if (update.message) {
    const msg = update.message;
    const botMessage: BotMessage = {
      platform: "telegram",
      chatId: msg.chat.id.toString(),
      metadata: {
        messageId: msg.message_id,
        fromUser: msg.from,
        chatType: msg.chat.type,
        username: msg.from?.username,
      },
    };

    // Text message
    if (msg.text) {
      botMessage.text = msg.text;
    }

    // Voice message
    if (msg.voice) {
      botMessage.voiceUrl = msg.voice.file_id;
      botMessage.metadata = {
        ...botMessage.metadata,
        voiceDuration: msg.voice.duration,
        voiceMimeType: msg.voice.mime_type,
      };
    }

    // Photo message (get largest size)
    if (msg.photo && msg.photo.length > 0) {
      const largestPhoto = msg.photo[msg.photo.length - 1];
      botMessage.photoUrl = largestPhoto.file_id;
    }

    // Document message
    if (msg.document) {
      botMessage.documentUrl = msg.document.file_id;
      botMessage.documentFileName = msg.document.file_name;
      botMessage.documentMimeType = msg.document.mime_type;
    }

    // Reply reference
    if (msg.reply_to_message) {
      botMessage.replyToMessageId = msg.reply_to_message.message_id.toString();
    }

    return botMessage;
  }

  return null;
}

/**
 * Build inline keyboard markup from buttons
 */
function buildInlineKeyboard(
  buttons: BotButton[]
): Telegram.InlineKeyboardMarkup {
  // Arrange buttons in rows of 2
  const rows: Telegram.InlineKeyboardButton[][] = [];
  let currentRow: Telegram.InlineKeyboardButton[] = [];

  for (const button of buttons) {
    const tgButton: Telegram.InlineKeyboardButton = {
      text: button.text,
    };

    if (button.url) {
      tgButton.url = button.url;
    } else if (button.callbackData) {
      tgButton.callback_data = button.callbackData;
    }

    currentRow.push(tgButton);

    // Max 2 buttons per row for better mobile UX
    if (currentRow.length >= 2) {
      rows.push(currentRow);
      currentRow = [];
    }
  }

  // Add remaining buttons
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return { inline_keyboard: rows };
}

/**
 * Build reply keyboard markup
 */
function buildReplyKeyboard(
  keyboard: string[][]
): Telegram.ReplyKeyboardMarkup {
  return {
    keyboard: keyboard.map((row) =>
      row.map((text) => ({ text }))
    ),
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

/**
 * Send a message via Telegram
 */
export async function sendMessage(
  chatId: string,
  response: BotResponse
): Promise<void> {
  const options: Telegram.SendMessageOptions = {
    chat_id: chatId,
    text: response.text,
    parse_mode: response.parseMode || "HTML",
  };

  // Add inline buttons
  if (response.buttons && response.buttons.length > 0) {
    options.reply_markup = buildInlineKeyboard(response.buttons);
  }
  // Add reply keyboard
  else if (response.keyboard && response.keyboard.length > 0) {
    options.reply_markup = buildReplyKeyboard(response.keyboard);
  }
  // Remove keyboard
  else if (response.removeKeyboard) {
    options.reply_markup = { remove_keyboard: true };
  }

  await telegramRequest("sendMessage", options as unknown as Record<string, unknown>);
}

/**
 * Answer callback query (acknowledge button press)
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert?: boolean
): Promise<void> {
  await telegramRequest("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}

/**
 * Get file URL for voice messages/photos
 */
export async function getFileUrl(fileId: string): Promise<string> {
  const token = getBotToken();
  const file = await telegramRequest<{ file_path: string }>("getFile", {
    file_id: fileId,
  });
  return `https://api.telegram.org/file/bot${token}/${file.file_path}`;
}

/**
 * Download file content as buffer
 */
export async function downloadFile(fileId: string): Promise<Buffer> {
  const url = await getFileUrl(fileId);
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Set webhook URL for the bot
 */
export async function setWebhook(webhookUrl: string): Promise<void> {
  await telegramRequest("setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query"],
  });
  console.log(`Telegram webhook set to: ${webhookUrl}`);
}

/**
 * Delete webhook (for local development)
 */
export async function deleteWebhook(): Promise<void> {
  await telegramRequest("deleteWebhook");
  console.log("Telegram webhook deleted");
}

/**
 * Get bot info
 */
export async function getBotInfo(): Promise<Telegram.User> {
  return telegramRequest<Telegram.User>("getMe");
}

/**
 * Set bot commands (for menu)
 */
export async function setBotCommands(): Promise<void> {
  const commands = [
    { command: "plan", description: "📋 Today's study plan" },
    { command: "quiz", description: "📝 Take a quick quiz" },
    { command: "ca", description: "📰 Current affairs" },
    { command: "stats", description: "📊 View your progress" },
    { command: "save", description: "💾 Save a note" },
    { command: "fillspscform", description: "📋 Fill SPSC recruitment form" },
    { command: "help", description: "❓ Show all commands" },
  ];

  await telegramRequest("setMyCommands", { commands });
  console.log("Bot commands set");
}

/**
 * Send a photo message (for CAPTCHA images and screenshots)
 */
export async function sendPhoto(
  chatId: string,
  photoBase64: string,
  caption?: string,
  buttons?: BotButton[]
): Promise<void> {
  const token = getBotToken();
  const url = `${TELEGRAM_API}${token}/sendPhoto`;

  const formData = new FormData();
  formData.append("chat_id", chatId);

  // Convert base64 to blob
  const buffer = Buffer.from(photoBase64, "base64");
  const blob = new Blob([buffer], { type: "image/png" });
  formData.append("photo", blob, "image.png");

  if (caption) {
    formData.append("caption", caption);
    formData.append("parse_mode", "HTML");
  }

  if (buttons && buttons.length > 0) {
    formData.append("reply_markup", JSON.stringify(buildInlineKeyboard(buttons)));
  }

  const response = await fetch(url, { method: "POST", body: formData });
  const data = await response.json();
  if (!data.ok) {
    console.error(`Telegram sendPhoto error: ${data.description}`);
  }
}

/**
 * Delete a message (for security - delete password messages)
 */
export async function deleteMessage(
  chatId: string,
  messageId: number
): Promise<void> {
  try {
    await telegramRequest("deleteMessage", {
      chat_id: chatId,
      message_id: messageId,
    });
  } catch (error) {
    console.error("Failed to delete message:", error);
  }
}

/**
 * Send typing indicator
 */
export async function sendTypingAction(chatId: string): Promise<void> {
  await telegramRequest("sendChatAction", {
    chat_id: chatId,
    action: "typing",
  });
}
