// ============================================
// INGEST PYQ PDF EDGE FUNCTION
// ============================================
// Accepts a PDF (as base64) and uses Gemini to extract structured MCQ questions.
// Designed for bulk-ingesting previous year question papers into the pyq_questions table.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = Deno.env.get("GEMINI_BASIC_MODEL") ?? "gemini-3.1-flash-lite";

// Repair truncated JSON by finding last complete question object and closing the array
function repairTruncatedJSON(text: string): string {
  let repaired = text.trim();

  // Strategy 1: Find the last complete question object
  // Look for closing pattern of a question: "cognitive_level": "..." }
  const questionEndPattern = /"cognitive_level"\s*:\s*"[^"]*"\s*\}/g;
  let lastCompleteQuestion = -1;
  let match;

  while ((match = questionEndPattern.exec(repaired)) !== null) {
    lastCompleteQuestion = match.index + match[0].length;
  }

  if (lastCompleteQuestion > 0) {
    repaired = repaired.substring(0, lastCompleteQuestion);
    repaired = repaired.trimEnd();
    if (repaired.endsWith(",")) {
      repaired = repaired.slice(0, -1);
    }
    // Close the array
    repaired += "]";
    return repaired;
  }

  // Strategy 2: Fallback - balance braces/brackets
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let lastChar = "";
  let lastValidEnd = -1;

  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (char === '"' && lastChar !== "\\") inString = !inString;
    if (!inString) {
      if (char === "{") braceCount++;
      if (char === "}") {
        braceCount--;
        if (braceCount >= 0) lastValidEnd = i + 1;
      }
      if (char === "[") bracketCount++;
      if (char === "]") {
        bracketCount--;
        if (bracketCount >= 0) lastValidEnd = i + 1;
      }
    }
    lastChar = char;
  }

  if (lastValidEnd > 0 && lastValidEnd < repaired.length) {
    repaired = repaired.substring(0, lastValidEnd);
  }

  // Recount unclosed structures
  braceCount = 0;
  bracketCount = 0;
  inString = false;
  lastChar = "";

  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (char === '"' && lastChar !== "\\") inString = !inString;
    if (!inString) {
      if (char === "{") braceCount++;
      if (char === "}") braceCount--;
      if (char === "[") bracketCount++;
      if (char === "]") bracketCount--;
    }
    lastChar = char;
  }

  if (inString) repaired += '"';

  repaired = repaired.replace(/,\s*$/, "");
  repaired = repaired.replace(/:\s*$/, ": null");
  repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*$/, "");
  repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/, "");

  while (bracketCount > 0) { repaired += "]"; bracketCount--; }
  while (braceCount > 0) { repaired += "}"; braceCount--; }

  return repaired;
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

    // Auth: Extract JWT from Authorization header and verify user
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing authorization token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ingest-pyq-pdf] Authenticated user: ${user.id}`);

    // Parse request body
    const body = await req.json();
    const { pdf_base64, exam_name, exam_year, exam_stage } = body;

    if (!pdf_base64 || !exam_name || !exam_year) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: pdf_base64, exam_name, exam_year" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ingest-pyq-pdf] Processing PDF for ${exam_name} ${exam_year}${exam_stage ? ` ${exam_stage}` : ""}`);
    console.log(`[ingest-pyq-pdf] PDF base64 length: ${pdf_base64.length}`);

    // Build the extraction prompt
    const extractionPrompt = `You are an expert exam question paper analyst. Extract ALL multiple-choice questions (MCQs) from this PDF question paper.

EXAM DETAILS:
- Exam: ${exam_name}
- Year: ${exam_year}
${exam_stage ? `- Stage: ${exam_stage}` : ""}

TASK: Extract every MCQ from this question paper. For each question, provide structured data.

RULES:
1. Extract ALL questions - do not skip any
2. Preserve the exact question text as written in the paper
3. Preserve all options exactly as written
4. If the answer key is provided in the PDF, include the correct_option_id. If not, set it to null
5. Classify each question by subject, topics, subtopic, difficulty, question_type, and cognitive_level
6. For questions with Hindi/regional language text, transliterate or translate to English
7. If a question references a passage or paragraph, include the relevant context in the question text

SUBJECT CLASSIFICATION:
- For civil services exams: Indian Polity, History, Geography, Economy, Science & Technology, Environment, Current Affairs, General Knowledge, Sikkim GK, etc.
- For engineering exams: Physics, Chemistry, Mathematics, etc.
- For medical exams: Biology, Physics, Chemistry, etc.

DIFFICULTY LEVELS: easy, medium, hard

QUESTION TYPES: factual, conceptual, analytical, application, statement_based, match_the_following, assertion_reason

COGNITIVE LEVELS: remember, understand, apply, analyze, evaluate

Return ONLY a valid JSON array (no wrapping object, just the array) with this structure:
[
  {
    "question": "The full question text",
    "options": [
      {"id": "a", "text": "Option A text"},
      {"id": "b", "text": "Option B text"},
      {"id": "c", "text": "Option C text"},
      {"id": "d", "text": "Option D text"}
    ],
    "correct_option_id": "a" or null,
    "explanation": "Brief explanation if determinable, or empty string",
    "subject": "Subject name",
    "topics": ["Topic1", "Topic2"],
    "subtopic": "Specific subtopic",
    "difficulty": "easy|medium|hard",
    "question_type": "factual|conceptual|analytical|application|statement_based|match_the_following|assertion_reason",
    "cognitive_level": "remember|understand|apply|analyze|evaluate"
  }
]

Extract ALL questions from the paper. Be thorough and accurate.`;

    // Call Gemini with PDF inline data
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0.1, // Low temperature for accurate extraction
        maxOutputTokens: 65536,
      },
    });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdf_base64,
        },
      },
      { text: extractionPrompt },
    ]);

    const responseText = result.response.text();
    console.log(`[ingest-pyq-pdf] Raw response length: ${responseText.length}`);
    console.log(`[ingest-pyq-pdf] Response ends with: "${responseText.slice(-100)}"`);

    // Clean and parse JSON
    let cleanedText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // Find the start of the JSON array
    const arrayStartIndex = cleanedText.indexOf("[");
    if (arrayStartIndex > 0) {
      cleanedText = cleanedText.slice(arrayStartIndex);
    }

    let questions: any[];
    try {
      questions = JSON.parse(cleanedText);
      console.log(`[ingest-pyq-pdf] JSON parsed successfully, questions: ${questions.length}`);
    } catch (parseError) {
      console.warn("[ingest-pyq-pdf] Initial parse failed:", parseError);
      console.warn("[ingest-pyq-pdf] Cleaned text ends with:", cleanedText.slice(-200));
      try {
        const repairedText = repairTruncatedJSON(cleanedText);
        console.log("[ingest-pyq-pdf] Repaired text ends with:", repairedText.slice(-100));
        questions = JSON.parse(repairedText);
        console.log(`[ingest-pyq-pdf] Repaired JSON parsed, questions: ${questions.length}`);
      } catch (repairError) {
        console.error("[ingest-pyq-pdf] Repair also failed:", repairError);
        return new Response(
          JSON.stringify({
            error: "Failed to parse extracted questions from PDF. The PDF may be too complex or the response was truncated.",
            raw_response_length: responseText.length,
            raw_response_preview: responseText.slice(0, 500),
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Validate and normalize the extracted questions
    if (!Array.isArray(questions)) {
      // If Gemini returned a wrapper object, try to extract the array
      if (questions && typeof questions === "object") {
        const possibleArrayKey = Object.keys(questions).find(
          (k) => Array.isArray((questions as any)[k])
        );
        if (possibleArrayKey) {
          questions = (questions as any)[possibleArrayKey];
        } else {
          return new Response(
            JSON.stringify({ error: "Extracted data is not an array of questions" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Enrich each question with exam metadata
    const enrichedQuestions = questions.map((q: any, index: number) => ({
      question: q.question || "",
      options: Array.isArray(q.options) ? q.options : [],
      correct_option_id: q.correct_option_id || null,
      explanation: q.explanation || "",
      subject: q.subject || "General",
      topics: Array.isArray(q.topics) ? q.topics : [],
      subtopic: q.subtopic || "",
      exam_name: exam_name,
      exam_year: exam_year,
      exam_stage: exam_stage || null,
      difficulty: ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium",
      question_type: q.question_type || "factual",
      cognitive_level: q.cognitive_level || "remember",
      extraction_index: index + 1,
    }));

    console.log(`[ingest-pyq-pdf] Extracted ${enrichedQuestions.length} questions from PDF`);

    return new Response(
      JSON.stringify({
        success: true,
        exam_name,
        exam_year,
        exam_stage: exam_stage || null,
        total_questions: enrichedQuestions.length,
        questions: enrichedQuestions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[ingest-pyq-pdf] Error:", errorMessage);

    if (errorMessage.includes("429") || errorMessage.includes("quota")) {
      return new Response(
        JSON.stringify({ error: "AI service is busy. Please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Failed to process PDF. Please try again.", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
