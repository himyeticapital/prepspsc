import { AI_MODELS } from "@/lib/ai-models";
import { enforceDailyCap } from "@/lib/daily-cap";
import { hasProAccess } from "@/lib/access";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120; // Allow up to 2 minutes for AI processing

const FREE_USER_MONTHLY_LIMIT = 3;

// Initialize Gemini
function getGeminiModel() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_NOT_CONFIGURED");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: AI_MODELS.basic,
    generationConfig: {
      temperature: 0.3,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  });
}

// Retry helper for rate limits
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 5000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message || "";

      const isRateLimit =
        (error as { status?: number })?.status === 429 ||
        errorMessage.includes("429") ||
        errorMessage.includes("Resource exhausted");

      if (!isRateLimit || attempt === maxRetries) {
        throw error;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), 60000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Check and update user's extraction credits
async function checkExtractionCredits(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  userId: string
): Promise<{ allowed: boolean; remaining: number; isPro: boolean; error?: string }> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_pro_member, microtheme_extractions_used, microtheme_extractions_reset_at")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    return { allowed: false, remaining: 0, isPro: false, error: "Failed to fetch profile" };
  }

  // Pro users have unlimited extractions
  if (hasProAccess(profile)) {
    return { allowed: true, remaining: -1, isPro: true }; // -1 means unlimited
  }

  // Check if we need to reset the monthly counter
  const resetDate = profile.microtheme_extractions_reset_at
    ? new Date(profile.microtheme_extractions_reset_at)
    : new Date(0);
  const now = new Date();

  let extractionsUsed = profile.microtheme_extractions_used || 0;

  // Reset if it's a new month
  if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
    await supabase
      .from("profiles")
      .update({
        microtheme_extractions_used: 0,
        microtheme_extractions_reset_at: now.toISOString(),
      })
      .eq("id", userId);
    extractionsUsed = 0;
  }

  const remaining = FREE_USER_MONTHLY_LIMIT - extractionsUsed;

  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      isPro: false,
      error: `Monthly limit reached (${FREE_USER_MONTHLY_LIMIT} extractions). Upgrade to Pro for unlimited extractions.`,
    };
  }

  return { allowed: true, remaining, isPro: false };
}

