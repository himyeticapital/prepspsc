#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL =
  "https://qqqditxzghqzodvauxth.supabase.co/functions/v1/pyq-api";

function getApiKey(): string {
  const key = process.env.PREPSPSC_API_KEY;
  if (!key) {
    throw new Error(
      "PREPSPSC_API_KEY environment variable is required. Get a free key at https://prepspsc.com/developers"
    );
  }
  return key;
}

async function apiRequest(
  path: string,
  method: string,
  body?: Record<string, unknown>,
  queryParams?: Record<string, string>
): Promise<unknown> {
  let url = `${BASE_URL}${path}`;
  if (queryParams) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      `API error ${res.status}: ${JSON.stringify(error)}`
    );
  }

  return res.json();
}

const server = new McpServer({
  name: "prepspsc-pyq",
  version: "1.0.0",
});

// --------------------------------------------------------------------------
// Tool: list_subjects
// --------------------------------------------------------------------------
server.tool(
  "list_subjects",
  "List all available subjects with question counts. Call this first to discover what's searchable.",
  {},
  async () => {
    const data = await apiRequest("", "GET");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --------------------------------------------------------------------------
// Tool: search_questions
// --------------------------------------------------------------------------
server.tool(
  "search_questions",
  "Search 7,400+ previous year questions using natural language. Returns MCQs with answers, explanations, topics, cognitive levels, and difficulty. Use returned questions as few-shot examples for AI question generation.",
  {
    query: z
      .string()
      .min(3)
      .describe(
        "Natural language search (e.g., 'Fundamental Rights Article 21', 'Sikkim history')"
      ),
    subject: z
      .string()
      .describe(
        "Subject to search within (e.g., 'Indian Polity', 'History', 'Science')"
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(5)
      .describe("Max results (1-20)"),
    threshold: z
      .number()
      .min(0)
      .max(1)
      .default(0.3)
      .describe("Min similarity 0-1 (lower = more results)"),
  },
  async ({ query, subject, limit, threshold }) => {
    const data = await apiRequest("", "POST", {
      query,
      subject,
      limit,
      threshold,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --------------------------------------------------------------------------
// Tool: generate_mock_test
// --------------------------------------------------------------------------
server.tool(
  "generate_mock_test",
  "Generate a complete mock test following real SPSC exam patterns. 64 patterns available (Undersecretary, SI Police, GDMO, Junior Engineer, etc.). Returns sections with difficulty-balanced questions.",
  {
    pattern: z
      .string()
      .describe(
        "Exam pattern ID (e.g., 'undersecretary-prelims', 'si-police-prelims', 'quick-practice-30'). Use list_exam_patterns to see all 64 options."
      ),
    difficulty_mix: z
      .object({
        easy: z.number().int().default(30),
        medium: z.number().int().default(50),
        hard: z.number().int().default(20),
      })
      .optional()
      .describe("Custom difficulty % (default: 30/50/20)"),
  },
  async ({ pattern, difficulty_mix }) => {
    const body: Record<string, unknown> = { pattern };
    if (difficulty_mix) body.difficulty_mix = difficulty_mix;
    const data = await apiRequest("/mock-test", "POST", body);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --------------------------------------------------------------------------
// Tool: list_exam_patterns
// --------------------------------------------------------------------------
server.tool(
  "list_exam_patterns",
  "List all 64 exam patterns with subject distribution, question counts, duration, and marking scheme. Use pattern IDs with generate_mock_test.",
  {},
  async () => {
    const data = await apiRequest("/patterns", "GET");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --------------------------------------------------------------------------
// Tool: record_progress
// --------------------------------------------------------------------------
server.tool(
  "record_progress",
  "Record a user's answer to a question. Tracks selected option, correctness, and time spent.",
  {
    external_user_id: z.string().describe("Your app's user identifier"),
    question_id: z.string().describe("UUID of the question answered"),
    selected_option: z
      .enum(["a", "b", "c", "d"])
      .describe("Option selected"),
    is_correct: z.boolean().describe("Whether the answer was correct"),
    time_spent_seconds: z
      .number()
      .int()
      .optional()
      .describe("Time spent in seconds"),
  },
  async ({
    external_user_id,
    question_id,
    selected_option,
    is_correct,
    time_spent_seconds,
  }) => {
    const body: Record<string, unknown> = {
      external_user_id,
      question_id,
      selected_option,
      is_correct,
    };
    if (time_spent_seconds !== undefined)
      body.time_spent_seconds = time_spent_seconds;
    const data = await apiRequest("/progress", "POST", body);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --------------------------------------------------------------------------
// Tool: get_analytics
// --------------------------------------------------------------------------
server.tool(
  "get_analytics",
  "Get performance analytics for a user: accuracy by subject, difficulty breakdown, and recent activity.",
  {
    user_id: z.string().describe("Your app's user identifier"),
  },
  async ({ user_id }) => {
    const data = await apiRequest("/analytics", "GET", undefined, {
      user_id,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --------------------------------------------------------------------------
// Tool: get_leaderboard
// --------------------------------------------------------------------------
server.tool(
  "get_leaderboard",
  "Get leaderboard rankings by correct answers and accuracy.",
  {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe("Max entries (1-100)"),
    time_range: z
      .enum(["week", "month", "all_time"])
      .default("all_time")
      .describe("Time range for rankings"),
  },
  async ({ limit, time_range }) => {
    const data = await apiRequest("/leaderboard", "GET", undefined, {
      limit: String(limit),
      time_range,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --------------------------------------------------------------------------
// Tool: add_bookmark
// --------------------------------------------------------------------------
server.tool(
  "add_bookmark",
  "Bookmark a question for later review.",
  {
    external_user_id: z.string().describe("Your app's user identifier"),
    question_id: z.string().describe("UUID of the question to bookmark"),
    note: z.string().optional().describe("Optional note to attach"),
  },
  async ({ external_user_id, question_id, note }) => {
    const body: Record<string, unknown> = { external_user_id, question_id };
    if (note) body.note = note;
    const data = await apiRequest("/bookmarks", "POST", body);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --------------------------------------------------------------------------
// Tool: get_bookmarks
// --------------------------------------------------------------------------
server.tool(
  "get_bookmarks",
  "Get a user's bookmarked questions.",
  {
    user_id: z.string().describe("Your app's user identifier"),
  },
  async ({ user_id }) => {
    const data = await apiRequest("/bookmarks", "GET", undefined, {
      user_id,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --------------------------------------------------------------------------
// Tool: remove_bookmark
// --------------------------------------------------------------------------
server.tool(
  "remove_bookmark",
  "Remove a bookmarked question.",
  {
    external_user_id: z.string().describe("Your app's user identifier"),
    question_id: z.string().describe("UUID of the question to unbookmark"),
  },
  async ({ external_user_id, question_id }) => {
    const data = await apiRequest("/bookmarks", "DELETE", {
      external_user_id,
      question_id,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --------------------------------------------------------------------------
// Tool: get_progress
// --------------------------------------------------------------------------
server.tool(
  "get_progress",
  "Get a user's complete answer history.",
  {
    user_id: z.string().describe("Your app's user identifier"),
  },
  async ({ user_id }) => {
    const data = await apiRequest("/progress", "GET", undefined, {
      user_id,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --------------------------------------------------------------------------
// Start
// --------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
