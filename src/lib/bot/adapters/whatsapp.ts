/**
 * WhatsApp Business API Adapter
 * Handles communication with WhatsApp Cloud API
 *
 * Setup required:
 * 1. Create Meta Business Account
 * 2. Add WhatsApp Business to your app
 * 3. Get Phone Number ID and Access Token
 * 4. Set webhook URL and verify token
 */

import type { BotMessage, BotResponse, BotButton } from "../types";

const WHATSAPP_API = "https://graph.facebook.com/v18.0";

/**
 * WhatsApp-specific types
 */
export namespace WhatsApp {
  export interface WebhookPayload {
    object: "whatsapp_business_account";
    entry: Entry[];
  }

  export interface Entry {
    id: string;
    changes: Change[];
  }

  export interface Change {
    value: {
      messaging_product: "whatsapp";
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Contact[];
      messages?: Message[];
      statuses?: Status[];
    };
    field: "messages";
  }

  export interface Contact {
    profile: { name: string };
    wa_id: string;
  }

  export interface Message {
    from: string;
    id: string;
    timestamp: string;
    type: "text" | "image" | "audio" | "video" | "document" | "location" | "contacts" | "interactive" | "button";
    text?: { body: string };
    audio?: { id: string; mime_type: string };
    image?: { id: string; mime_type: string; caption?: string };
    interactive?: {
      type: "button_reply" | "list_reply";
      button_reply?: { id: string; title: string };
      list_reply?: { id: string; title: string; description?: string };
    };
    button?: { text: string; payload: string };
    context?: { from: string; id: string };
  }

  export interface Status {
    id: string;
    status: "sent" | "delivered" | "read" | "failed";
    timestamp: string;
    recipient_id: string;
  }

  export interface SendMessageRequest {
    messaging_product: "whatsapp";
    recipient_type: "individual";
    to: string;
    type: "text" | "interactive" | "template";
    text?: { body: string; preview_url?: boolean };
    interactive?: InteractiveMessage;
    template?: TemplateMessage;
  }

  export interface InteractiveMessage {
    type: "button" | "list";
    header?: { type: "text"; text: string };
    body: { text: string };
    footer?: { text: string };
    action: {
      buttons?: InteractiveButton[];
      button?: string;
      sections?: ListSection[];
    };
  }

  export interface InteractiveButton {
    type: "reply";
    reply: { id: string; title: string };
  }

  export interface ListSection {
    title: string;
    rows: { id: string; title: string; description?: string }[];
  }

  export interface TemplateMessage {
    name: string;
    language: { code: string };
    components?: TemplateComponent[];
  }

  export interface TemplateComponent {
    type: "header" | "body" | "button";
    parameters?: { type: "text"; text: string }[];
  }
}

/**
 * Get WhatsApp credentials from environment
 */
function getCredentials() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error("WhatsApp credentials not configured (WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN)");
  }

  return { phoneNumberId, accessToken };
}

/**
 * Make a request to WhatsApp Cloud API
 */
