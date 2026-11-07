// Supabase Edge Function for generating topic content (PYQ, Summary, Quiz, etc.)
// Runs with longer timeout than Vercel Hobby (10s)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = Deno.env.get("GEMINI_BASIC_MODEL") ?? "gemini-3.1-flash-lite"; // cheap default (see src/lib/ai-models.ts)
const FAST_MODEL = Deno.env.get("GEMINI_BASIC_MODEL") ?? "gemini-3.1-flash-lite";
const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;

// Supabase client for database queries
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Get exam names to search based on user's exam type
function getExamNamesToSearch(examType: string): string[] {
  const examTypeLower = (examType || "").toLowerCase();

  // For Sikkim PSC: search SPSC + UPSC (70% UPSC mix)
  if (/sikkim|spsc/i.test(examTypeLower)) {
    return ["SPSC", "UPSC CSE", "CDS", "NDA", "CAPF", "SSC CGL"];
  }

  // For other State PSCs: search state + UPSC
  if (/psc|public service/i.test(examTypeLower)) {
    return ["UPSC CSE", "CDS", "NDA", "CAPF", "SSC CGL"];
  }

  // For JEE: search JEE exams only
  if (/jee|joint entrance|iit|nit/i.test(examTypeLower)) {
    return ["JEE Mains", "JEE Advanced", "BITSAT"];
  }

  // For NEET: search medical exams
  if (/neet|aiims|jipmer|medical entrance/i.test(examTypeLower)) {
    return ["NEET", "AIIMS", "JIPMER"];
  }

  // Default: UPSC and related
  return ["UPSC CSE", "CDS", "SSC CGL", "UPSC CAPF"];
}

async function generateQueryEmbedding(
  genAI: GoogleGenerativeAI,
  subject: string,
  topics: string[]
): Promise<number[] | null> {
  try {
    const queryText = `${subject}: ${topics.join(", ")}`;
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent({
      content: { parts: [{ text: queryText }], role: "user" },
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: EMBEDDING_DIMENSIONS,
    });
    return result.embedding.values;
  } catch (error) {
    console.error("[generate-topic-content] Failed to generate query embedding:", error);
    return null;
  }
}

// Search real PYQs from database
async function searchRealPYQs(
  subject: string,
  topics: string[],
  examType: string,
  limit: number = 6,
  excludeIds: string[] = []
): Promise<any[]> {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log("[generate-topic-content] Supabase not configured, skipping real PYQ search");
    return [];
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const examNames = getExamNamesToSearch(examType);

    console.log(`[generate-topic-content] Searching real PYQs: subject=${subject}, topics=${topics.join(",")}, exams=${examNames.join(",")}`);

    // Build query
    let query = supabase
      .from("pyq_questions")
      .select("*")
      .eq("is_verified", true)
      .in("exam_name", examNames)
      .order("high_yield", { ascending: false })
      .order("exam_year", { ascending: false })
      .limit(limit);

    // Filter by topics (array overlap)
    if (topics.length > 0) {
      query = query.overlaps("topics", topics);
    }

    // Exclude already-fetched questions (for "Generate More")
    if (excludeIds.length > 0) {
      query = query.not("id", "in", `(${excludeIds.join(",")})`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[generate-topic-content] Error searching real PYQs:", error);
      return [];
    }

    console.log(`[generate-topic-content] Found ${data?.length || 0} real PYQs`);

    // Transform database format to API format
    return (data || []).map((q: any, index: number) => ({
      id: String(index + 1),
      dbId: q.id, // Keep DB ID for "Generate More" exclusion
      question: q.question,
      options: q.options,
      correctOptionId: q.correct_option_id,
      explanation: q.explanation,
      examReference: `${q.exam_name} ${q.exam_year}${q.exam_stage ? ` ${q.exam_stage}` : ""}`,
      highYield: q.high_yield,
      difficulty: q.difficulty,
      subtopic: q.subtopic,
      questionType: q.question_type,
      source: "real" as const, // Mark as real PYQ
    }));
  } catch (error) {
    console.error("[generate-topic-content] Exception searching real PYQs:", error);
    return [];
  }
}

