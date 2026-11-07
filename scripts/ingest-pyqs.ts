/**
 * PYQ Full Ingestion Pipeline
 * Run with:
 *   npx tsx scripts/ingest-pyqs.ts --pdf ./path/to/file.pdf
 *   npx tsx scripts/ingest-pyqs.ts --json ./path/to/questions.json
 *
 * Options:
 *   --dry-run    Show what would be inserted but don't write to DB
 *   --verify     Set is_verified: true on all inserted questions
 *
 * Required .env.local variables:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - GOOGLE_GEMINI_API_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import * as dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, statSync } from "fs";
import { createInterface } from "readline";

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
const fileManager = new GoogleAIFileManager(geminiApiKey);

const LARGE_FILE_THRESHOLD_BYTES = 15 * 1024 * 1024; // 15MB → use Files API

// ============================================
// Types
// ============================================

interface PYQQuestion {
  question: string;
  options: { id: string; text: string }[];
  correct_option_id: string;
  explanation?: string;
  subject: string;
  topics: string[];
  subtopic?: string;
  tags?: string[];
  exam_name: string;
  exam_year: number;
  exam_stage?: string;
  question_number?: number;
  difficulty?: "easy" | "medium" | "hard";
  high_yield?: boolean;
  question_type?: "factual" | "statement" | "assertion-reason" | "match" | "sequence";
}

// ============================================
// CLI Argument Parsing
// ============================================

function parseArgs(): {
  mode: "pdf" | "json";
  filePath: string;
  dryRun: boolean;
  verify: boolean;
} {
  const args = process.argv.slice(2);
  let mode: "pdf" | "json" | null = null;
  let filePath: string | null = null;
  let dryRun = false;
  let verify = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--pdf":
        mode = "pdf";
        filePath = args[++i];
        break;
      case "--json":
        mode = "json";
        filePath = args[++i];
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--verify":
        verify = true;
        break;
    }
  }

  if (!mode || !filePath) {
    console.log(`
PYQ Ingestion Pipeline
======================

Usage:
  npx tsx scripts/ingest-pyqs.ts --pdf ./path/to/file.pdf [options]
  npx tsx scripts/ingest-pyqs.ts --json ./path/to/questions.json [options]

Options:
  --dry-run    Show what would be inserted but don't write to DB
  --verify     Set is_verified: true on all inserted questions
`);
    process.exit(1);
  }

  // Resolve relative paths
  const resolvedPath = resolve(process.cwd(), filePath);

  return { mode, filePath: resolvedPath, dryRun, verify };
}

// ============================================
// Helpers
// ============================================

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function askConfirmation(prompt: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

function buildEmbeddingText(question: PYQQuestion): string {
  const parts: string[] = [question.question];

  if (question.subject) {
    parts.push(`Subject: ${question.subject}`);
  }

  if (question.topics && question.topics.length > 0) {
    parts.push(`Topics: ${question.topics.join(", ")}`);
  }

  if (question.subtopic) {
    parts.push(`Subtopic: ${question.subtopic}`);
  }

  if (question.options && question.options.length > 0) {
    const optionTexts = question.options.map((o) => o.text).filter(Boolean);
    if (optionTexts.length > 0) {
      parts.push(`Options: ${optionTexts.join(" | ")}`);
    }
  }

  return parts.join("\n");
}

function validateQuestion(q: any, index: number): string[] {
  const errors: string[] = [];

  if (!q.question || typeof q.question !== "string") {
    errors.push(`Question ${index + 1}: missing or invalid 'question' field`);
  }

  if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
    errors.push(`Question ${index + 1}: missing or invalid 'options' array (need at least 2)`);
  } else {
    for (const opt of q.options) {
      if (!opt.id || !opt.text) {
        errors.push(`Question ${index + 1}: option missing 'id' or 'text'`);
        break;
      }
    }
  }

  if (!q.correct_option_id || typeof q.correct_option_id !== "string") {
    errors.push(`Question ${index + 1}: missing or invalid 'correct_option_id'`);
  }

  if (!q.subject || typeof q.subject !== "string") {
    errors.push(`Question ${index + 1}: missing or invalid 'subject'`);
  }

  if (!q.topics || !Array.isArray(q.topics) || q.topics.length === 0) {
    errors.push(`Question ${index + 1}: missing or invalid 'topics' array`);
  }

  if (!q.exam_name || typeof q.exam_name !== "string") {
    errors.push(`Question ${index + 1}: missing or invalid 'exam_name'`);
  }

  if (!q.exam_year || typeof q.exam_year !== "number") {
    errors.push(`Question ${index + 1}: missing or invalid 'exam_year'`);
  }

  return errors;
}

// ============================================
// PDF Extraction via Gemini
// ============================================

async function extractQuestionsFromPDF(pdfPath: string): Promise<PYQQuestion[]> {
  console.log(`Reading PDF: ${pdfPath}`);
  const fileSizeBytes = statSync(pdfPath).size;
  console.log(`PDF size: ${(fileSizeBytes / 1024).toFixed(1)} KB`);

  const isLargeFile = fileSizeBytes > LARGE_FILE_THRESHOLD_BYTES;
  if (isLargeFile) {
    console.log("Large file detected — uploading via Gemini Files API...");
  } else {
    console.log("Sending PDF to Gemini for extraction...");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

  const prompt = `You are an expert at parsing exam question papers. Extract ALL multiple-choice questions (MCQs) from this PDF document.

For each question, provide:
- question: The full question text
- options: Array of {id: "a"/"b"/"c"/"d", text: "option text"}
- correct_option_id: The correct answer ID (if answer key is available, otherwise use your best judgment)
- explanation: Brief explanation of the correct answer
- subject: Subject area (e.g., "Indian Polity", "History", "Geography", "Indian Economy", "Environment", "Science")
- topics: Array of relevant topic tags (e.g., ["Fundamental Rights", "Constitutional Amendments"])
- subtopic: Specific subtopic if identifiable
- exam_name: Extract from the document header (e.g., "UPSC CSE", "SPSC", "CDS", "SSC CGL")
- exam_year: Extract the year from the document
- exam_stage: Extract if available (e.g., "Prelims", "Mains", "Paper 1")
- question_number: Original question number in the paper
- difficulty: "easy", "medium", or "hard" based on your assessment
- high_yield: true if this is a frequently tested topic
- question_type: "factual", "statement", "assertion-reason", "match", or "sequence"

Return ONLY a valid JSON array of question objects. No markdown, no explanation, just the JSON array.

Example format:
[
  {
    "question": "Which Article of the Indian Constitution abolishes untouchability?",
    "options": [
      {"id": "a", "text": "Article 14"},
      {"id": "b", "text": "Article 15"},
      {"id": "c", "text": "Article 17"},
      {"id": "d", "text": "Article 18"}
    ],
    "correct_option_id": "c",
    "explanation": "Article 17 abolishes untouchability and forbids its practice in any form.",
    "subject": "Indian Polity",
    "topics": ["Fundamental Rights", "Right to Equality"],
    "subtopic": "Abolition of Untouchability",
    "exam_name": "UPSC CSE",
    "exam_year": 2023,
    "exam_stage": "Prelims",
    "question_number": 5,
    "difficulty": "easy",
    "high_yield": true,
    "question_type": "factual"
  }
]`;

  try {
    let contentParts: Parameters<typeof model.generateContent>[0];

    if (isLargeFile) {
      // Upload to Gemini Files API first, then reference by URI
      const uploadResult = await fileManager.uploadFile(pdfPath, {
        mimeType: "application/pdf",
        displayName: pdfPath.split("/").pop() ?? "exam.pdf",
      });
      console.log(`Uploaded to Files API: ${uploadResult.file.uri}`);

      contentParts = [
        { text: prompt },
        {
          fileData: {
            mimeType: "application/pdf",
            fileUri: uploadResult.file.uri,
          },
        },
      ];

      // Clean up uploaded file after use (fire-and-forget)
      fileManager.deleteFile(uploadResult.file.name).catch(() => {});
    } else {
      const pdfBase64 = readFileSync(pdfPath).toString("base64");
      contentParts = [
        { text: prompt },
        {
          inlineData: {
            mimeType: "application/pdf",
            data: pdfBase64,
          },
        },
      ];
    }

    const result = await model.generateContent(contentParts);

    const responseText = result.response.text();

    // Clean and parse JSON
    let cleaned = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const jsonStart = cleaned.indexOf("[");
    if (jsonStart > 0) {
      cleaned = cleaned.slice(jsonStart);
    }

    let questions: PYQQuestion[];
    try {
      questions = JSON.parse(cleaned);
    } catch {
      // JSON truncated — find last complete question object
      console.log("JSON truncated, attempting repair...");

      // Look for the last complete question by finding "}," or "}" pattern
      // that ends a top-level object in the array
      let repaired = cleaned;
      let parsed = false;

      // Strategy: progressively trim from the end to find valid JSON
      // Look for last occurrence of correct_option_id or question_type followed by }
      const patterns = [
        /\}\s*,\s*\{[^}]*$/s,  // incomplete last object
        /,\s*\{[^}]*$/s,       // trailing incomplete object
      ];

      for (const pattern of patterns) {
        const trimmed = repaired.replace(pattern, "");
        try {
          const balanced = trimmed.trimEnd().endsWith("]") ? trimmed : trimmed + "]";
          questions = JSON.parse(balanced);
          parsed = true;
          console.log(`Repaired: recovered ${questions.length} questions from truncated response`);
          break;
        } catch { /* try next pattern */ }
      }

      if (!parsed) {
        // Fallback: find last complete "}" that forms a valid question
        let lastPos = repaired.length;
        while (lastPos > 0) {
          lastPos = repaired.lastIndexOf("}", lastPos - 1);
          if (lastPos <= 0) break;
          const attempt = repaired.substring(0, lastPos + 1);
          // Balance all brackets
          const open = (attempt.match(/\[/g) || []).length;
          const close = (attempt.match(/\]/g) || []).length;
          let balanced = attempt;
          for (let i = 0; i < open - close; i++) balanced += "]";
          try {
            questions = JSON.parse(balanced);
            parsed = true;
            console.log(`Repaired (fallback): recovered ${questions.length} questions`);
            break;
          } catch { /* keep trying */ }
        }
      }

      if (!parsed) {
        throw new Error("Could not repair truncated JSON");
      }
    }
    return questions;
  } catch (error) {
    console.error("Error extracting questions from PDF:", error);
    throw error;
  }
}

