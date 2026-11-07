// Supabase Edge Function: Open Notebook Proxy
// Routes requests to Open Notebook API, Scrapling, and Tavily

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

function errorResponse(error: string, status: number) {
  return jsonResponse({ error, status }, status);
}

// ==================== YOUTUBE → GEMINI EXTRACTION ====================
// YouTube blocks transcript API from cloud IPs (AWS, GCP, Azure) AND
// from server-side fetches (empty captions even with cookies/consent).
// Solution: Use Google Gemini to process YouTube videos directly —
// Gemini can watch videos and extract structured notes/transcripts.
// Uses gemini-3.1-flash-lite-preview (cheapest model, $0.25/1M tokens).

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/i.test(url);
}

async function extractYouTubeWithGemini(videoUrl: string): Promise<{ title: string; content: string }> {
  const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  if (!apiKey) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

  // Use flash for video understanding — lite doesn't support video input
  const model = Deno.env.get("GEMINI_BASIC_MODEL") ?? "gemini-3.1-flash-lite"; // cheap default (see src/lib/ai-models.ts)

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              fileData: {
                mimeType: "video/*",
                fileUri: videoUrl,
              },
            },
            {
              text: `You are a study notes extractor for competitive exam preparation (UPSC, State PSC, CSAT, JEE, NEET).

Watch this entire video and extract comprehensive, detailed study notes.

Include:
- ALL key concepts, definitions, and terminology explained in the video
- Important facts, dates, figures, and data points mentioned
- Step-by-step explanations and worked examples
- Formulas, equations, or frameworks discussed
- Tips, tricks, shortcuts, and mnemonics shared by the instructor
- Practice problems and their solutions if shown

Format as clean markdown with ## headers for main topics, ### for subtopics, bullet points, and **bold key terms**.
On the very first line, write ONLY the video title prefixed with "TITLE: " (nothing else on that line).

Rules:
- Only include information ACTUALLY presented in the video. Do NOT hallucinate or add external information.
- Every bullet must contain a specific fact, concept, or example from the video.
- Do NOT write generic or motivational statements.`,
            },
          ],
        }],
      }),
    },
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API error: ${resp.status} ${errText.slice(0, 200)}`);
  }

  const data = await resp.json();
  // deno-lint-ignore no-explicit-any
  const content = (data as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    // deno-lint-ignore no-explicit-any
    const reason = (data as any)?.candidates?.[0]?.finishReason;
    throw new Error(`Gemini returned no content (reason: ${reason || "unknown"})`);
  }

  // Extract title from first line
  const lines = content.split("\n");
  let title = "YouTube Video";
  const titleLine = lines.find((l: string) => l.startsWith("TITLE: "));
  if (titleLine) {
    title = titleLine.replace("TITLE: ", "").replace(/^#+\s*/, "").trim();
  }

  const cleanContent = lines
    .filter((l: string) => !l.startsWith("TITLE: "))
    .join("\n")
    .trim();

  console.log(`[youtube-gemini] Extracted notes: "${title}" (${cleanContent.length} chars)`);

  return { title, content: cleanContent };
}

// Trigger embedding for a newly created source (fire-and-forget)
async function triggerEmbedding(sourceId: string) {
  try {
    console.log(`[embed] Triggering embedding for ${sourceId}`);
    await notebookFetch("/api/embed", "POST", {
      item_id: sourceId,
      item_type: "source",
      async_processing: true,
    });
  } catch (e) {
    console.warn(`[embed] Failed to trigger embedding:`, (e as Error).message);
  }
}

// Forward a request to Open Notebook API
async function notebookFetch(
  path: string,
  method: string,
  body?: unknown,
  isMultipart = false,
  multipartBody?: FormData,
): Promise<Response> {
  const baseUrl = Deno.env.get("OPEN_NOTEBOOK_URL");
  if (!baseUrl) throw new Error("OPEN_NOTEBOOK_URL not configured");

  const secret = Deno.env.get("OPEN_NOTEBOOK_SECRET") || "";
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    "X-Internal-Secret": secret,
  };
  if (!isMultipart) {
    headers["Content-Type"] = "application/json";
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body && !isMultipart) {
    fetchOptions.body = JSON.stringify(body);
  } else if (isMultipart && multipartBody) {
    fetchOptions.body = multipartBody;
  }

  const resp = await fetch(url, fetchOptions);
  return resp;
}

// Forward response from Open Notebook back to client
async function proxyJsonResponse(resp: Response): Promise<Response> {
  const status = resp.status;
  const text = await resp.text();
  try {
    const data = JSON.parse(text);
    return jsonResponse(data, status);
  } catch {
    return jsonResponse({ raw: text }, status);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth: extract JWT, verify user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Unauthorized", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return errorResponse("Unauthorized", 401);
    }

    // Parse request body
    const contentType = req.headers.get("content-type") || "";
    let action: string;
    let payload: Record<string, unknown> = {};
    let formData: FormData | undefined;

    if (contentType.includes("multipart/form-data")) {
      formData = await req.formData();
      action = formData.get("action") as string;
      // Extract other fields from formData into payload
      for (const [key, value] of formData.entries()) {
        if (key !== "action" && key !== "file") {
          payload[key] = value;
        }
      }
    } else {
      const body = await req.json();
      action = body.action;
      payload = body;
    }

    if (!action) {
      return errorResponse("Missing 'action' field", 400);
    }

    // Route based on action
    switch (action) {
      // ==================== NOTEBOOKS ====================
      case "create_notebook": {
        const resp = await notebookFetch("/api/notebooks", "POST", {
          name: payload.title || payload.name,
          description: payload.description || "",
        });
        return proxyJsonResponse(resp);
      }

      case "list_notebooks": {
        const resp = await notebookFetch("/api/notebooks", "GET");
        return proxyJsonResponse(resp);
      }

      case "get_notebook": {
        const resp = await notebookFetch(
          `/api/notebooks/${encodeURIComponent(payload.notebook_id as string)}`,
          "GET",
        );
        return proxyJsonResponse(resp);
      }

      case "delete_notebook": {
        const resp = await notebookFetch(
          `/api/notebooks/${encodeURIComponent(payload.notebook_id as string)}`,
          "DELETE",
        );
        return proxyJsonResponse(resp);
      }

      case "link_notebook_source": {
        const resp = await notebookFetch(
          `/api/notebooks/${payload.notebook_id}/sources/${payload.source_id}`,
          "POST",
        );
        return proxyJsonResponse(resp);
      }

      // ==================== SOURCES ====================
      case "list_sources": {
        const resp = await notebookFetch(
          `/api/sources?notebook_id=${payload.notebook_id}`,
          "GET",
        );
        return proxyJsonResponse(resp);
      }

      // Unified add_source — dispatches by source_type field
      case "add_source": {
        const sourceType = payload.source_type as string;
        const sourceUrl = payload.url as string;

        // YouTube URLs: use Gemini to extract notes (transcript API blocked on cloud + server IPs)
        if ((sourceType === "url" || sourceType === "youtube") && sourceUrl && isYouTubeUrl(sourceUrl)) {
          console.log(`[add_source] YouTube detected — extracting via Gemini: ${sourceUrl}`);
          try {
            const { title, content } = await extractYouTubeWithGemini(sourceUrl);

            // Send extracted notes as text source to Open Notebook
            const f = new FormData();
            f.append("type", "text");
            f.append("content", `# ${title}\n\nSource: ${sourceUrl}\n\n${content}`);
            f.append("notebook_id", payload.notebook_id as string);
            f.append("async_processing", "true");
            f.append("embed", "true");
            const resp = await notebookFetch("/api/sources", "POST", undefined, true, f);
            const sourceData = await resp.json();

            // Update the source title (text sources default to "Processing...")
            if (sourceData?.id) {
              try {
                await notebookFetch(
                  `/api/sources/${encodeURIComponent(sourceData.id)}`,
                  "PUT",
                  { title },
                );
                sourceData.title = title;
              } catch (e) {
                console.warn(`[add_source] Failed to update YouTube source title:`, (e as Error).message);
              }
            }

            return jsonResponse({ ...sourceData, youtube_title: title });
          } catch (ytErr) {
            console.error(`[add_source] YouTube extraction failed: ${(ytErr as Error).message}`);
            return errorResponse(`YouTube extraction failed: ${(ytErr as Error).message}`, 422);
          }
        }

        if (sourceType === "url" || sourceType === "youtube") {
          // Non-YouTube URLs: async processing via Open Notebook worker
          const f = new FormData();
          f.append("type", "link");
          f.append("url", sourceUrl);
          f.append("notebook_id", payload.notebook_id as string);
          f.append("async_processing", "true");
          f.append("embed", "true");
          console.log(`[add_source] Async ${sourceType}: ${sourceUrl}`);
          const resp = await notebookFetch("/api/sources", "POST", undefined, true, f);
          const sourceData = await resp.json();
          return jsonResponse(sourceData);
        } else if (sourceType === "text") {
          const f = new FormData();
          f.append("type", "text");
          f.append("content", payload.content as string);
          f.append("notebook_id", payload.notebook_id as string);
          f.append("async_processing", "true");
          f.append("embed", "true");
          const resp = await notebookFetch("/api/sources", "POST", undefined, true, f);
          const sourceData = await resp.json();
          return jsonResponse(sourceData);
        }
        return errorResponse(`Unknown source_type: ${sourceType}`, 400);
      }

      case "add_source_url": {
        // Step 1: Scrape the URL via Scrapling
        const scraplingUrl = Deno.env.get("SCRAPLING_URL");
        const scraplingSecret = Deno.env.get("SCRAPLING_SECRET") || "";

        if (!scraplingUrl) {
          return errorResponse("SCRAPLING_URL not configured", 503);
        }

        const scrapeResp = await fetch(`${scraplingUrl}/scrape`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Secret": scraplingSecret,
          },
          body: JSON.stringify({ url: payload.url }),
        });

        if (!scrapeResp.ok) {
          const errText = await scrapeResp.text();
          return errorResponse(
            `Scrapling failed: ${errText}`,
            scrapeResp.status,
          );
        }

        const scraped = await scrapeResp.json();

        // Step 2: Send scraped text to Open Notebook as text source
        const sourceForm = new FormData();
        sourceForm.append("type", "text");
        sourceForm.append(
          "content",
          scraped.text || scraped.content || "",
        );
        sourceForm.append("notebook_id", payload.notebook_id as string);

        const resp = await notebookFetch(
          "/api/sources",
          "POST",
          undefined,
          true,
          sourceForm,
        );
        const srcData = await resp.json();
        if (srcData?.id) triggerEmbedding(srcData.id);
        return jsonResponse(srcData);
      }

      case "add_source_text": {
        const sourceForm = new FormData();
        sourceForm.append("type", "text");
        sourceForm.append("content", payload.content as string);
        sourceForm.append("notebook_id", payload.notebook_id as string);

        const resp = await notebookFetch(
          "/api/sources",
          "POST",
          undefined,
          true,
          sourceForm,
        );
        const txtData = await resp.json();
        if (txtData?.id) triggerEmbedding(txtData.id);
        return jsonResponse(txtData);
      }

      case "add_source_youtube": {
        const sourceForm = new FormData();
        sourceForm.append("type", "link");
        sourceForm.append("url", payload.url as string);
        sourceForm.append("notebook_id", payload.notebook_id as string);

        const resp = await notebookFetch(
          "/api/sources",
          "POST",
          undefined,
          true,
          sourceForm,
        );
        const ytData = await resp.json();
        if (ytData?.id) triggerEmbedding(ytData.id);
        return jsonResponse(ytData);
      }

      case "add_source_file": {
        if (!formData) {
          return errorResponse(
            "add_source_file requires multipart/form-data with a 'file' field",
            400,
          );
        }
        const file = formData.get("file");
        if (!file) {
          return errorResponse("Missing 'file' in form data", 400);
        }

        const uploadForm = new FormData();
        uploadForm.append("type", "upload");
        uploadForm.append("file", file);
        uploadForm.append(
          "notebook_id",
          (payload.notebook_id || formData.get("notebook_id")) as string,
        );

        const resp = await notebookFetch(
          "/api/sources",
          "POST",
          undefined,
          true,
          uploadForm,
        );
        const fileData = await resp.json();
        if (fileData?.id) triggerEmbedding(fileData.id);
        return jsonResponse(fileData);
      }

      case "retry_source": {
        // Manually submit a process_source command via /api/commands/jobs
        // This bypasses the broken LIVE query worker — commands will be processed
        // when the worker restarts (it bootstraps all status='new' commands on startup)
        const sourceId = payload.source_id as string;
        const notebookId = payload.notebook_id as string;
        if (!sourceId || !notebookId) {
          return errorResponse("retry_source requires source_id and notebook_id", 400);
        }
        console.log(`[retry_source] Submitting process_source job for ${sourceId}`);
        const jobResp = await notebookFetch("/api/commands/jobs", "POST", {
          command: "process_source",
          app: "open_notebook",
          input: {
            source_id: sourceId,
            content_state: {},
            notebook_ids: [notebookId],
            transformations: [],
            embed: true,
          },
        });
        if (!jobResp.ok) {
          const errText = await jobResp.text();
          console.error(`[retry_source] Failed: ${errText}`);
          return errorResponse(`Failed to submit retry: ${errText}`, jobResp.status);
        }
        const jobData = await jobResp.json();
        return jsonResponse({ ...jobData, source_id: sourceId });
      }

      case "get_source_status": {
        const resp = await notebookFetch(
          `/api/sources/${payload.source_id}/status`,
          "GET",
        );
        return proxyJsonResponse(resp);
      }

      case "get_source_insights": {
        const resp = await notebookFetch(
          `/api/sources/${payload.source_id}/insights`,
          "GET",
        );
        return proxyJsonResponse(resp);
      }

      case "delete_source": {
        const resp = await notebookFetch(
          `/api/sources/${encodeURIComponent(payload.source_id as string)}`,
          "DELETE",
        );
        return proxyJsonResponse(resp);
      }

      // ==================== NOTES ====================
      case "list_notes": {
        const resp = await notebookFetch(
          `/api/notes?notebook_id=${payload.notebook_id}`,
          "GET",
        );
        return proxyJsonResponse(resp);
      }

      case "create_note": {
        const resp = await notebookFetch("/api/notes", "POST", {
          title: payload.title,
          content: payload.content,
          note_type: payload.note_type || "human",
          notebook_id: payload.notebook_id,
        });
        return proxyJsonResponse(resp);
      }

      case "update_note": {
        const resp = await notebookFetch(
          `/api/notes/${encodeURIComponent(payload.note_id as string)}`,
          "PUT",
          {
            title: payload.title,
            content: payload.content,
          },
        );
        return proxyJsonResponse(resp);
      }

      case "get_note": {
        const resp = await notebookFetch(
          `/api/notes/${encodeURIComponent(payload.note_id as string)}`,
          "GET",
        );
        return proxyJsonResponse(resp);
      }

      case "delete_note": {
        const resp = await notebookFetch(
          `/api/notes/${encodeURIComponent(payload.note_id as string)}`,
          "DELETE",
        );
        return proxyJsonResponse(resp);
      }

      // ==================== CHAT ====================
      case "list_chat_sessions": {
        const resp = await notebookFetch(
          `/api/chat/sessions?notebook_id=${payload.notebook_id}`,
          "GET",
        );
        return proxyJsonResponse(resp);
      }

      case "create_chat_session": {
        const resp = await notebookFetch("/api/chat/sessions", "POST", {
          notebook_id: payload.notebook_id,
          title: payload.title,
        });
        return proxyJsonResponse(resp);
      }

      case "get_chat_session": {
        const resp = await notebookFetch(
          `/api/chat/sessions/${encodeURIComponent(payload.session_id as string)}`,
          "GET",
        );
        return proxyJsonResponse(resp);
      }

      case "get_chat_messages": {
        const resp = await notebookFetch(
          `/api/chat/sessions/${encodeURIComponent(payload.session_id as string)}`,
          "GET",
        );
        const session = await resp.json();
        // Convert Open Notebook {type:"human"/"ai"} to frontend {role:"user"/"assistant"}
        const messages = (session.messages || []).map((m: { type: string; content: string }) => ({
          role: m.type === "human" ? "user" : "assistant",
          content: m.content,
        }));
        return jsonResponse({ messages });
      }

      case "send_chat_message": {
        // Build context from notebook if notebook_id provided (required by Open Notebook)
        let context: { sources: unknown[]; notes: unknown[] } = { sources: [], notes: [] };
        if (payload.notebook_id) {
          try {
            const ctxResp = await notebookFetch("/api/chat/context", "POST", {
              notebook_id: payload.notebook_id,
              context_config: {},
            });
            const ctxData = await ctxResp.json();
            context = ctxData.context || context;
          } catch (_e) {
            // fallback to empty context
          }
        }

        const resp = await notebookFetch("/api/chat/execute", "POST", {
          session_id: payload.session_id,
          message: payload.message,
          context,
        });
        const result = await resp.json();
        // Extract the last AI message as the reply
        const messages = result.messages || [];
        const aiMsg = [...messages].reverse().find((m: { type: string }) => m.type === "ai");
        return jsonResponse({ reply: aiMsg?.content || "", messages, session_id: result.session_id });
      }

      case "build_chat_context": {
        const resp = await notebookFetch("/api/chat/context", "POST", {
          notebook_id: payload.notebook_id,
          context_config: payload.context_config || {},
        });
        return proxyJsonResponse(resp);
      }

      // ==================== GENERATE NOTES ====================
      case "generate_notes": {
        // Get sources for this notebook, then use Gemini to generate proper study notes
        const sourcesResp = await notebookFetch(
          `/api/sources?notebook_id=${payload.notebook_id}`, "GET"
        );
        const sources = await sourcesResp.json();
        if (!Array.isArray(sources) || sources.length === 0) {
          return jsonResponse({ notes: [], message: "No sources to generate notes from" });
        }

        const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
        if (!geminiKey) {
          return errorResponse("GOOGLE_GEMINI_API_KEY not configured", 503);
        }

        const noteResults: Record<string, unknown>[] = [];
        for (const source of sources.slice(0, 5)) {
          try {
            // Fetch full source detail to get full_text
            const srcDetailResp = await notebookFetch(`/api/sources/${encodeURIComponent(source.id)}`, "GET");
            const srcDetail = await srcDetailResp.json();
            const text = srcDetail.full_text || source.full_text || source.content || "";
            if (!text || text.length < 50) {
              console.log(`[generate_notes] Skipping source ${source.id}: text too short (${text.length} chars)`);
              continue;
            }

            console.log(`[generate_notes] Generating notes for: ${source.title} (${text.length} chars)`);

            // Use Gemini to generate actual study notes from source content
            const geminiResp = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${geminiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{
                    parts: [{
                      text: `You are an expert study notes creator for competitive exam preparation (UPSC, State PSC, CSAT).

Create comprehensive study notes from the following source content. The notes must:

1. **Extract ALL key facts, definitions, formulas, and concepts** from the source
2. **Include specific examples, numbers, and data** mentioned in the source
3. **Organize with clear markdown headers** (##, ###) by topic/subtopic
4. **Bold key terms** and use bullet points for easy revision
5. **Include any practice problems, tips, or tricks** mentioned
6. **Add a "Quick Revision" section** at the end with the most important points

Do NOT add information that isn't in the source. Only extract and organize what's actually there.

SOURCE TITLE: ${source.title || "Unknown"}
SOURCE CONTENT:
${text.slice(0, 12000)}`,
                    }],
                  }],
                }),
              },
            );

            if (!geminiResp.ok) {
              console.error(`[generate_notes] Gemini error for ${source.id}: ${geminiResp.status}`);
              continue;
            }

            const geminiData = await geminiResp.json();
            // deno-lint-ignore no-explicit-any
            const noteContent = (geminiData as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!noteContent) {
              console.warn(`[generate_notes] No content from Gemini for ${source.id}`);
              continue;
            }

            // Save as note in Open Notebook
            const noteResp = await notebookFetch("/api/notes", "POST", {
              title: `Study Notes: ${source.title || "Source"}`,
              content: noteContent,
              note_type: "ai",
              notebook_id: payload.notebook_id,
            });
            const note = await noteResp.json();
            noteResults.push(note);
          } catch (e) {
            console.error(`[generate_notes] Error processing source ${source.id}:`, (e as Error).message);
          }
        }
        return jsonResponse({ notes: noteResults, count: noteResults.length });
      }

      case "transform": {
        if (!payload.notebook_id) {
          return errorResponse("transform requires notebook_id", 400);
        }

        const prompt = String(payload.prompt || "").trim();
        if (!prompt) {
          return errorResponse("transform requires prompt", 400);
        }

        const sourcesResp = await notebookFetch(
          `/api/sources?notebook_id=${payload.notebook_id}`,
          "GET",
        );
        const sources = await sourcesResp.json();
        if (!Array.isArray(sources) || sources.length === 0) {
          return jsonResponse({ notes: [], message: "No sources to transform" });
        }

        const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
        if (!geminiKey) {
          return errorResponse("GOOGLE_GEMINI_API_KEY not configured", 503);
        }

        const sourceTexts: string[] = [];
        for (const source of sources.slice(0, 5)) {
          try {
            const srcDetailResp = await notebookFetch(
              `/api/sources/${encodeURIComponent(source.id)}`,
              "GET",
            );
            const srcDetail = await srcDetailResp.json();
            const text = srcDetail.full_text || source.full_text || source.content || "";
            if (text.length >= 50) {
              sourceTexts.push(`### ${source.title || "Source"}\n${text.slice(0, 8000)}`);
            }
          } catch (e) {
            console.error(`[transform] Error fetching source ${source.id}:`, (e as Error).message);
          }
        }

        if (sourceTexts.length === 0) {
          return jsonResponse({ notes: [], message: "No source content available" });
        }

        const combinedText = sourceTexts.join("\n\n---\n\n").slice(0, 30000);

        try {
          const geminiResp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{
                  parts: [{
                    text: `You are transforming notebook source material into a new study artifact.

Follow the user's instruction exactly, but only use facts and concepts that appear in the provided source material.

Rules:
- Do not invent facts or bring in outside information.
- Preserve important names, dates, figures, definitions, and examples from the sources when relevant.
- Format the output in clean markdown.
- Start with a short markdown title line beginning with "# ".

USER TRANSFORMATION REQUEST:
${prompt}

SOURCE CONTENT:
${combinedText}`,
                  }],
                }],
              }),
            },
          );

          if (!geminiResp.ok) {
            const errText = await geminiResp.text();
            console.error(`[transform] Gemini error: ${geminiResp.status} ${errText.slice(0, 200)}`);
            return errorResponse(`AI transformation failed: ${geminiResp.status}`, 500);
          }

          const geminiData = await geminiResp.json();
          // deno-lint-ignore no-explicit-any
          const content = (geminiData as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!content) {
            return errorResponse("AI returned no transformed content", 500);
          }

          const firstLine = content.split("\n").find((line: string) => line.trim());
          const title = firstLine?.replace(/^#+\s*/, "").trim() || `Transform: ${prompt.slice(0, 60)}`;

          const noteResp = await notebookFetch("/api/notes", "POST", {
            title,
            content,
            note_type: "ai",
            notebook_id: payload.notebook_id,
          });
          const note = await noteResp.json();
          return jsonResponse({ notes: [note], count: 1, note });
        } catch (e) {
          console.error("[transform] Error:", (e as Error).message);
          return errorResponse(`Transformation failed: ${(e as Error).message}`, 500);
        }
      }

      // ==================== GENERATE FLASHCARDS / QUIZ / INFOGRAPHIC / SLIDES ====================
      case "generate_flashcards":
      case "generate_quiz":
      case "generate_infographic":
      case "generate_slides": {
        const sourcesResp = await notebookFetch(
          `/api/sources?notebook_id=${payload.notebook_id}`, "GET"
        );
        const sources = await sourcesResp.json();
        if (!Array.isArray(sources) || sources.length === 0) {
          return jsonResponse({ notes: [], message: "No sources to generate from" });
        }

        const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
        if (!geminiKey) {
          return errorResponse("GOOGLE_GEMINI_API_KEY not configured", 503);
        }

        // Collect source texts (up to 5 sources, 8k chars each)
        const sourceTexts: string[] = [];
        for (const source of sources.slice(0, 5)) {
          try {
            const srcDetailResp = await notebookFetch(`/api/sources/${encodeURIComponent(source.id)}`, "GET");
            const srcDetail = await srcDetailResp.json();
            const text = srcDetail.full_text || source.full_text || source.content || "";
            if (text.length >= 50) {
              sourceTexts.push(`### ${source.title || "Source"}\n${text.slice(0, 8000)}`);
            }
          } catch (e) {
            console.error(`[${action}] Error fetching source ${source.id}:`, (e as Error).message);
          }
        }

        if (sourceTexts.length === 0) {
          return jsonResponse({ notes: [], message: "No source content available" });
        }

        const combinedText = sourceTexts.join("\n\n---\n\n").slice(0, 30000);

        const prompts: Record<string, { system: string; title: string }> = {
          generate_flashcards: {
            system: `Create flashcards from the source content for competitive exam preparation (UPSC, State PSC).

Format each flashcard as:
## Card N
**Q:** [Question testing a key concept, fact, or definition]
**A:** [Concise, accurate answer]

Create 15-25 flashcards covering ALL important facts, definitions, dates, and concepts from the sources.
Focus on exam-relevant content. Include specific details, not vague summaries.`,
            title: "Flashcards",
          },
          generate_quiz: {
            system: `Create a practice quiz from the source content for competitive exam preparation (UPSC, State PSC).

Format as:
## Question N
**Q:** [Multiple choice question]
- (a) [Option]
- (b) [Option]
- (c) [Option]
- (d) [Option]

**Answer:** (X) [Correct option]
**Explanation:** [Brief explanation why this is correct]

Create 10-15 questions covering key concepts. Include a mix of factual recall, conceptual understanding, and application questions. All questions and answers must come directly from the source content.`,
            title: "Quiz",
          },
          generate_infographic: {
            system: `Create a text-based infographic summary from the source content for competitive exam preparation.

Format as a visually structured text document:
# [Topic Title]

## Key Statistics & Numbers
- [Important numbers, dates, percentages from the source]

## Core Concepts (use emoji bullets for visual distinction)
🔹 **[Concept 1]:** Brief explanation
🔹 **[Concept 2]:** Brief explanation

## Timeline / Process Flow
1. **Step/Event 1** → Key detail
2. **Step/Event 2** → Key detail

## Comparison Table (if applicable)
| Aspect | Point A | Point B |
|--------|---------|---------|

## Key Takeaways
✅ [Most important point 1]
✅ [Most important point 2]
✅ [Most important point 3]

Make it dense with specific facts from the sources. Structure for quick visual scanning.`,
            title: "Infographic",
          },
          generate_slides: {
            system: `Create presentation slides from the source content for competitive exam preparation.

Format each slide as:
## Slide N: [Slide Title]
- [Key point 1]
- [Key point 2]
- [Key point 3]
> Speaker note: [What to say about this slide]

Create 8-15 slides covering:
1. Title slide with topic overview
2. Key concepts and definitions
3. Important facts, dates, and figures
4. Examples and case studies from the source
5. Summary/revision slide

Keep bullet points concise (max 8 words each). Put details in speaker notes.`,
            title: "Slides",
          },
        };

        const config = prompts[action];
        console.log(`[${action}] Generating from ${sourceTexts.length} sources`);

        try {
          const geminiResp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{
                  parts: [{
                    text: `${config.system}\n\nSOURCE CONTENT:\n${combinedText}`,
                  }],
                }],
              }),
            },
          );

          if (!geminiResp.ok) {
            const errText = await geminiResp.text();
            console.error(`[${action}] Gemini error: ${geminiResp.status} ${errText.slice(0, 200)}`);
            return errorResponse(`AI generation failed: ${geminiResp.status}`, 500);
          }

          const geminiData = await geminiResp.json();
          // deno-lint-ignore no-explicit-any
          const content = (geminiData as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!content) {
            return errorResponse("AI returned no content", 500);
          }

          // Save as note
          const noteResp = await notebookFetch("/api/notes", "POST", {
            title: `${config.title}: ${sources[0]?.title || "Notebook"}`,
            content,
            note_type: "ai",
            notebook_id: payload.notebook_id,
          });
          const note = await noteResp.json();
          return jsonResponse({ notes: [note], count: 1 });
        } catch (e) {
          console.error(`[${action}] Error:`, (e as Error).message);
          return errorResponse(`Generation failed: ${(e as Error).message}`, 500);
        }
      }

      case "delete_chat_session": {
        const resp = await notebookFetch(
          `/api/chat/sessions/${encodeURIComponent(payload.session_id as string)}`,
          "DELETE",
        );
        return proxyJsonResponse(resp);
      }

      // ==================== PODCASTS ====================
      case "generate_podcast": {
        const resp = await notebookFetch("/api/podcasts/generate", "POST", {
          episode_profile: payload.episode_profile,
          speaker_profile: payload.speaker_profile,
          episode_name: payload.episode_name,
          content: payload.content,
          notebook_id: payload.notebook_id,
        });
        return proxyJsonResponse(resp);
      }

      case "get_podcast_job": {
        const resp = await notebookFetch(
          `/api/podcasts/jobs/${payload.job_id}`,
          "GET",
        );
        return proxyJsonResponse(resp);
      }

      case "list_episodes": {
        const resp = await notebookFetch("/api/podcasts/episodes", "GET");
        return proxyJsonResponse(resp);
      }

      case "get_episode_audio": {
        // Proxy binary audio response
        const baseUrl = Deno.env.get("OPEN_NOTEBOOK_URL");
        if (!baseUrl) return errorResponse("OPEN_NOTEBOOK_URL not configured", 503);

        const secret = Deno.env.get("OPEN_NOTEBOOK_SECRET") || "";
        const audioResp = await fetch(
          `${baseUrl}/api/podcasts/episodes/${payload.episode_id}/audio`,
          {
            headers: { "X-Internal-Secret": secret },
          },
        );

        if (!audioResp.ok) {
          return errorResponse(
            `Failed to fetch audio: ${audioResp.statusText}`,
            audioResp.status,
          );
        }

        const audioBody = audioResp.body;
        const audioContentType =
          audioResp.headers.get("content-type") || "audio/mpeg";

        return new Response(audioBody, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": audioContentType,
          },
        });
      }

      // ==================== WEB SEARCH (TAVILY) ====================
      case "web_search": {
        const tavilyKey = Deno.env.get("TAVILY_API_KEY");
        if (!tavilyKey) {
          return errorResponse("TAVILY_API_KEY not configured", 503);
        }

        const searchResp = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: payload.query,
            max_results: payload.max_results || 8,
            search_depth: payload.search_depth || "basic",
          }),
        });

        if (!searchResp.ok) {
          const errText = await searchResp.text();
          return errorResponse(
            `Tavily search failed: ${errText}`,
            searchResp.status,
          );
        }

        const searchData = await searchResp.json();
        return jsonResponse(searchData);
      }

      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[open-notebook-proxy] Error:", message);
    return errorResponse(`Internal error: ${message}`, 500);
  }
});