async function searchRealPYQsSemantic(
  queryEmbedding: number[],
  subject: string,
  examType: string,
  limit: number = 8,
  excludeIds: string[] = []
): Promise<any[]> {
  if (!supabaseUrl || !supabaseServiceKey) return [];

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const examNames = getExamNamesToSearch(examType);

    console.log(`[generate-topic-content] Semantic search: subject=${subject}, exams=${examNames.join(",")}`);

    const { data, error } = await supabase.rpc("search_pyq_semantic", {
      query_embedding: JSON.stringify(queryEmbedding),
      p_subject: subject,
      p_exam_names: examNames,
      p_match_threshold: 0.3,
      p_limit: limit,
      p_exclude_ids: excludeIds,
    });

    if (error) {
      console.error("[generate-topic-content] Semantic search error:", error);
      return [];
    }

    console.log(`[generate-topic-content] Semantic search found ${data?.length || 0} results`);

    return (data || []).map((q: any, index: number) => ({
      id: String(index + 1),
      dbId: q.id,
      question: q.question,
      options: q.options,
      correctOptionId: q.correct_option_id,
      explanation: q.explanation,
      examReference: `${q.exam_name} ${q.exam_year}${q.exam_stage ? ` ${q.exam_stage}` : ""}`,
      highYield: q.high_yield,
      difficulty: q.difficulty,
      subtopic: q.subtopic,
      questionType: q.question_type,
      source: "real" as const,
    }));
  } catch (error) {
    console.error("[generate-topic-content] Semantic search exception:", error);
    return [];
  }
}

// Exam configuration helper
function getExamConfig(examType: string) {
  const examTypeLower = (examType || "").toLowerCase();

  const isJEE = /jee|joint entrance|iit|nit/i.test(examTypeLower);
  const isEngineeringServices = /ese|gate|je|junior engineer|ae|assistant engineer/i.test(examTypeLower) && !isJEE;
  const isNEET = /neet|aiims|jipmer|medical entrance/i.test(examTypeLower);
  const isSikkimPSC = /sikkim|spsc/i.test(examTypeLower);

  if (isJEE) {
    return {
      examName: "JEE",
      examFull: "Joint Entrance Examination (Mains & Advanced)",
      referenceExams: "JEE Mains, JEE Advanced, BITSAT",
      questionStyle: `1. Questions test problem-solving and application
2. Numerical answer type questions
3. Multi-concept questions combining topics`,
      questionTypes: `- Numerical problems\n- Conceptual MCQs\n- Assertion-Reason questions`,
      emojiMarkers: "⚡ Physics | ⚗️ Chemistry | 📐 Mathematics",
      exampleRef: "JEE Mains 2023",
    };
  }

  if (isNEET) {
    return {
      examName: "NEET",
      examFull: "National Eligibility cum Entrance Test",
      referenceExams: "NEET UG, AIIMS, JIPMER",
      questionStyle: `1. Direct factual questions from NCERT
2. Diagram-based questions
3. Clinical application questions`,
      questionTypes: `- Direct recall questions\n- Diagram labeling\n- Assertion-Reason`,
      emojiMarkers: "🧬 Biology | ⚗️ Chemistry | ⚡ Physics",
      exampleRef: "NEET 2023",
    };
  }

  if (isSikkimPSC) {
    return {
      examName: "Sikkim PSC",
      examFull: "Sikkim Public Service Commission (with UPSC-pattern questions)",
      referenceExams: "UPSC CSE Prelims, SPSC Prelims, SPSC Mains, CDS",
      questionStyle: `IMPORTANT - Generate a MIX of question styles:
1. 60-70% UPSC CSE-pattern questions: Analytical, conceptual, statement-based questions on the topic that appear in UPSC Civil Services and other national-level exams
2. 30-40% Sikkim-specific questions: State-specific facts, local governance, Sikkim history/geography/economy related to the topic
3. Both types should be exam-quality and test deep understanding`,
      questionTypes: `- Statement-based MCQs ("Consider the following statements..." - UPSC pattern)\n- Analytical/conceptual questions (UPSC pattern)\n- Sikkim-specific GK and current affairs\n- Match-the-following or assertion-reason`,
      emojiMarkers: "🏛️ Polity | 📜 History | 💰 Economy | 🌍 Geography | 🏔️ Sikkim",
      exampleRef: "UPSC CSE 2023 / SPSC 2023",
    };
  }

  // Default UPSC
  return {
    examName: "UPSC",
    examFull: "Union Public Service Commission CSE",
    referenceExams: "UPSC Prelims, UPSC Mains",
    questionStyle: `1. Analytical questions testing conceptual understanding
2. Current affairs linked with static syllabus
3. Multi-dimensional questions`,
    questionTypes: `- Statement-based MCQs\n- Elimination-based questions\n- Matching type questions`,
    emojiMarkers: "📜 History | 🏛️ Polity | 💰 Economy | 🌍 Geography | 🔬 Science",
    exampleRef: "UPSC CSE 2023",
  };
}