async function whatsappRequest<T>(
  endpoint: string,
  method: "GET" | "POST" = "POST",
  body?: Record<string, unknown>
): Promise<T> {
  const { phoneNumberId, accessToken } = getCredentials();
  const url = `${WHATSAPP_API}/${phoneNumberId}/${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("WhatsApp API error:", data);
    throw new Error(data.error?.message || "WhatsApp API error");
  }

  return data as T;
}

/**
 * Parse incoming WhatsApp webhook into BotMessage
 */
export function parseWebhook(payload: WhatsApp.WebhookPayload): BotMessage | null {
  try {
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value?.messages?.length) {
      return null;
    }

    const message = value.messages[0];
    const contact = value.contacts?.[0];

    // Text message
    if (message.type === "text" && message.text) {
      return {
        platform: "whatsapp",
        chatId: message.from,
        messageId: message.id,
        text: message.text.body,
        timestamp: new Date(parseInt(message.timestamp) * 1000),
        metadata: {
          phoneNumberId: value.metadata.phone_number_id,
          displayPhone: value.metadata.display_phone_number,
          contactName: contact?.profile?.name,
        },
      };
    }

    // Audio/voice message
    if (message.type === "audio" && message.audio) {
      return {
        platform: "whatsapp",
        chatId: message.from,
        messageId: message.id,
        timestamp: new Date(parseInt(message.timestamp) * 1000),
        voiceFileId: message.audio.id,
        metadata: {
          phoneNumberId: value.metadata.phone_number_id,
          mimeType: message.audio.mime_type,
          contactName: contact?.profile?.name,
        },
      };
    }

    // Interactive button reply
    if (message.type === "interactive" && message.interactive) {
      const reply = message.interactive.button_reply || message.interactive.list_reply;
      if (reply) {
        return {
          platform: "whatsapp",
          chatId: message.from,
          messageId: message.id,
          callbackData: reply.id,
          timestamp: new Date(parseInt(message.timestamp) * 1000),
          metadata: {
            phoneNumberId: value.metadata.phone_number_id,
            buttonTitle: reply.title,
            contactName: contact?.profile?.name,
          },
        };
      }
    }

    // Button message (deprecated but some clients still use it)
    if (message.type === "button" && message.button) {
      return {
        platform: "whatsapp",
        chatId: message.from,
        messageId: message.id,
        callbackData: message.button.payload,
        text: message.button.text,
        timestamp: new Date(parseInt(message.timestamp) * 1000),
        metadata: {
          phoneNumberId: value.metadata.phone_number_id,
          contactName: contact?.profile?.name,
        },
      };
    }

    return null;
  } catch (error) {
    console.error("Error parsing WhatsApp webhook:", error);
    return null;
  }
}

/**
 * Build interactive buttons for WhatsApp
 * WhatsApp supports max 3 buttons with max 20 chars each
 */
function buildInteractiveButtons(buttons: BotButton[]): WhatsApp.InteractiveButton[] {
  return buttons.slice(0, 3).map((btn, idx) => ({
    type: "reply" as const,
    reply: {
      id: btn.callbackData || `btn_${idx}`,
      title: btn.text.slice(0, 20), // WhatsApp limit
    },
  }));
}

/**
 * Send a message via WhatsApp
 */
export async function sendMessage(
  to: string,
  response: BotResponse
): Promise<void> {
  // Remove any non-numeric characters from phone number
  const phoneNumber = to.replace(/\D/g, "");

  // If we have buttons (up to 3), use interactive message
  if (response.buttons && response.buttons.length > 0 && response.buttons.length <= 3) {
    // Filter out URL buttons (WhatsApp doesn't support URL buttons in interactive)
    const replyButtons = response.buttons.filter(btn => btn.callbackData);

    if (replyButtons.length > 0) {
      const payload: WhatsApp.SendMessageRequest = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phoneNumber,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: stripHtml(response.text) },
          action: {
            buttons: buildInteractiveButtons(replyButtons),
          },
        },
      };

      await whatsappRequest("messages", "POST", payload as unknown as Record<string, unknown>);
      return;
    }
  }

  // Plain text message
  const payload: WhatsApp.SendMessageRequest = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phoneNumber,
    type: "text",
    text: {
      body: stripHtml(response.text),
      preview_url: true,
    },
  };

  await whatsappRequest("messages", "POST", payload as unknown as Record<string, unknown>);
}

/**
 * Download media file from WhatsApp
 */
export async function downloadMedia(mediaId: string): Promise<Buffer> {
  const { accessToken } = getCredentials();

  // First, get the media URL
  const mediaInfo = await fetch(`${WHATSAPP_API}/${mediaId}`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  }).then(res => res.json());

  if (!mediaInfo.url) {
    throw new Error("Could not get media URL");
  }

  // Download the actual file
  const response = await fetch(mediaInfo.url, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Mark message as read
 */
export async function markAsRead(messageId: string): Promise<void> {
  await whatsappRequest("messages", "POST", {
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
  });
}

/**
 * Send typing indicator (WhatsApp doesn't have this, but we can use "read" status)
 */
export async function sendTypingAction(to: string): Promise<void> {
  // WhatsApp doesn't support typing indicators
  // We could mark previous message as read instead
  // For now, this is a no-op
  void to;
}

/**
 * Verify webhook callback (required by WhatsApp)
 */
export function verifyWebhook(
  mode: string,
  token: string,
  challenge: string
): string | null {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    return challenge;
  }

  return null;
}

/**
 * Strip HTML tags from text (WhatsApp doesn't support HTML)
 */
function stripHtml(text: string): string {
  return text
    .replace(/<b>/g, "*")
    .replace(/<\/b>/g, "*")
    .replace(/<i>/g, "_")
    .replace(/<\/i>/g, "_")
    .replace(/<code>/g, "```")
    .replace(/<\/code>/g, "```")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}
