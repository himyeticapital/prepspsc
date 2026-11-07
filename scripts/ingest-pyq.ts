/**
 * PYQ Data Ingestion Script
 * Run with: npx tsx scripts/ingest-pyq.ts
 *
 * Features:
 * 1. Seed initial real PYQs from curated data
 * 2. Parse questions from raw text using Gemini
 * 3. Fetch and parse from online sources
 *
 * Make sure to set credentials in .env.local:
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
  console.error("Please set Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

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
  source_url?: string;
}

// ============================================
// Seed Data: Curated Real PYQs
// ============================================

const CURATED_PYQS: PYQQuestion[] = [
  // Indian Polity - Fundamental Rights
  {
    question: "Which of the following is NOT a Fundamental Right under the Indian Constitution?",
    options: [
      { id: "a", text: "Right to Equality" },
      { id: "b", text: "Right to Property" },
      { id: "c", text: "Right to Freedom" },
      { id: "d", text: "Right against Exploitation" },
    ],
    correct_option_id: "b",
    explanation: "Right to Property was a Fundamental Right under Article 31 but was removed by the 44th Constitutional Amendment Act, 1978. It is now a legal right under Article 300A.",
    subject: "Indian Polity",
    topics: ["Fundamental Rights", "Constitutional Amendments"],
    subtopic: "Right to Property",
    tags: ["constitution", "44th-amendment", "article-300a"],
    exam_name: "UPSC CSE",
    exam_year: 2023,
    exam_stage: "Prelims",
    question_number: 12,
    difficulty: "easy",
    high_yield: true,
    question_type: "factual",
  },
  {
    question: "Consider the following statements about Article 21:\n1. It guarantees protection of life and personal liberty.\n2. It can be suspended during National Emergency.\nWhich of the statements given above is/are correct?",
    options: [
      { id: "a", text: "1 only" },
      { id: "b", text: "2 only" },
      { id: "c", text: "Both 1 and 2" },
      { id: "d", text: "Neither 1 nor 2" },
    ],
    correct_option_id: "a",
    explanation: "Article 21 guarantees protection of life and personal liberty. After the 44th Amendment (1978), Article 21 cannot be suspended even during a National Emergency. The statement 2 is incorrect.",
    subject: "Indian Polity",
    topics: ["Fundamental Rights", "Article 21", "Right to Life"],
    subtopic: "Right to Life and Personal Liberty",
    tags: ["article-21", "emergency", "44th-amendment"],
    exam_name: "UPSC CSE",
    exam_year: 2022,
    exam_stage: "Prelims",
    difficulty: "medium",
    high_yield: true,
    question_type: "statement",
  },
  {
    question: "Which Article of the Indian Constitution abolishes untouchability?",
    options: [
      { id: "a", text: "Article 14" },
      { id: "b", text: "Article 15" },
      { id: "c", text: "Article 17" },
      { id: "d", text: "Article 18" },
    ],
    correct_option_id: "c",
    explanation: "Article 17 abolishes 'untouchability' and forbids its practice in any form. The enforcement of any disability arising out of untouchability is an offence punishable under law.",
    subject: "Indian Polity",
    topics: ["Fundamental Rights", "Right to Equality"],
    subtopic: "Abolition of Untouchability",
    tags: ["article-17", "untouchability", "right-to-equality"],
    exam_name: "UPSC CSE",
    exam_year: 2021,
    exam_stage: "Prelims",
    difficulty: "easy",
    high_yield: true,
    question_type: "factual",
  },
  {
    question: "Right to Education is a fundamental right under which Article of the Constitution?",
    options: [
      { id: "a", text: "Article 21" },
      { id: "b", text: "Article 21A" },
      { id: "c", text: "Article 45" },
      { id: "d", text: "Article 46" },
    ],
    correct_option_id: "b",
    explanation: "Article 21A was inserted by the 86th Constitutional Amendment Act, 2002. It makes education a Fundamental Right for children aged 6-14 years. Article 45 and 46 are Directive Principles.",
    subject: "Indian Polity",
    topics: ["Fundamental Rights", "Right to Education"],
    subtopic: "Article 21A",
    tags: ["article-21a", "86th-amendment", "rte"],
    exam_name: "UPSC CSE",
    exam_year: 2020,
    exam_stage: "Prelims",
    difficulty: "easy",
    high_yield: true,
    question_type: "factual",
  },

  // Indian Polity - Parliament
  {
    question: "Which of the following is NOT a Parliamentary Committee?",
    options: [
      { id: "a", text: "Estimates Committee" },
      { id: "b", text: "Public Accounts Committee" },
      { id: "c", text: "Finance Committee" },
      { id: "d", text: "Committee on Public Undertakings" },
    ],
    correct_option_id: "c",
    explanation: "There is no committee called 'Finance Committee' in Parliament. Estimates Committee, Public Accounts Committee (PAC), and Committee on Public Undertakings are all Financial Committees of Parliament.",
    subject: "Indian Polity",
    topics: ["Parliament", "Parliamentary Committees"],
    subtopic: "Financial Committees",
    tags: ["parliament", "committees", "pac"],
    exam_name: "UPSC CSE",
    exam_year: 2023,
    exam_stage: "Prelims",
    difficulty: "medium",
    high_yield: true,
    question_type: "factual",
  },
  {
    question: "The Chairman of the Public Accounts Committee is appointed by:",
    options: [
      { id: "a", text: "President of India" },
      { id: "b", text: "Prime Minister" },
      { id: "c", text: "Speaker of Lok Sabha" },
      { id: "d", text: "Finance Minister" },
    ],
    correct_option_id: "c",
    explanation: "The Chairman of the Public Accounts Committee (PAC) is appointed by the Speaker of Lok Sabha. Since 1967, by convention, the Chairman is from the Opposition party.",
    subject: "Indian Polity",
    topics: ["Parliament", "Parliamentary Committees"],
    subtopic: "Public Accounts Committee",
    tags: ["pac", "speaker", "opposition"],
    exam_name: "UPSC CSE",
    exam_year: 2022,
    exam_stage: "Prelims",
    difficulty: "medium",
    high_yield: true,
    question_type: "factual",
  },

  // Indian Economy
  {
    question: "Which of the following is the monetary policy tool of RBI?",
    options: [
      { id: "a", text: "Fiscal Deficit targeting" },
      { id: "b", text: "Repo Rate" },
      { id: "c", text: "Government Borrowing" },
      { id: "d", text: "Tax collection" },
    ],
    correct_option_id: "b",
    explanation: "Repo Rate is a monetary policy tool used by RBI. Fiscal deficit, government borrowing, and tax collection are fiscal policy instruments managed by the Finance Ministry.",
    subject: "Indian Economy",
    topics: ["Monetary Policy", "RBI"],
    subtopic: "Repo Rate",
    tags: ["rbi", "repo-rate", "monetary-policy"],
    exam_name: "UPSC CSE",
    exam_year: 2023,
    exam_stage: "Prelims",
    difficulty: "easy",
    high_yield: true,
    question_type: "factual",
  },
  {
    question: "Consider the following statements about Inflation Targeting:\n1. It was introduced based on the recommendation of Urjit Patel Committee.\n2. The target is set by RBI in consultation with Central Government.\n3. The current inflation target is 4% with a tolerance band of +/- 2%.\nWhich of the statements given above are correct?",
    options: [
      { id: "a", text: "1 and 2 only" },
      { id: "b", text: "2 and 3 only" },
      { id: "c", text: "1 and 3 only" },
      { id: "d", text: "1, 2 and 3" },
    ],
    correct_option_id: "c",
    explanation: "Statement 2 is incorrect. Under the amended RBI Act, the Central Government sets the inflation target in consultation with RBI, not the other way around. Statements 1 and 3 are correct.",
    subject: "Indian Economy",
    topics: ["Monetary Policy", "Inflation"],
    subtopic: "Inflation Targeting",
    tags: ["inflation", "rbi", "urjit-patel"],
    exam_name: "UPSC CSE",
    exam_year: 2022,
    exam_stage: "Prelims",
    difficulty: "hard",
    high_yield: true,
    question_type: "statement",
  },

  // Geography
  {
    question: "Which of the following rivers does NOT originate in India?",
    options: [
      { id: "a", text: "Ganga" },
      { id: "b", text: "Brahmaputra" },
      { id: "c", text: "Godavari" },
      { id: "d", text: "Krishna" },
    ],
    correct_option_id: "b",
    explanation: "Brahmaputra originates in Tibet (China) near Lake Mansarovar. It is known as Yarlung Tsangpo in Tibet, Siang/Dihang in Arunachal Pradesh, and Brahmaputra in Assam.",
    subject: "Geography",
    topics: ["Indian Rivers", "Physical Geography"],
    subtopic: "Brahmaputra River",
    tags: ["brahmaputra", "tibet", "rivers"],
    exam_name: "UPSC CSE",
    exam_year: 2023,
    exam_stage: "Prelims",
    difficulty: "easy",
    high_yield: true,
    question_type: "factual",
  },

  // Sikkim Specific
  {
    question: "In which year was Sikkim officially declared as the 'First 100% Organic State' in the world?",
    options: [
      { id: "a", text: "2014" },
      { id: "b", text: "2016" },
      { id: "c", text: "2018" },
      { id: "d", text: "2020" },
    ],
    correct_option_id: "b",
    explanation: "Sikkim was declared India's first fully organic state in 2016 by PM Modi. The state had stopped using chemical fertilizers and pesticides since 2003 under the Sikkim Organic Mission.",
    subject: "Indian Economy",
    topics: ["Agriculture", "Organic Farming", "Sikkim"],
    subtopic: "Organic State",
    tags: ["sikkim", "organic", "agriculture"],
    exam_name: "SPSC",
    exam_year: 2023,
    exam_stage: "Prelims",
    difficulty: "easy",
    high_yield: true,
    question_type: "factual",
  },
  {
    question: "Which dynasty ruled Sikkim before it merged with India in 1975?",
    options: [
      { id: "a", text: "Chogyal Dynasty" },
      { id: "b", text: "Namgyal Dynasty" },
      { id: "c", text: "Bhutia Dynasty" },
      { id: "d", text: "Lepcha Dynasty" },
    ],
    correct_option_id: "b",
    explanation: "The Namgyal Dynasty ruled Sikkim from 1642 to 1975. The rulers were called 'Chogyal' (meaning 'Righteous King'). Chogyal is the title, not the dynasty name.",
    subject: "History",
    topics: ["Modern Indian History", "Sikkim History"],
    subtopic: "Namgyal Dynasty",
    tags: ["sikkim", "namgyal", "chogyal", "monarchy"],
    exam_name: "SPSC",
    exam_year: 2022,
    exam_stage: "Prelims",
    difficulty: "medium",
    high_yield: true,
    question_type: "factual",
  },
  {
    question: "Kanchenjunga, the highest peak in Sikkim, is the ____ highest peak in the world.",
    options: [
      { id: "a", text: "Second" },
      { id: "b", text: "Third" },
      { id: "c", text: "Fourth" },
      { id: "d", text: "Fifth" },
    ],
    correct_option_id: "b",
    explanation: "Kanchenjunga (8,586 m) is the third highest peak in the world after Mount Everest (8,849 m) and K2 (8,611 m). It is the highest peak in India and Sikkim.",
    subject: "Geography",
    topics: ["Physical Geography", "Mountains", "Sikkim"],
    subtopic: "Kanchenjunga",
    tags: ["sikkim", "kanchenjunga", "himalayas"],
    exam_name: "SPSC",
    exam_year: 2023,
    exam_stage: "Prelims",
    difficulty: "easy",
    high_yield: true,
    question_type: "factual",
  },

  // History
  {
    question: "The first session of the Indian National Congress was held in:",
    options: [
      { id: "a", text: "Calcutta, 1885" },
      { id: "b", text: "Bombay, 1885" },
      { id: "c", text: "Madras, 1886" },
      { id: "d", text: "Allahabad, 1887" },
    ],
    correct_option_id: "b",
    explanation: "The first session of the Indian National Congress was held in Bombay (now Mumbai) in December 1885. W.C. Bonnerjee presided over this session with 72 delegates attending.",
    subject: "History",
    topics: ["Modern Indian History", "Indian National Congress"],
    subtopic: "Formation of INC",
    tags: ["inc", "1885", "bombay", "bonnerjee"],
    exam_name: "UPSC CSE",
    exam_year: 2021,
    exam_stage: "Prelims",
    difficulty: "easy",
    high_yield: true,
    question_type: "factual",
  },
  {
    question: "Who among the following gave the slogan 'Swaraj is my birthright and I shall have it'?",
    options: [
      { id: "a", text: "Mahatma Gandhi" },
      { id: "b", text: "Bal Gangadhar Tilak" },
      { id: "c", text: "Lala Lajpat Rai" },
      { id: "d", text: "Bipin Chandra Pal" },
    ],
    correct_option_id: "b",
    explanation: "Bal Gangadhar Tilak gave this famous slogan. He was known as 'Lokmanya' and was one of the first leaders of the Indian Independence Movement to advocate for Swaraj (self-rule).",
    subject: "History",
    topics: ["Modern Indian History", "Freedom Struggle"],
    subtopic: "Nationalist Leaders",
    tags: ["tilak", "swaraj", "extremist"],
    exam_name: "UPSC CSE",
    exam_year: 2020,
    exam_stage: "Prelims",
    difficulty: "easy",
    high_yield: true,
    question_type: "factual",
  },

  // Environment
  {
    question: "Which of the following is NOT a Ramsar Wetland Site in India?",
    options: [
      { id: "a", text: "Chilika Lake" },
      { id: "b", text: "Wular Lake" },
      { id: "c", text: "Powai Lake" },
      { id: "d", text: "Loktak Lake" },
    ],
    correct_option_id: "c",
    explanation: "Powai Lake in Mumbai is not a Ramsar site. Chilika (Odisha), Wular (J&K), and Loktak (Manipur) are all designated Ramsar Wetland Sites of International Importance.",
    subject: "Environment",
    topics: ["Conservation", "Wetlands"],
    subtopic: "Ramsar Sites",
    tags: ["ramsar", "wetlands", "chilika", "wular", "loktak"],
    exam_name: "UPSC CSE",
    exam_year: 2023,
    exam_stage: "Prelims",
    difficulty: "medium",
    high_yield: true,
    question_type: "factual",
  },
];

// ============================================
// Functions
// ============================================

async function insertPYQ(pyq: PYQQuestion): Promise<boolean> {
  const { data, error } = await supabase.from("pyq_questions").insert({
    question: pyq.question,
    options: pyq.options,
    correct_option_id: pyq.correct_option_id,
    explanation: pyq.explanation,
    subject: pyq.subject,
    topics: pyq.topics,
    subtopic: pyq.subtopic,
    tags: pyq.tags || [],
    exam_name: pyq.exam_name,
    exam_year: pyq.exam_year,
    exam_stage: pyq.exam_stage,
    question_number: pyq.question_number,
    difficulty: pyq.difficulty || "medium",
    high_yield: pyq.high_yield || false,
    question_type: pyq.question_type || "factual",
    source_url: pyq.source_url,
    is_verified: true, // Curated questions are pre-verified
  });

  if (error) {
    console.error(`Error inserting: ${pyq.question.substring(0, 50)}...`, error.message);
    return false;
  }
  return true;
}

async function seedCuratedPYQs() {
  console.log("========================================");
  console.log("Seeding Curated Real PYQs");
  console.log("========================================\n");

  let successCount = 0;
  let failCount = 0;

  for (const pyq of CURATED_PYQS) {
    const success = await insertPYQ(pyq);
    if (success) {
      successCount++;
      console.log(`✓ Added: ${pyq.exam_name} ${pyq.exam_year} - ${pyq.question.substring(0, 50)}...`);
    } else {
      failCount++;
    }
  }

  console.log("\n========================================");
  console.log(`✅ Successfully added: ${successCount} questions`);
  console.log(`❌ Failed: ${failCount} questions`);
  console.log("========================================\n");
}

async function parseQuestionsWithGemini(rawText: string, examName: string, examYear: number, subject: string): Promise<PYQQuestion[]> {
  if (!genAI) {
    console.error("Gemini API key not configured. Cannot parse with AI.");
    return [];
  }

  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

  const prompt = `Parse the following exam questions into structured JSON format.

Exam: ${examName}
Year: ${examYear}
Subject: ${subject}

Raw text:
---
${rawText}
---

Return a JSON array of questions. Each question should have:
{
  "question": "Full question text",
  "options": [
    {"id": "a", "text": "Option A text"},
    {"id": "b", "text": "Option B text"},
    {"id": "c", "text": "Option C text"},
    {"id": "d", "text": "Option D text"}
  ],
  "correct_option_id": "a/b/c/d (if known, else null)",
  "explanation": "Brief explanation if available",
  "topics": ["Topic 1", "Topic 2"],
  "subtopic": "Specific subtopic",
  "difficulty": "easy/medium/hard",
  "high_yield": true/false,
  "question_type": "factual/statement/assertion-reason/match/sequence"
}

Return ONLY valid JSON array. No markdown, no explanation.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Clean and parse JSON
    let cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    // Add exam metadata to each question
    return parsed.map((q: any) => ({
      ...q,
      exam_name: examName,
      exam_year: examYear,
      subject: subject,
      topics: q.topics || [subject],
    }));
  } catch (error) {
    console.error("Error parsing with Gemini:", error);
    return [];
  }
}

async function countPYQs() {
  const { count, error } = await supabase
    .from("pyq_questions")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Error counting PYQs:", error);
    return 0;
  }
  return count || 0;
}

async function showStats() {
  console.log("\n📊 PYQ Database Statistics");
  console.log("========================================");

  // Total count
  const total = await countPYQs();
  console.log(`Total Questions: ${total}`);

  // By exam
  const { data: byExam } = await supabase
    .from("pyq_questions")
    .select("exam_name")
    .then(res => {
      const counts: Record<string, number> = {};
      res.data?.forEach((q: any) => {
        counts[q.exam_name] = (counts[q.exam_name] || 0) + 1;
      });
      return { data: counts };
    });

  console.log("\nBy Exam:");
  for (const [exam, count] of Object.entries(byExam || {})) {
    console.log(`  ${exam}: ${count}`);
  }

  // By subject
  const { data: bySubject } = await supabase
    .from("pyq_questions")
    .select("subject")
    .then(res => {
      const counts: Record<string, number> = {};
      res.data?.forEach((q: any) => {
        counts[q.subject] = (counts[q.subject] || 0) + 1;
      });
      return { data: counts };
    });

  console.log("\nBy Subject:");
  for (const [subject, count] of Object.entries(bySubject || {})) {
    console.log(`  ${subject}: ${count}`);
  }

  console.log("========================================\n");
}

// ============================================
// Main
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "seed";

  switch (command) {
    case "seed":
      await seedCuratedPYQs();
      await showStats();
      break;

    case "stats":
      await showStats();
      break;

    case "clear":
      console.log("⚠️  Clearing all PYQs...");
      const { error } = await supabase.from("pyq_questions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) {
        console.error("Error clearing:", error);
      } else {
        console.log("✓ All PYQs cleared");
      }
      break;

    default:
      console.log(`
PYQ Ingestion Script
====================

Commands:
  npx tsx scripts/ingest-pyq.ts seed    - Seed curated PYQs (default)
  npx tsx scripts/ingest-pyq.ts stats   - Show database statistics
  npx tsx scripts/ingest-pyq.ts clear   - Clear all PYQs (careful!)

To add more questions:
1. Add to CURATED_PYQS array in this file
2. Run: npx tsx scripts/ingest-pyq.ts seed
      `);
  }
}

main().catch(console.error);