// Repair truncated JSON - robust version that finds last complete question
function repairTruncatedJSON(text: string): string {
  let repaired = text.trim();

  // Strategy 1: Find the last complete question object (ends with })
  // Look for pattern: complete question ending with "highYield": true/false } or "explanation": "..." }
  const questionPattern = /"highYield"\s*:\s*(true|false)\s*\}/g;
  let lastCompleteQuestion = -1;
  let match;

  while ((match = questionPattern.exec(repaired)) !== null) {
    lastCompleteQuestion = match.index + match[0].length;
  }

  // If we found complete questions, truncate there and close the structure
  if (lastCompleteQuestion > 0) {
    repaired = repaired.substring(0, lastCompleteQuestion);
    // Close the questions array and root object
    if (!repaired.trim().endsWith(']}')) {
      repaired = repaired.trimEnd();
      if (repaired.endsWith(',')) {
        repaired = repaired.slice(0, -1);
      }
      repaired += ']}';
    }
    return repaired;
  }

  // Strategy 2: Fallback - find last complete JSON object with closing brace
  // Look backwards for a valid closing point
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let lastChar = '';
  let lastValidEnd = -1;

  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (char === '"' && lastChar !== '\\') inString = !inString;
    if (!inString) {
      if (char === '{') braceCount++;
      if (char === '}') {
        braceCount--;
        if (braceCount >= 0) lastValidEnd = i + 1;
      }
      if (char === '[') bracketCount++;
      if (char === ']') {
        bracketCount--;
        if (bracketCount >= 0) lastValidEnd = i + 1;
      }
    }
    lastChar = char;
  }

  // If we have a valid end point, use it
  if (lastValidEnd > 0 && lastValidEnd < repaired.length) {
    repaired = repaired.substring(0, lastValidEnd);
  }

  // Recount and close remaining structures
  braceCount = 0;
  bracketCount = 0;
  inString = false;
  lastChar = '';

  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (char === '"' && lastChar !== '\\') inString = !inString;
    if (!inString) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      if (char === '[') bracketCount++;
      if (char === ']') bracketCount--;
    }
    lastChar = char;
  }

  // Close any unclosed strings
  if (inString) repaired += '"';

  // Remove trailing incomplete properties
  repaired = repaired.replace(/,\s*$/, '');
  repaired = repaired.replace(/:\s*$/, ': null');
  repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*$/, '');
  repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/, '');

  // Close remaining brackets/braces
  while (bracketCount > 0) { repaired += ']'; bracketCount--; }
  while (braceCount > 0) { repaired += '}'; braceCount--; }

  return repaired;
}

