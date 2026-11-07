/**
 * Intent Detector
 * Classifies user messages into intents using rules + AI fallback
 */

import type { Intent } from "./types";
import { detectIntent as aiDetectIntent } from "./ai";

// Command patterns for rule-based detection
const COMMAND_PATTERNS: Record<Intent, RegExp[]> = {
  plan: [
    /^\/?(plan|today|schedule|agenda)$/i,
    /^what('s|s)?\s+(my\s+)?plan/i,
    /^show\s+(me\s+)?(my\s+)?plan/i,
  ],
  quiz: [
    /^\/?(quiz|test|mcq|practice)(\s+.+)?$/i,
    /^give\s+me\s+a\s+quiz/i,
    /^(quick\s+)?quiz\s+on\s+/i,
  ],
  explain: [
    /^\/?(explain|what\s+is|define|tell\s+me\s+about)\s+.+/i,
    /^(can\s+you\s+)?explain\s+/i,
  ],
  save: [
    /^\/?(save|note)[\s:]+.+/i,
    /^remember[\s:]+.+/i,
    /^add\s+(to\s+)?notes?[\s:]+.+/i,
  ],
  progress: [
    /^\/?(progress|stats|statistics|status)$/i,
    /^(show\s+)?(my\s+)?progress/i,
    /^how\s+(am\s+)?i\s+doing/i,
    /^(my\s+)?performance/i,
  ],
  settings: [
    /^\/?(settings|preferences|config)$/i,
    /^change\s+(my\s+)?settings/i,
    /^notification\s+(settings|preferences)/i,
  ],
  news: [
    /^\/?(ca|currentaffairs|current[\s-]?affairs|news)(\s+.+)?$/i,
    /^(latest\s+)?current\s+affairs/i,
    /^(today'?s?\s+)?news/i,
    /^what'?s?\s+(happening|new|going\s+on)/i,
    /^daily\s+(news|digest|briefing)/i,
  ],
  help: [
    /^\/?(help|commands|start)$/i,
    /^what\s+can\s+you\s+do/i,
    /^how\s+do\s+i\s+use/i,
  ],
  test: [
    /^\/?(mock|full)\s*test$/i,
    /^start\s+(a\s+)?(mock\s+)?test/i,
    /^take\s+(a\s+)?(full\s+)?test/i,
  ],
  room: [
    /^\/?(room|study\s*room|join|create\s*room)$/i,
    /^join\s+(a\s+)?room/i,
    /^create\s+(a\s+)?room/i,
    /^study\s+together/i,
  ],
  rank: [
    /^\/?(rank|ranking|leaderboard|position)$/i,
    /^(my\s+)?rank(ing)?/i,
    /^where\s+do\s+i\s+stand/i,
    /^top\s+\d+/i,
    /^friends?\s*(rank|leaderboard)?$/i,
  ],
  course: [
    /^\/?(course|coaching|lesson|video)s?$/i,
    /^(my\s+)?courses?/i,
    /^next\s+lesson/i,
    /^continue\s+(watching|learning)/i,
  ],
  register: [
    /^\/?(register|signup|sign\s*up|create\s*account)$/i,
  ],
  fillspscform: [
    /^\/?fillspscform$/i,
    /^\/?(apply|recruit|spsc\s*form|fill\s*form)$/i,
    /^(spsc|sikkim)\s+(apply|recruitment|form)/i,
    /^(i\s+want\s+to\s+)?apply(\s+for)?/i,
    /^fill\s+(my\s+)?(recruitment\s+)?form/i,
  ],
  chat: [], // Fallback - no specific patterns
  unknown: [], // Should never match
};

// Topics commonly asked about
const COMMON_TOPICS = [
  "polity", "indian polity", "constitution",
  "history", "indian history", "modern history", "ancient history",
  "geography", "indian geography", "world geography",
  "economics", "indian economy", "economy",
  "current affairs", "current events",
  "sikkim", "sikkim gk", "sikkim history",
  "science", "general science",
  "environment", "ecology",
  "international relations", "ir",
  "ethics", "integrity",
  "governance", "administration",
];

/**
 * Extract topic from message for quiz/explain intents
 */
function extractTopic(message: string, intent: Intent): string | undefined {
  const lowerMessage = message.toLowerCase();

  // For news: extract category filter
  if (intent === "news") {
    const match = lowerMessage.match(/(?:ca|currentaffairs|current[\s-]?affairs|news)\s+(.+)/i);
    if (match) {
      const cat = match[1].trim().toLowerCase();
      if (cat === "intl" || cat.startsWith("int")) return "international";
      if (cat.startsWith("nat")) return "national";
      if (cat.startsWith("sik")) return "sikkim";
      return cat;
    }
    return undefined;
  }

  // For quiz: extract topic after "quiz" keyword
  if (intent === "quiz") {
    const match = lowerMessage.match(/quiz\s+(?:on\s+)?(.+)/i);
    if (match) {
      return match[1].trim();
    }
  }

  // For explain: extract topic after explain keywords
  if (intent === "explain") {
    const match = lowerMessage.match(/(?:explain|what\s+is|define|tell\s+me\s+about)\s+(.+)/i);
    if (match) {
      return match[1].trim();
    }
  }

  // Check if message contains a known topic
  for (const topic of COMMON_TOPICS) {
    if (lowerMessage.includes(topic)) {
      return topic;
    }
  }

  return undefined;
}

/**
 * Extract note content from save command
 */
function extractNoteContent(message: string): string | undefined {
  // Match patterns like "save: content" or "note: content"
  const patterns = [
    /^(?:save|note|remember|add\s+(?:to\s+)?notes?)[\s:]+(.+)/i,
    /^\/save\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return undefined;
}

/**
 * Detect intent from message using rule-based matching
 * Falls back to AI detection for ambiguous cases
 */
export async function detectIntent(message: string): Promise<{
  intent: Intent;
  data?: string;
  confidence: number;
}> {
  const trimmedMessage = message.trim();

  // Empty message
  if (!trimmedMessage) {
    return { intent: "unknown", confidence: 0 };
  }

  // Try rule-based detection first
  for (const [intent, patterns] of Object.entries(COMMAND_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(trimmedMessage)) {
        let data: string | undefined;

        // Extract relevant data based on intent
        if (intent === "quiz" || intent === "explain" || intent === "news") {
          data = extractTopic(trimmedMessage, intent as Intent);
        } else if (intent === "save") {
          data = extractNoteContent(trimmedMessage);
        }

        return {
          intent: intent as Intent,
          data,
          confidence: 0.95, // High confidence for rule matches
        };
      }
    }
  }

  // Check for simple greetings
  if (/^(hi|hello|hey|good\s*(morning|afternoon|evening)|hii+)$/i.test(trimmedMessage)) {
    return { intent: "help", confidence: 0.85 }; // Show help on greeting
  }

  // For longer messages or questions, use AI detection
  if (trimmedMessage.length > 10 || trimmedMessage.includes("?")) {
    try {
      const aiResult = await aiDetectIntent(trimmedMessage);
      return {
        intent: aiResult.intent as Intent,
        data: aiResult.data || undefined,
        confidence: aiResult.confidence,
      };
    } catch (error) {
      console.error("AI intent detection failed:", error);
      // Fall through to chat fallback
    }
  }

  // Default to chat for unmatched messages
  return { intent: "chat", data: trimmedMessage, confidence: 0.6 };
}

/**
 * Check if a message is a callback (inline button press)
 */
export function isCallback(message: string): boolean {
  // Callbacks typically have a specific format like "quiz_answer_a" or "action_value"
  return /^[a-z]+_[a-z_]+$/i.test(message);
}

/**
 * Parse callback data
 */
export function parseCallback(callbackData: string): {
  action: string;
  value: string;
} | null {
  const parts = callbackData.split("_");
  if (parts.length >= 2) {
    return {
      action: parts[0],
      value: parts.slice(1).join("_"),
    };
  }
  return null;
}