// ============================================
// JSON File Loading
// ============================================

function loadQuestionsFromJSON(jsonPath: string): PYQQuestion[] {
  console.log(`Reading JSON: ${jsonPath}`);
  const raw = readFileSync(jsonPath, "utf-8");
  const data = JSON.parse(raw);

  // Support both array and {questions: [...]} formats
  const questions: PYQQuestion[] = Array.isArray(data) ? data : data.questions;

  if (!Array.isArray(questions)) {
    throw new Error("JSON file must contain an array of questions or an object with a 'questions' array");
  }

  return questions;
}

// ============================================
// Database Insert + Embedding
// ============================================

async function insertAndEmbed(
  questions: PYQQuestion[],
  options: { dryRun: boolean; verify: boolean }
): Promise<{ inserted: number; embedded: number; failed: number }> {
  let inserted = 0;
  let embedded = 0;
  let failed = 0;

  const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const preview = q.question.substring(0, 60).replace(/\n/g, " ");

    if (options.dryRun) {
      console.log(`  [DRY RUN] Would insert: ${preview}...`);
      inserted++;
      continue;
    }

    // Step 1: Insert question into database
    try {
      const { data: insertedRow, error: insertError } = await supabase
        .from("pyq_questions")
        .insert({
          question: q.question,
          options: q.options,
          correct_option_id: q.correct_option_id,
          explanation: q.explanation,
          subject: q.subject,
          topics: q.topics,
          subtopic: q.subtopic,
          tags: q.tags || [],
          exam_name: q.exam_name,
          exam_year: q.exam_year,
          exam_stage: q.exam_stage,
          question_number: q.question_number,
          difficulty: (q.difficulty || "medium").toLowerCase() as "easy" | "medium" | "hard",
          high_yield: q.high_yield || false,
          question_type: q.question_type || "factual",
          is_verified: options.verify,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error(`  FAILED insert: ${preview}... - ${insertError.message}`);
        failed++;
        continue;
      }

      inserted++;
      console.log(`  Inserted: ${preview}... (${i + 1}/${questions.length})`);

      // Step 2: Generate and store embedding
      try {
        const text = buildEmbeddingText(q);

        const embResult = await embeddingModel.embedContent({
          content: { parts: [{ text }], role: "user" },
          taskType: "RETRIEVAL_DOCUMENT" as any,
          outputDimensionality: 768,
        } as any);

        const embeddingValues = embResult.embedding.values;

        const { error: updateError } = await supabase
          .from("pyq_questions")
          .update({ embedding: JSON.stringify(embeddingValues) })
          .eq("id", insertedRow.id);

        if (updateError) {
          console.error(`  FAILED embedding: ${preview}... - ${updateError.message}`);
        } else {
          embedded++;
          console.log(`  Embedded: ${preview}...`);
        }

        await delay(150);
      } catch (embErr: unknown) {
        const embMsg = embErr instanceof Error ? embErr.message : "Unknown error";

        if (embMsg.includes("429") || embMsg.includes("quota") || embMsg.includes("rate")) {
          console.log("  Rate limited on embedding. Waiting 10s...");
          await delay(10000);

          // Retry embedding
          try {
            const text = buildEmbeddingText(q);
            const retryResult = await embeddingModel.embedContent({
              content: { parts: [{ text }], role: "user" },
              taskType: "RETRIEVAL_DOCUMENT" as any,
              outputDimensionality: 768,
            } as any);

            const { error: retryUpdateError } = await supabase
              .from("pyq_questions")
              .update({ embedding: JSON.stringify(retryResult.embedding.values) })
              .eq("id", insertedRow.id);

            if (!retryUpdateError) {
              embedded++;
              console.log(`  Embedded (retry): ${preview}...`);
            }
          } catch {
            console.error(`  FAILED embedding (retry): ${preview}...`);
          }
        } else {
          console.error(`  FAILED embedding: ${preview}... - ${embMsg}`);
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(`  FAILED: ${preview}... - ${errMsg}`);
      failed++;
    }
  }

  return { inserted, embedded, failed };
}

// ============================================
// Main
// ============================================

async function main() {
  const { mode, filePath, dryRun, verify } = parseArgs();

  console.log("========================================");
  console.log("PYQ Ingestion Pipeline");
  console.log("========================================");
  console.log(`Mode: ${mode.toUpperCase()}`);
  console.log(`File: ${filePath}`);
  if (dryRun) console.log("DRY RUN: No data will be written");
  if (verify) console.log("VERIFY: Questions will be marked as verified");
  console.log("");

  // Step 1: Extract/load questions
  let questions: PYQQuestion[];

  if (mode === "pdf") {
    questions = await extractQuestionsFromPDF(filePath);
  } else {
    questions = loadQuestionsFromJSON(filePath);
  }

  if (questions.length === 0) {
    console.log("No questions found. Exiting.");
    return;
  }

  // Step 2: Validate
  console.log(`\nExtracted ${questions.length} questions.`);

  const allErrors: string[] = [];
  for (let i = 0; i < questions.length; i++) {
    const errors = validateQuestion(questions[i], i);
    allErrors.push(...errors);
  }

  if (allErrors.length > 0) {
    console.log(`\nValidation errors (${allErrors.length}):`);
    for (const err of allErrors.slice(0, 10)) {
      console.log(`  - ${err}`);
    }
    if (allErrors.length > 10) {
      console.log(`  ... and ${allErrors.length - 10} more`);
    }
    console.log("");
  }

  // Step 3: Show summary
  const subjects = new Set(questions.map((q) => q.subject));
  const exams = new Set(questions.map((q) => q.exam_name));
  const years = new Set(questions.map((q) => q.exam_year));

  console.log("Summary:");
  console.log(`  Questions: ${questions.length}`);
  console.log(`  Subjects: ${Array.from(subjects).join(", ")}`);
  console.log(`  Exams: ${Array.from(exams).join(", ")}`);
  console.log(`  Years: ${Array.from(years).sort().join(", ")}`);
  console.log("");

  // Step 4: Confirm
  if (!dryRun) {
    const confirmed = await askConfirmation(
      `Proceed with inserting ${questions.length} questions into the database? (y/n) `
    );

    if (!confirmed) {
      console.log("Aborted.");
      return;
    }
    console.log("");
  }

  // Step 5: Insert + embed
  const result = await insertAndEmbed(questions, { dryRun, verify });

  // Step 6: Final summary
  console.log("\n========================================");
  console.log("Ingestion Complete");
  console.log(`  Inserted: ${result.inserted}`);
  console.log(`  Embedded: ${result.embedded}`);
  console.log(`  Failed: ${result.failed}`);
  if (dryRun) console.log("  (DRY RUN - no data was written)");
  console.log("========================================\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