// Build PYQ prompt
function buildPYQPrompt(subject: string, topics: string[], examType: string, sourceContent?: string) {
  const examConfig = getExamConfig(examType);
  const topicStr = topics.join(", ");

  const contextSection = sourceContent && sourceContent.trim().length > 0
    ? `\nStudy context provided:\n---\n${sourceContent}\n---\n`
    : "";

  const isSikkimOrStatePSC = /sikkim|spsc|psc|public service/i.test(examType || "");

  return `You are an expert ${examConfig.examName} question paper analyst with deep knowledge of previous year questions from ${examConfig.examFull} and related exams like ${examConfig.referenceExams}.

TOPIC: ${subject} - ${topicStr}
${contextSection}
TASK: Generate 6-8 Previous Year Question (PYQ) style MCQs that are commonly asked in ${examConfig.examName} examinations.
${isSikkimOrStatePSC ? `
CRITICAL MIX REQUIREMENT:
- Generate 4-5 questions in UPSC CSE pattern (analytical, statement-based, conceptual) on this topic
- Generate 2-3 questions with state/regional focus (Sikkim-specific facts, local governance, state-level context) on this topic
- Use examReference "Similar to UPSC CSE 2023" for UPSC-pattern questions
- Use examReference "Similar to SPSC 2023" for Sikkim-specific questions
- Both types should be high-quality, exam-standard questions
` : ""}
${examConfig.examName} QUESTION CHARACTERISTICS:
${examConfig.questionStyle}

QUESTION TYPES TO INCLUDE:
${examConfig.questionTypes}

DIFFICULTY DISTRIBUTION:
- 3-4 Easy: Direct facts frequently asked
- 4-5 Medium: Conceptual questions requiring understanding
- 3-4 Hard: Multi-concept questions or less common facts

CRITICAL RULES:
1. Questions MUST be ${examConfig.examName}-style - direct, professional
2. Include exam reference (e.g., "Similar to ${examConfig.exampleRef}")
3. NEVER reference "content", "passage", "video", or sources
4. Each option MUST have detailed explanation
5. Mark high-yield topics that are frequently asked

EMOJI MARKERS: ${examConfig.emojiMarkers}

Return ONLY valid JSON:
{
  "title": "${examConfig.examName} PYQs: ${subject} - ${topics[0]}",
  "questions": [
    {
      "id": "1",
      "question": "Question with emoji marker",
      "difficulty": "medium",
      "examReference": "Similar to ${examConfig.exampleRef}",
      "options": [
        {"id": "a", "text": "Option A", "explanation": "Why correct/incorrect"},
        {"id": "b", "text": "Option B", "explanation": "Why correct/incorrect"},
        {"id": "c", "text": "Option C", "explanation": "Why correct/incorrect"},
        {"id": "d", "text": "Option D", "explanation": "Why correct/incorrect"}
      ],
      "correctOptionId": "a",
      "explanation": "Detailed explanation with exam relevance",
      "highYield": true
    }
  ]
}`;
}

// Build Quiz prompt
function buildQuizPrompt(subject: string, topics: string[], examType: string, sourceContent?: string) {
  const examName = examType?.toLowerCase().includes("sikkim") ? "Sikkim PSC" : "UPSC";
  const topicStr = topics.join(", ");

  const contextSection = sourceContent && sourceContent.trim().length > 0
    ? `\nStudy context:\n---\n${sourceContent}\n---\n`
    : "";

  return `Create 12-15 MCQ questions for ${examName} preparation on: ${subject} - ${topicStr}
${contextSection}
CRITICAL RULES:
1. Questions must be CLEAN and DIRECT - just the question text
2. NEVER reference "content", "passage", "video", or sources
3. Write questions testing GENERAL KNOWLEDGE, not comprehension

Include difficulty levels (easy/medium/hard) and DETAILED PER-OPTION EXPLANATIONS.
Use emoji markers: 📜 History | 🏛️ Government | 💰 Economy | 🌍 Geography | 🔬 Science

Return ONLY valid JSON:
{
  "title": "Quiz: ${subject}",
  "questions": [
    {
      "id": "1",
      "question": "🏛️ Question text?",
      "difficulty": "easy",
      "options": [
        {"id": "a", "text": "Option A", "explanation": "Why correct/incorrect"},
        {"id": "b", "text": "Option B", "explanation": "Why correct/incorrect"},
        {"id": "c", "text": "Option C", "explanation": "Why correct/incorrect"},
        {"id": "d", "text": "Option D", "explanation": "Why correct/incorrect"}
      ],
      "correctOptionId": "a",
      "explanation": "Summary explanation"
    }
  ]
}`;
}

