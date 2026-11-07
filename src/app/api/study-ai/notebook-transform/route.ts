import { AI_MODELS } from "@/lib/ai-models";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DEFAULT_OPEN_NOTEBOOK_URL = "http://127.0.0.1:5055";

function getNotebookBaseUrl() {
  return process.env.OPEN_NOTEBOOK_URL || DEFAULT_OPEN_NOTEBOOK_URL;
}

async function notebookFetch(path: string, method: string, body?: unknown) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (process.env.OPEN_NOTEBOOK_SECRET) {
    headers["X-Internal-Secret"] = process.env.OPEN_NOTEBOOK_SECRET;
  }

  return fetch(`${getNotebookBaseUrl()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { notebookId, prompt } = await request.json();
    const trimmedPrompt = String(prompt || "").trim();

    if (!notebookId) {
      return NextResponse.json({ error: "Missing notebookId" }, { status: 400 });
    }

    if (!trimmedPrompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GOOGLE_GEMINI_API_KEY is not configured" }, { status: 503 });
    }

    const sourcesResp = await notebookFetch(`/api/sources?notebook_id=${encodeURIComponent(notebookId)}`, "GET");
    if (!sourcesResp.ok) {
      const text = await sourcesResp.text();
      return NextResponse.json(
        { error: `Failed to load notebook sources: ${sourcesResp.status} ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const sources = await sourcesResp.json();
    if (!Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json({ error: "No sources found in this notebook yet" }, { status: 400 });
    }

    const sourceTexts: string[] = [];
    for (const source of sources.slice(0, 5)) {
      try {
        const detailResp = await notebookFetch(`/api/sources/${encodeURIComponent(source.id)}`, "GET");
        if (!detailResp.ok) continue;
        const detail = await detailResp.json();
        const text = detail.full_text || source.full_text || source.content || "";
        if (typeof text === "string" && text.length >= 50) {
          sourceTexts.push(`### ${source.title || "Source"}\n${text.slice(0, 8000)}`);
        }
      } catch (error) {
        console.error("[notebook-transform] source fetch failed:", error);
      }
    }

    if (sourceTexts.length === 0) {
      return NextResponse.json({ error: "No usable source content available to transform" }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: AI_MODELS.basic });
    const result = await model.generateContent(`You are transforming notebook source material into a new study artifact.

Follow the user's instruction exactly, but only use facts and concepts that appear in the provided source material.

Rules:
- Do not invent facts or bring in outside information.
- Preserve important names, dates, figures, definitions, and examples from the sources when relevant.
- Format the output in clean markdown.
- Start with a short markdown title line beginning with "# ".

USER TRANSFORMATION REQUEST:
${trimmedPrompt}

SOURCE CONTENT:
${sourceTexts.join("\n\n---\n\n").slice(0, 30000)}`);

    const content = result.response.text().trim();
    if (!content) {
      return NextResponse.json({ error: "Gemini returned empty content" }, { status: 502 });
    }

    const firstLine = content.split("\n").find((line) => line.trim());
    const title = firstLine?.replace(/^#+\s*/, "").trim() || `Transform: ${trimmedPrompt.slice(0, 60)}`;

    const saveResp = await notebookFetch("/api/notes", "POST", {
      title,
      content,
      note_type: "ai",
      notebook_id: notebookId,
    });

    if (!saveResp.ok) {
      const text = await saveResp.text();
      return NextResponse.json(
        { error: `Failed to save transformed note: ${saveResp.status} ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const note = await saveResp.json();
    return NextResponse.json({ success: true, note });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[notebook-transform] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
