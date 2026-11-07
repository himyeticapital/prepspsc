/**
 * Backfill PYQ Embeddings Script
 * Run with: npx tsx scripts/backfill-pyq-embeddings.ts
 *
 * Generates embeddings for all PYQ questions that don't have one yet.
 * Idempotent: only processes rows where embedding IS NULL.
 *
 * Required .env.local variables:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - GOOGLE_GEMINI_API_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

if (!geminiApiKey) {
  console.error("Missing GOOGLE_GEMINI_API_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const genAI = new GoogleGenerativeAI(geminiApiKey);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

const BATCH_SIZE = 10;
const DELAY_BETWEEN_ITEMS_MS = 150;
const DELAY_BETWEEN_BATCHES_MS = 2000;
const RATE_LIMIT_WAIT_MS = 10000;

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

async function main() {
  console.log("========================================");
  console.log("PYQ Embedding Backfill");
  console.log("========================================\n");

  // Count questions without embeddings
  const { count: totalWithout, error: countError } = await supabase
    .from("pyq_questions")
    .select("*", { count: "exact", head: true })
    .is("embedding", null);

  if (countError) {
    console.error("Error counting questions:", countError.message);
    process.exit(1);
  }

  const total = totalWithout || 0;

  if (total === 0) {
    console.log("All questions already have embeddings. Nothing to do.");
    return;
  }

  console.log(`Found ${total} questions without embeddings.\n`);

  let processed = 0;
  let failed = 0;
  let offset = 0;

  while (offset < total) {
    // Fetch next batch (always query for NULL embeddings since we update as we go)
    const { data: batch, error: fetchError } = await supabase
      .from("pyq_questions")
      .select("*")
      .is("embedding", null)
      .order("created_at", { ascending: true })
      .range(0, BATCH_SIZE - 1);

    if (fetchError) {
      console.error("Error fetching batch:", fetchError.message);
      break;
    }

    if (!batch || batch.length === 0) {
      break;
    }

    console.log(`\n--- Batch ${Math.floor(offset / BATCH_SIZE) + 1} (${batch.length} questions) ---`);

    for (const question of batch) {
      try {
        const text = buildEmbeddingText(question);

        const result = await embeddingModel.embedContent({
          content: { parts: [{ text }], role: "user" },
          taskType: "RETRIEVAL_DOCUMENT" as any,
          outputDimensionality: 768,
        } as any);

        const embeddingValues = result.embedding.values;

        const { error: updateError } = await supabase
          .from("pyq_questions")
          .update({ embedding: JSON.stringify(embeddingValues) })
          .eq("id", question.id);

        if (updateError) {
          console.error(`  FAILED: ${question.question.substring(0, 50)}... - ${updateError.message}`);
          failed++;
        } else {
          processed++;
          const preview = question.question.substring(0, 60).replace(/\n/g, " ");
          console.log(`  Embedded: ${preview}... (${processed}/${total})`);
        }

        await delay(DELAY_BETWEEN_ITEMS_MS);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";

        if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("rate")) {
          console.log(`  Rate limited. Waiting ${RATE_LIMIT_WAIT_MS / 1000}s...`);
          await delay(RATE_LIMIT_WAIT_MS);

          // Retry this question
          try {
            const text = buildEmbeddingText(question);
            const retryResult = await embeddingModel.embedContent({
              content: { parts: [{ text }], role: "user" },
              taskType: "RETRIEVAL_DOCUMENT" as any,
              outputDimensionality: 768,
            } as any);

            const { error: retryUpdateError } = await supabase
              .from("pyq_questions")
              .update({ embedding: JSON.stringify(retryResult.embedding.values) })
              .eq("id", question.id);

            if (retryUpdateError) {
              console.error(`  FAILED (retry): ${question.question.substring(0, 50)}... - ${retryUpdateError.message}`);
              failed++;
            } else {
              processed++;
              const preview = question.question.substring(0, 60).replace(/\n/g, " ");
              console.log(`  Embedded (retry): ${preview}... (${processed}/${total})`);
            }
          } catch (retryErr: unknown) {
            const retryMsg = retryErr instanceof Error ? retryErr.message : "Retry failed";
            console.error(`  FAILED (retry): ${question.question.substring(0, 50)}... - ${retryMsg}`);
            failed++;
          }
        } else {
          console.error(`  FAILED: ${question.question.substring(0, 50)}... - ${errMsg}`);
          failed++;
        }
      }
    }

    offset += batch.length;

    // Delay between batches
    if (offset < total) {
      console.log(`  Waiting ${DELAY_BETWEEN_BATCHES_MS / 1000}s before next batch...`);
      await delay(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  console.log("\n========================================");
  console.log("Backfill Complete");
  console.log(`  Processed: ${processed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total: ${processed + failed}`);
  console.log("========================================\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