// Build Summary prompt
function buildSummaryPrompt(subject: string, topics: string[], examType: string, sourceContent?: string) {
  const examName = examType?.toLowerCase().includes("sikkim") ? "Sikkim PSC" : "UPSC";
  const topicStr = topics.join(", ");

  const contextSection = sourceContent && sourceContent.trim().length > 0
    ? `\nSource content:\n---\n${sourceContent}\n---\n`
    : "";

  return `You are an expert ${examName} educator. Create a comprehensive summary for: ${subject} - ${topicStr}
${contextSection}
Include specific facts, names, dates, and exam-relevant details.
Use emoji markers: 📜 History | 🏛️ Government | 💰 Economy | 🌍 Geography | 🔬 Science | 🎯 Key fact

Return ONLY valid JSON:
{
  "title": "Summary: ${subject}",
  "keyPoints": ["🏛️ Point 1 with specific detail", "💰 Point 2..."],
  "examFacts": ["🎯 Fact 1", "Fact 2..."],
  "keyDates": [{"date": "Date", "event": "Event"}],
  "keyConcepts": [{"concept": "Name", "explanation": "Brief explanation"}]
}`;
}

// Build Slides prompt
function buildSlidesPrompt(subject: string, topics: string[], examType: string, sourceContent?: string) {
  const examConfig = getExamConfig(examType);
  const topicStr = topics.join(", ");
  const topicCount = topics.length;

  // Calculate slides: ~8-10 per sub-topic, minimum 15, maximum 25
  const slidesPerTopic = topicCount <= 1 ? 18 : Math.max(8, Math.floor(20 / topicCount));
  const totalSlides = Math.min(25, Math.max(15, slidesPerTopic * topicCount + 2)); // +2 for title & closing

  const contextSection = sourceContent && sourceContent.trim().length > 0
    ? `\nSource content:\n---\n${sourceContent}\n---\n`
    : "";

  const topicBreakdown = topics.length > 1
    ? `\nSUB-TOPIC COVERAGE (dedicate ~${slidesPerTopic} slides to EACH):\n${topics.map((t, i) => `${i + 1}. "${t}" — cover ALL key concepts, articles, provisions, facts, dates, and exam-relevant details`).join("\n")}\n`
    : "";

  return `You are an expert ${examConfig.examName} educator creating a COMPREHENSIVE, DATA-DENSE animated presentation for exam preparation.

TOPIC: ${subject} - ${topicStr}
${contextSection}${topicBreakdown}
Create exactly ${totalSlides} presentation slides. This must be a THOROUGH lecture-quality presentation — not a summary. Pack each slide with specific facts, article numbers, dates, names, provisions, and exam-critical details.

LAYOUT TYPES (use ALL types across the presentation):
- "title": Opening slide with topic name + emoji
- "bullets": 4-6 bullet points with SPECIFIC facts (article numbers, dates, names)
- "two-column": Side-by-side comparison/categorization (leftColumn + rightColumn, each with heading and 3-5 items)
- "highlight": One critical exam fact (highlightText + highlightSubtext) — use for landmark cases, key articles, important amendments
- "comparison": Two columns contrasting concepts (e.g., FR vs DPSP, Original vs Amended)
- "timeline": Chronological events/amendments (timelineItems with label + description, 4-6 items)
- "closing": Key takeaways and exam tips as bullets

SLIDE STRUCTURE:
- Slide 1: "title" layout — topic overview
- Slides 2-${totalSlides - 1}: Dense content slides covering EVERY sub-topic thoroughly
- Slide ${totalSlides}: "closing" layout — exam tips & frequently tested points

CONTENT DENSITY RULES:
1. Bullets: 4-6 per slide, each containing SPECIFIC data (not vague statements)
   BAD: "Fundamental Rights are important"
   GOOD: "Art 14: Equality before law — applies to citizens AND non-citizens"
2. Two-column slides: 3-5 items per column with concrete details
3. Timeline slides: 4-6 events with specific years and outcomes
4. Highlight slides: Include the exact article/amendment number + its significance
5. Speaker notes: 2-3 sentences with exam tips, mnemonics, frequently asked angles, and tricky facts

GENERAL RULES:
1. Each slide title: max 60 chars, descriptive
2. Use relevant emoji per slide
3. Include speakerNotes with deeper explanation AND exam tips on EVERY slide
4. Vary transitions: "fade", "slideLeft", "slideUp", "zoom" across slides
5. Content must be factually accurate with correct article numbers, dates, case names
6. Cover edge cases and exceptions that exams love to test
7. NEVER reference "content", "passage", or "source material"

Return ONLY valid JSON:
{
  "title": "Slides: ${subject} - ${topics[0]}",
  "themeColor": "blue",
  "slides": [
    {
      "id": "1",
      "title": "Slide title with emoji",
      "layout": "title",
      "emoji": "🏛️",
      "bullets": ["Subtitle with scope"],
      "speakerNotes": "Overview and what to expect",
      "transition": "zoom"
    },
    {
      "id": "2",
      "title": "Key Provisions",
      "layout": "bullets",
      "emoji": "📌",
      "bullets": ["Art X: Specific provision detail", "Art Y: Another key fact", "Art Z: Important exception"],
      "speakerNotes": "Exam tip: This is frequently asked in prelims...",
      "transition": "slideLeft"
    }
  ]
}`;
}

