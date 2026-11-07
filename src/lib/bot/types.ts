/**
 * Bot Types - Shared types for Telegram/WhatsApp bot integration
 */

// Platform types
export type Platform = "telegram" | "whatsapp";

// Intent types for message classification
export type Intent =
  | "plan"      // Today's study plan
  | "quiz"      // MCQ quiz
  | "explain"   // AI explanation
  | "save"      // Save note
  | "progress"  // Stats & progress
  | "settings"  // Notification preferences
  | "help"      // Help/commands
  | "news"      // Current affairs / news briefing
  | "test"      // Mock test (hybrid - deep link)
  | "room"      // Study rooms (hybrid - deep link)
  | "rank"      // Leaderboard (hybrid - text + link)
  | "course"    // Coaching (hybrid - deep link)
  | "register"      // New user registration
  | "fillspscform"  // SPSC recruitment form filling
  | "chat"          // General conversation (fallback)
  | "unknown";      // Unrecognized

// Parsed message from any platform
export interface BotMessage {
  platform: Platform;
  chatId: string;
  messageId?: string;        // Platform message ID
  userId?: string;           // PrepSPSC user ID (if connected)
  text?: string;
  voiceUrl?: string;         // Voice message URL (Telegram)
  voiceFileId?: string;      // Voice file ID (WhatsApp - needs download)
  photoUrl?: string;         // Photo URL
  documentUrl?: string;      // Document file ID
  documentFileName?: string; // Document file name
  documentMimeType?: string; // Document MIME type
  callbackData?: string;     // Inline button callback
  replyToMessageId?: string;
  timestamp?: Date;          // Message timestamp
  metadata?: Record<string, unknown>;
}

// Response to send back
export interface BotResponse {
  text: string;
  parseMode?: "HTML" | "Markdown";
  buttons?: BotButton[];     // Inline buttons
  keyboard?: string[][];     // Reply keyboard
  removeKeyboard?: boolean;
}

// Inline button
export interface BotButton {
  text: string;
  callbackData?: string;     // For callback queries
  url?: string;              // For URL buttons
}

// Bot connection from database
export interface BotConnection {
  id: string;
  user_id: string;
  platform: Platform;
  platform_user_id: string;
  username?: string;
  connected_at: string;
  is_active: boolean;
  notification_preferences: NotificationPreferences;
  last_interaction_at: string;
}

// Notification preferences
export interface NotificationPreferences {
  morning_reminder: boolean;
  morning_time: string;      // "08:00"
  evening_nudge: boolean;
  streak_alerts: boolean;
  daily_summary: boolean;
}

// Pending registration
export interface PendingRegistration {
  id: string;
  platform: Platform;
  platform_user_id: string;
  registration_step: "name" | "exam" | "state" | "avatar" | "complete";
  collected_data: {
    name?: string;
    exam_type?: string;
    exam_state?: string;
    avatar?: string;
  };
  created_at: string;
  expires_at: string;
}

// Handler context
export interface HandlerContext {
  message: BotMessage;
  connection?: BotConnection;
  intent: Intent;
  intentData?: string;       // Additional data extracted (e.g., topic for "quiz polity")
}

// Handler result
export interface HandlerResult {
  response: BotResponse;
  updateLastInteraction?: boolean;
  logMessage?: boolean;
}

// Telegram-specific types
export namespace Telegram {
  export interface Update {
    update_id: number;
    message?: Message;
    callback_query?: CallbackQuery;
  }

  export interface Message {
    message_id: number;
    from?: User;
    chat: Chat;
    date: number;
    text?: string;
    voice?: Voice;
    photo?: PhotoSize[];
    document?: Document;
    reply_to_message?: Message;
  }

  export interface CallbackQuery {
    id: string;
    from: User;
    message?: Message;
    chat_instance: string;
    data?: string;
  }

  export interface User {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  }

  export interface Chat {
    id: number;
    type: "private" | "group" | "supergroup" | "channel";
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  }

  export interface Voice {
    file_id: string;
    file_unique_id: string;
    duration: number;
    mime_type?: string;
    file_size?: number;
  }

  export interface PhotoSize {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    file_size?: number;
  }

  export interface Document {
    file_id: string;
    file_unique_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  }

  export interface SendMessageOptions {
    chat_id: number | string;
    text: string;
    parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
    reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove;
    reply_to_message_id?: number;
  }

  export interface InlineKeyboardMarkup {
    inline_keyboard: InlineKeyboardButton[][];
  }

  export interface InlineKeyboardButton {
    text: string;
    url?: string;
    callback_data?: string;
  }

  export interface ReplyKeyboardMarkup {
    keyboard: KeyboardButton[][];
    resize_keyboard?: boolean;
    one_time_keyboard?: boolean;
    selective?: boolean;
  }

  export interface KeyboardButton {
    text: string;
  }

  export interface ReplyKeyboardRemove {
    remove_keyboard: true;
    selective?: boolean;
  }
}
