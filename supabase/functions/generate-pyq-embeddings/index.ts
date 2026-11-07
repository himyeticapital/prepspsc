// Supabase Edge Function for generating embeddings for PYQ questions
// Deploy with: npx supabase functions deploy generate-pyq-embeddings --project-ref <your-project-ref> --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface EmbeddingResult {
  id: string;
  success: boolean;
  error?: string;
}

function buildEmbeddingText(question: any): string {
  const parts: string[] = [question.question];

  if (question.subject) {
    parts.push(`Subject: ${question.subject}`);
  }

  if (question.topics && Array.isArray(question.topics) && question.topics.length > 0) {
    parts.push(`Topics: ${question.topics.join(", ")}`);
  }

  if (question.subtopic) {
    parts.push(`Subtopic: ${question.subtopic}`);
  }

  if (question.options && Array.isArray(question.options)) {
    const optionTexts = question.options.map((o: any) => o.text).filter(Boolean);
    if (optionTexts.length > 0) {
      parts.push(`Options: ${optionTexts.join(" | ")}`);
    }
  }

  return parts.join("\n");
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Supabase not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

    const body = await req.json();
    const { mode, questionIds, batchOffset, batchLimit } = body;

    if (!mode || !["backfill", "single"].includes(mode)) {
      return new Response(
        JSON.stringify({ error: "Invalid mode. Supported: backfill, single" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let questions: any[] = [];

    if (mode === "backfill") {
      const offset = batchOffset || 0;
      const limit = batchLimit || 20;

      // Fetch questions without embeddings
      const { data, error } = await supabase
        .from("pyq_questions")
        .select("*")
        .is("embedding", null)
        .order("created_at", { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error("[generate-pyq-embeddings] Error fetching questions:", error);
        return new Response(
          JSON.stringify({ error: "Failed to fetch questions", details: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      questions = data || [];

      // Count remaining
      const { count: totalRemaining } = await supabase
        .from("pyq_questions")
        .select("*", { count: "exact", head: true })
        .is("embedding", null);

      console.log(`[generate-pyq-embeddings] Backfill: fetched ${questions.length}, total remaining: ${totalRemaining}`);
    } else if (mode === "single") {
      if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
        return new Response(
          JSON.stringify({ error: "questionIds array is required for single mode" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("pyq_questions")
        .select("*")
        .in("id", questionIds);

      if (error) {
        console.error("[generate-pyq-embeddings] Error fetching questions:", error);
        return new Response(
          JSON.stringify({ error: "Failed to fetch questions", details: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      questions = data || [];
    }

    if (questions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, failed: 0, message: "No questions to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process each question
    const results: EmbeddingResult[] = [];
    let processed = 0;
    let failed = 0;

    for (const question of questions) {
      try {
        const text = buildEmbeddingText(question);
        console.log(`[generate-pyq-embeddings] Embedding: ${question.question.substring(0, 60)}...`);

        const embeddingResult = await model.embedContent({
          content: { parts: [{ text }], role: "user" },
          taskType: "RETRIEVAL_DOCUMENT" as any,
          outputDimensionality: 768,
        } as any);

        const embeddingValues = embeddingResult.embedding.values;

        // Store embedding as JSON string (pgvector accepts this format)
        const { error: updateError } = await supabase
          .from("pyq_questions")
          .update({ embedding: JSON.stringify(embeddingValues) })
          .eq("id", question.id);

        if (updateError) {
          console.error(`[generate-pyq-embeddings] Update error for ${question.id}:`, updateError);
          results.push({ id: question.id, success: false, error: updateError.message });
          failed++;
        } else {
          results.push({ id: question.id, success: true });
          processed++;
        }

        // Rate limiting: 100ms between items
        await delay(100);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[generate-pyq-embeddings] Error for ${question.id}:`, errMsg);

        // Handle rate limiting (429)
        if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("rate")) {
          console.log("[generate-pyq-embeddings] Rate limited, waiting 5s...");
          await delay(5000);
          // Retry once
          try {
            const text = buildEmbeddingText(question);
            const retryResult = await model.embedContent({
              content: { parts: [{ text }], role: "user" },
              taskType: "RETRIEVAL_DOCUMENT" as any,
              outputDimensionality: 768,
            } as any);

            const { error: retryUpdateError } = await supabase
              .from("pyq_questions")
              .update({ embedding: JSON.stringify(retryResult.embedding.values) })
              .eq("id", question.id);

            if (retryUpdateError) {
              results.push({ id: question.id, success: false, error: retryUpdateError.message });
              failed++;
            } else {
              results.push({ id: question.id, success: true });
              processed++;
            }
          } catch (retryErr: unknown) {
            const retryMsg = retryErr instanceof Error ? retryErr.message : "Retry failed";
            results.push({ id: question.id, success: false, error: retryMsg });
            failed++;
          }
        } else {
          results.push({ id: question.id, success: false, error: errMsg });
          failed++;
        }
      }
    }

    // Build response
    const response: any = {
      success: true,
      processed,
      failed,
    };

    if (mode === "backfill") {
      // Count remaining after this batch
      const { count: remaining } = await supabase
        .from("pyq_questions")
        .select("*", { count: "exact", head: true })
        .is("embedding", null);

      response.remaining = remaining || 0;
      response.nextOffset = (batchOffset || 0) + questions.length;
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[generate-pyq-embeddings] Error:", errorMessage);

    if (errorMessage.includes("429") || errorMessage.includes("quota")) {
      return new Response(
        JSON.stringify({ error: "AI service is busy. Please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Failed to generate embeddings. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