// Build Flashcards prompt
function buildFlashcardsPrompt(subject: string, topics: string[], examType: string, sourceContent?: string) {
  const examName = examType?.toLowerCase().includes("sikkim") ? "Sikkim PSC" : "UPSC";
  const topicStr = topics.join(", ");

  const contextSection = sourceContent && sourceContent.trim().length > 0
    ? `\nSource content:\n---\n${sourceContent}\n---\n`
    : "";

  return `You are an expert ${examName} educator. Create 15-25 flashcards for: ${subject} - ${topicStr}
${contextSection}
CRITICAL RULES:
1. Each card tests ONE specific fact, definition, article, date, or concept
2. Questions must be DIRECT — never reference sources or passages
3. Answers must be concise but complete
4. Cover ALL important topics, articles, provisions, dates, and key terms
5. Include difficulty levels

Return ONLY valid JSON:
{
  "title": "Flashcards: ${subject}",
  "cards": [
    {
      "id": "1",
      "front": "What does Article 14 of the Indian Constitution guarantee?",
      "back": "Equality before law and equal protection of laws within the territory of India. Applies to both citizens and non-citizens.",
      "difficulty": "easy",
      "category": "${subject}"
    }
  ]
}`;
}

// Build Infographic prompt
function buildInfographicPrompt(subject: string, topics: string[], examType: string, sourceContent?: string) {
  const examName = examType?.toLowerCase().includes("sikkim") ? "Sikkim PSC" : "UPSC";
  const topicStr = topics.join(", ");

  const contextSection = sourceContent && sourceContent.trim().length > 0
    ? `\nSource content:\n---\n${sourceContent}\n---\n`
    : "";

  return `You are an expert ${examName} educator. Create a structured infographic summary for: ${subject} - ${topicStr}
${contextSection}
Include specific facts, article numbers, dates, and exam-relevant details.
Use emoji markers for visual scanning.

Return ONLY valid JSON:
{
  "title": "Infographic: ${subject}",
  "keyFacts": [
    {"emoji": "🏛️", "label": "Key fact label", "value": "Specific detail with article/date"},
    {"emoji": "📜", "label": "Another fact", "value": "Detail"}
  ],
  "highlights": [
    {
      "title": "Section heading",
      "items": ["Specific point 1 with data", "Specific point 2", "Specific point 3"]
    }
  ],
  "timeline": [
    {"year": "1950", "event": "Constitution came into effect"}
  ],
  "comparisons": [
    {
      "title": "Comparison title",
      "left": {"label": "Left", "items": ["Item 1", "Item 2"]},
      "right": {"label": "Right", "items": ["Item 1", "Item 2"]}
    }
  ],
  "examTips": ["Tip 1 for exam preparation", "Tip 2"]
}`;
}