// Increment extraction count after successful extraction
async function incrementExtractionCount(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  userId: string
): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("microtheme_extractions_used")
    .eq("id", userId)
    .single();

  const currentCount = profile?.microtheme_extractions_used || 0;

  await supabase
    .from("profiles")
    .update({ microtheme_extractions_used: currentCount + 1 })
    .eq("id", userId);
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

    // Check extraction credits
    const creditCheck = await checkExtractionCredits(supabase, user.id);

    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error: creditCheck.error,
          remaining: creditCheck.remaining,
          isPro: creditCheck.isPro,
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { examId } = body;

    if (!examId) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 });
    }

    // Per-user daily cap (abuse guard; see src/lib/daily-cap.ts)
    const dailyCapResponse = await enforceDailyCap(user.id, "examExtraction");
    if (dailyCapResponse) return dailyCapResponse;

    // Fetch exam with all uploads and verify ownership
    const { data: exam, error: examError } = await supabase
      .from("user_custom_exams")
      .select(`
        *,
        user_custom_exam_uploads(*)
      `)
      .eq("id", examId)
      .eq("user_id", user.id)
      .single();

    if (examError || !exam) {
      return NextResponse.json({ error: "Exam not found or access denied" }, { status: 404 });
    }

    // Get syllabus content
    const syllabusContent = exam.syllabus_content || "";

    // Get PYQ content from all uploads
    const pyqUploads = (exam.user_custom_exam_uploads || []).filter(
      (u: { upload_type: string; parsed_content?: string }) =>
        u.upload_type === "pyq" && u.parsed_content
    );
    const pyqContent = pyqUploads
      .map((u: { year?: string; parsed_content: string }) =>
        `\n--- PYQ ${u.year || "Unknown Year"} ---\n${u.parsed_content}`
      )
      .join("\n\n");

    // Check if we have content to analyze
    if (!syllabusContent && !pyqContent) {
      return NextResponse.json(
        { error: "No content available. Please upload syllabus or PYQ documents first, or paste syllabus text." },
        { status: 400 }
      );
    }

    console.log(
      `[User Microtheme Extraction] User: ${user.id}, Exam: ${examId}, Content lengths - Syllabus: ${syllabusContent.length} chars, PYQ: ${pyqContent.length} chars`
    );

    // Determine the source of microthemes
    const hasPYQs = pyqUploads.length > 0;
    const microthemesSource: "pyq_analysis" | "syllabus_estimation" = hasPYQs
      ? "pyq_analysis"
      : "syllabus_estimation";

    const model = getGeminiModel();

    // Build the extraction prompt
    const sourceNote = hasPYQs
      ? "Analyze the PYQs to calculate ACTUAL question frequencies and importance levels."
      : `IMPORTANT: No PYQ data available. ESTIMATE pyqFrequency based on:
- Syllabus weightage (topics with more detail = higher frequency)
- Standard exam patterns for this type of exam
- Mark as estimated: Use reasonable estimates (8-15 for high priority, 4-8 for medium, 1-4 for low)`;

    const prompt = `You are an expert exam preparation analyst. Analyze the following exam syllabus${hasPYQs ? " and previous year questions (PYQs)" : ""} to extract detailed microthemes for study planning.

${sourceNote}

EXAM NAME: ${exam.name}
CATEGORY: ${exam.category || "Not specified"}

${syllabusContent ? `SYLLABUS CONTENT:\n${syllabusContent}\n` : ""}
${pyqContent ? `PREVIOUS YEAR QUESTIONS:\n${pyqContent}\n` : ""}

TASK: Extract structured microthemes DIRECTLY FROM THE SYLLABUS CONTENT.

CRITICAL RULES:
1. Extract 8-20 microthemes based on the ACTUAL syllabus structure
2. Each microtheme should represent a major subject/unit from the syllabus
3. DO NOT invent subjects that are not in the syllabus
4. Subjects should be named exactly as they appear in the syllabus

For EACH microtheme, extract:
- subject: The main subject/unit name from syllabus
- topics: 4-8 main chapters or sub-areas within this subject
- subtopics: 8-20 SPECIFIC testable items including:
  * Formulas with variables explained
  * Standard values and constants
  * Key theorems/principles
  * Important definitions
  * Numerical types frequently asked
- pyqFrequency: Question count from PYQs (or estimate from syllabus weightage)
- importance: "high" (8+ questions), "medium" (4-7), "low" (<4)

OUTPUT FORMAT (STRICT JSON):
{
  "microthemes": [
    {
      "subject": "[Subject name from syllabus]",
      "topics": ["Topic 1", "Topic 2", "Topic 3"],
      "subtopics": [
        "Specific concept with formula/value",
        "Key definition or theorem",
        "Important numerical type"
      ],
      "pyqFrequency": 10,
      "importance": "high"
    }
  ],
  "examPattern": {
    "totalSubjects": "[count]",
    "highPrioritySubjects": ["Subject 1", "Subject 2"],
    "recommendedFocus": "Key preparation strategy based on analysis"
  }
}

SUBTOPIC QUALITY GUIDELINES:
- Be SPECIFIC, not generic
- Include NUMBERS and FORMULAS where applicable
- List COMMON QUESTION TYPES

Return ONLY valid JSON, no markdown code blocks or additional text.`;

    // Call Gemini AI
    const result = await withRetry(async () => {
      return await model.generateContent(prompt);
    });

    const responseText = result.response.text();

    // Clean and parse JSON response
    let cleanedText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const jsonStartIndex = cleanedText.indexOf("{");
    if (jsonStartIndex > 0) {
      cleanedText = cleanedText.slice(jsonStartIndex);
    }

    let extractedData;
    try {
      extractedData = JSON.parse(cleanedText);
      console.log(
        `[User Microtheme Extraction] Successfully parsed ${extractedData.microthemes?.length || 0} microthemes`
      );
    } catch (parseError) {
      console.error("[User Microtheme Extraction] Failed to parse JSON:", parseError);
      return NextResponse.json(
        { error: "AI returned invalid response. Please try again." },
        { status: 500 }
      );
    }

    // Validate the response structure
    if (!extractedData.microthemes || !Array.isArray(extractedData.microthemes)) {
      return NextResponse.json(
        { error: "Invalid microthemes structure returned by AI" },
        { status: 500 }
      );
    }

    // Update the exam with extracted microthemes
    const { error: updateError } = await supabase
      .from("user_custom_exams")
      .update({
        microthemes: extractedData.microthemes,
        microthemes_source: microthemesSource,
        extraction_count: (exam.extraction_count || 0) + 1,
      })
      .eq("id", examId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Failed to save microthemes:", updateError);
      return NextResponse.json({ error: "Failed to save microthemes" }, { status: 500 });
    }

    // Increment user's extraction count (for free users)
    if (!creditCheck.isPro) {
      await incrementExtractionCount(supabase, user.id);
    }

    return NextResponse.json({
      success: true,
      microthemes: extractedData.microthemes,
      examPattern: extractedData.examPattern || null,
      totalMicrothemes: extractedData.microthemes.length,
      source: microthemesSource,
      hasPYQs,
      remaining: creditCheck.isPro ? -1 : creditCheck.remaining - 1,
      isPro: creditCheck.isPro,
    });
  } catch (error: unknown) {
    console.error("User microtheme extraction error:", error);

    const errorObj = error as { status?: number; message?: string };

    // Handle rate limit errors
    if (errorObj?.status === 429 || errorObj?.message?.includes("429")) {
      return NextResponse.json(
        { error: "AI service is busy. Please wait a few minutes and try again." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to extract microthemes. Please try again." },
      { status: 500 }
    );
  }
}

// GET - Check remaining extraction credits
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const creditCheck = await checkExtractionCredits(supabase, user.id);

    return NextResponse.json({
      remaining: creditCheck.remaining,
      limit: FREE_USER_MONTHLY_LIMIT,
      isPro: creditCheck.isPro,
      unlimited: creditCheck.isPro,
    });
  } catch (error) {
    console.error("Get extraction credits error:", error);
    return NextResponse.json({ error: "Failed to check credits" }, { status: 500 });
  }
}