// Build Mind Map prompt
function buildMindmapPrompt(subject: string, topics: string[], examType: string, sourceContent?: string) {
  const examName = examType?.toLowerCase().includes("sikkim") ? "Sikkim PSC" : "UPSC";
  const topicStr = topics.join(", ");

  const contextSection = sourceContent && sourceContent.trim().length > 0
    ? `\nSource content:\n---\n${sourceContent}\n---\n`
    : "";

  return `You are an expert ${examName} educator. Create a mind map structure for: ${subject} - ${topicStr}
${contextSection}
Create a hierarchical mind map with the main topic at center, major branches, and sub-branches with specific details.

Return ONLY valid JSON:
{
  "title": "Mind Map: ${subject}",
  "markdown": "# ${subject}\\n## ${topicStr}\\n### Key Concept 1\\n- Detail 1\\n- Detail 2\\n### Key Concept 2\\n- Detail 1\\n- Detail 2"
}`;
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

    // Auth is optional - Supabase handles JWT verification at infrastructure level
    // If needed, we can verify the token here, but for now we skip it
    const authHeader = req.headers.get("Authorization");
    console.log(`[generate-topic-content] Auth header present: ${!!authHeader}`);

    const body = await req.json();
    const { subject, topics, examType, examDisplayName, generationType, sourceContent, questionOffset, excludeQuestionIds } = body;

    if (!subject || !topics || !generationType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For PYQ: Search real questions first, then fill with AI
    if (generationType === "pyq") {
      const targetTotal = 8;
      const excludeIds = excludeQuestionIds || [];

      // Step 1: Try semantic search first, fall back to keyword search
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      let realQuestions: any[] = [];

      const queryEmbedding = await generateQueryEmbedding(genAI, subject, topics);
      if (queryEmbedding) {
        realQuestions = await searchRealPYQsSemantic(
          queryEmbedding, subject, examType || "upsc", targetTotal, excludeIds
        );
        console.log(`[generate-topic-content] Semantic search returned ${realQuestions.length} questions`);
      }

      // Fall back to keyword search if semantic returned too few
      if (realQuestions.length < targetTotal) {
        const keywordExcludeIds = [...excludeIds, ...realQuestions.map(q => q.dbId).filter(Boolean)];
        const keywordResults = await searchRealPYQs(
          subject, topics, examType || "upsc",
          targetTotal - realQuestions.length,
          keywordExcludeIds
        );
        realQuestions = [...realQuestions, ...keywordResults];
        console.log(`[generate-topic-content] After keyword fallback: ${realQuestions.length} total`);
      }

      // Step 2: Calculate how many AI questions needed
      const aiNeeded = Math.max(0, targetTotal - realQuestions.length);
      let aiQuestions: any[] = [];

      // Step 3: Generate AI questions if needed
      if (aiNeeded > 0) {
        console.log(`[generate-topic-content] Generating ${aiNeeded} AI questions to fill gap`);

        // Build prompt that avoids duplicating real questions
        const existingQuestionsContext = realQuestions.length > 0
          ? `\n\nAVOID DUPLICATES - These questions already exist:\n${realQuestions.map(q => `- ${q.question.substring(0, 100)}...`).join("\n")}\n`
          : "";

        const prompt = buildPYQPrompt(subject, topics, examType || "upsc", sourceContent) + existingQuestionsContext + `\n\nGenerate exactly ${aiNeeded} NEW questions that are DIFFERENT from the existing ones.`;

        const model = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.9,
            maxOutputTokens: 16384,
          },
        });

        try {
          const result = await model.generateContent(prompt);
          const responseText = result.response.text();

          let cleanedText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const jsonStartIndex = cleanedText.indexOf("{");
          if (jsonStartIndex > 0) cleanedText = cleanedText.slice(jsonStartIndex);

          let aiContent;
          try {
            aiContent = JSON.parse(cleanedText);
          } catch {
            aiContent = JSON.parse(repairTruncatedJSON(cleanedText));
          }

          // Add source: "ai" to each AI question
          aiQuestions = (aiContent.questions || []).slice(0, aiNeeded).map((q: any, i: number) => ({
            ...q,
            id: String(realQuestions.length + i + 1),
            source: "ai",
            examReference: q.examReference || `Similar to ${getExamConfig(examType).exampleRef}`,
          }));
        } catch (aiError) {
          console.error("[generate-topic-content] AI generation failed:", aiError);
          // Continue with just real questions
        }
      }

      // Step 4: Combine real + AI questions
      const allQuestions = [...realQuestions, ...aiQuestions];

      // Re-number IDs based on offset (for "Generate More")
      const startId = (questionOffset || 0) + 1;
      allQuestions.forEach((q, i) => {
        q.id = String(startId + i);
      });

      const examConfig = getExamConfig(examType);
      const displayName = examDisplayName || examConfig.examName;
      const title = `${displayName} PYQs: ${subject} - ${topics[0] || ""}`;

      return new Response(
        JSON.stringify({
          success: true,
          content: {
            title,
            questions: allQuestions,
            realCount: realQuestions.length,
            aiCount: aiQuestions.length,
            notAvailable: allQuestions.length === 0,
            message: allQuestions.length === 0 ? "No questions available for this topic." : undefined,
          },
          title,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build prompt based on generation type (non-PYQ)
    let prompt: string;
    switch (generationType) {
      case "quiz":
        prompt = buildQuizPrompt(subject, topics, examType || "upsc", sourceContent);
        break;
      case "summary":
        prompt = buildSummaryPrompt(subject, topics, examType || "upsc", sourceContent);
        break;
      case "slides":
        prompt = buildSlidesPrompt(subject, topics, examType || "upsc", sourceContent);
        break;
      case "flashcards":
        prompt = buildFlashcardsPrompt(subject, topics, examType || "upsc", sourceContent);
        break;
      case "infographic":
        prompt = buildInfographicPrompt(subject, topics, examType || "upsc", sourceContent);
        break;
      case "mindmap":
        prompt = buildMindmapPrompt(subject, topics, examType || "upsc", sourceContent);
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Invalid generation type. Supported: pyq, quiz, summary, slides, flashcards, infographic, mindmap" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`[generate-topic-content] Generating ${generationType} for ${subject}`);

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const maxTokens = generationType === "slides" ? 24576 : 8192;
    // Use FAST_MODEL for slides (structured/templated output), quality model for others
    const modelName = generationType === "slides" ? FAST_MODEL : GEMINI_MODEL;
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.7,  // Slightly lower for more reliable JSON output
        topK: 40,
        topP: 0.9,
        maxOutputTokens: maxTokens,
      },
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Log raw response info for debugging
    console.log(`[generate-topic-content] Raw response length: ${responseText.length}`);
    console.log(`[generate-topic-content] Response ends with: "${responseText.slice(-100)}"`);

    // Clean and parse JSON
    let cleanedText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const jsonStartIndex = cleanedText.indexOf("{");
    if (jsonStartIndex > 0) {
      cleanedText = cleanedText.slice(jsonStartIndex);
    }

    let content;
    try {
      content = JSON.parse(cleanedText);
      console.log(`[generate-topic-content] JSON parsed successfully, questions: ${content.questions?.length || 0}`);
    } catch (parseError) {
      console.warn("[generate-topic-content] Initial parse failed:", parseError);
      console.warn("[generate-topic-content] Cleaned text ends with:", cleanedText.slice(-200));
      try {
        const repairedText = repairTruncatedJSON(cleanedText);
        console.log("[generate-topic-content] Repaired text ends with:", repairedText.slice(-100));
        content = JSON.parse(repairedText);
        console.log(`[generate-topic-content] Repaired JSON parsed, questions: ${content.questions?.length || 0}`);
      } catch (repairError) {
        console.error("[generate-topic-content] Repair also failed:", repairError);
        return new Response(
          JSON.stringify({ error: "Failed to generate content. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        content,
        title: content.title || `${generationType}: ${subject}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[generate-topic-content] Error:", errorMessage);

    if (errorMessage.includes("429") || errorMessage.includes("quota")) {
      return new Response(
        JSON.stringify({ error: "AI service is busy. Please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Failed to generate content. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
