import { AI_MODELS, BASIC_MODEL_CHAIN } from "@/lib/ai-models";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { MCQFeedback, ConventionalFeedback, QuestionOption, MCQPregenExplanation } from "@/types/database.types";

// Initialize Gemini client
const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
if (!apiKey) {
  console.error("WARNING: GOOGLE_GEMINI_API_KEY is not set. AI features will fail.");
}
const genAI = new GoogleGenerativeAI(apiKey || "");

// =============================================================================
// MODEL CONFIGURATION - GEMINI 3.x
// =============================================================================
// gemini-3-flash-preview: quality model ($0.50 input / $3.00 output)
// gemini-3.1-flash-lite-preview: fast/cheap model ($0.25 input / $1.50 output) — 50% cheaper
// =============================================================================

// Model for quality-critical tasks (conventional grading, MCQ explanations, content generation)
const QUALITY_MODEL = AI_MODELS.basic;

// Model for simpler/faster tasks (OCR, chat, basic analysis) — half the cost of Flash
const FAST_MODEL = AI_MODELS.basic;

// Fallback chain if primary model unavailable
const MODEL_FALLBACKS = BASIC_MODEL_CHAIN.slice(1);


// ============================================================================
// REQUEST QUEUE - Prevents rate limiting by spacing out API calls
// ============================================================================

// Queue state
let requestQueue: Array<{
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}> = [];
let isProcessingQueue = false;
let lastRequestTime = 0;

// Queue configuration - balanced for reliability with reasonable speed
// Paid tier has limits (~60 RPM typical), so we space requests appropriately
const MIN_REQUEST_INTERVAL = 3000; // 3s between requests (~20 RPM, safe margin)
const MAX_CONCURRENT_REQUESTS = 1; // Sequential to avoid rate limit collisions
let activeRequests = 0;

/**
 * Add a request to the queue and wait for it to complete
 */
async function queueRequest<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    requestQueue.push({
      execute: fn as () => Promise<unknown>,
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    processQueue();
  }) as Promise<T>;
}

/**
 * Process queued requests with rate limiting
 */
async function processQueue(): Promise<void> {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    // Wait if we have too many active requests
    if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
      await new Promise(resolve => setTimeout(resolve, 500));
      continue;
    }

    // Enforce minimum interval between requests
    const timeSinceLastRequest = Date.now() - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(resolve =>
        setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
      );
    }

    const request = requestQueue.shift();
    if (!request) continue;

    activeRequests++;
    lastRequestTime = Date.now();

    // Execute request without blocking the queue
    request.execute()
      .then(result => {
        activeRequests--;
        request.resolve(result);
      })
      .catch(error => {
        activeRequests--;
        request.reject(error);
      });
  }

  isProcessingQueue = false;
}

// Cache for working model names
let workingQualityModel: string | null = null;
let workingFastModel: string | null = null;

/**
 * Get the quality model (gemini-3-flash-preview) for critical tasks like grading, explanations
 * Falls back to other models if unavailable
 */
async function getQualityModel() {
  if (workingQualityModel) {
    return genAI.getGenerativeModel({ model: workingQualityModel });
  }

  // Try quality model first, then fallbacks
  const modelsToTry = [QUALITY_MODEL, ...MODEL_FALLBACKS];

  for (const modelName of modelsToTry) {
    const model = genAI.getGenerativeModel({ model: modelName });
    try {
      await model.generateContent("test");
      workingQualityModel = modelName;
      console.log(`Using quality model: ${modelName}`);
      return model;
    } catch (error) {
      const err = error as Error;
      if (err?.message?.includes("404") || err?.message?.includes("not found")) {
        console.log(`Model ${modelName} not available, trying next...`);
        continue;
      }
      workingQualityModel = modelName;
      console.log(`Using quality model: ${modelName}`);
      return model;
    }
  }

  console.error("No quality model found, using default");
  return genAI.getGenerativeModel({ model: QUALITY_MODEL });
}

/**
 * Get the fast model (gemini-3.1-flash-lite-preview) for simpler tasks (OCR, chat, analysis)
 */
async function getFastModel() {
  if (workingFastModel) {
    return genAI.getGenerativeModel({ model: workingFastModel });
  }

  // Try fast model first, then fallbacks
  const modelsToTry = [FAST_MODEL, ...MODEL_FALLBACKS];

  for (const modelName of modelsToTry) {
    const model = genAI.getGenerativeModel({ model: modelName });
    try {
      await model.generateContent("test");
      workingFastModel = modelName;
      console.log(`Using fast model: ${modelName}`);
      return model;
    } catch (error) {
      const err = error as Error;
      if (err?.message?.includes("404") || err?.message?.includes("not found")) {
        console.log(`Model ${modelName} not available, trying next...`);
        continue;
      }
      workingFastModel = modelName;
      console.log(`Using fast model: ${modelName}`);
      return model;
    }
  }

  console.error("No fast model found, using default");
  return genAI.getGenerativeModel({ model: FAST_MODEL });
}

/**
 * @deprecated Use getQualityModel() or getFastModel() instead
 */
async function getWorkingModel() {
  return getQualityModel();
}

// Get the Gemini model for image analysis (vision capable) - uses quality model
const getModel = () => genAI.getGenerativeModel({ model: workingQualityModel || QUALITY_MODEL });

// Get model for simpler text-only tasks - uses fast model
const getFlashModel = () => genAI.getGenerativeModel({ model: workingFastModel || FAST_MODEL });

// Retry helper with exponential backoff
// Optimized for paid tier - faster retries since rate limits are much higher
// Delays: 2s, 4s, 8s, 16s, 32s (capped at 60s)
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelay: number = 2000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const errorMessage = lastError?.message || "";

      // Don't retry on API key errors
      if (errorMessage.includes("API key") || errorMessage.includes("API_KEY")) {
        throw error;
      }

      // Check if it's a daily quota exceeded (not just rate limit)
      if (
        errorMessage.includes("limit: 0") ||
        errorMessage.includes("quota exceeded") ||
        errorMessage.includes("Quota exceeded") ||
        errorMessage.includes("exceeded your current quota") ||
        errorMessage.includes("free_tier_requests")
      ) {
        console.log("API quota exceeded. Cannot retry - please wait or upgrade your plan.");
        throw error;
      }

      // Retry on rate limit errors (429) or server overload (503) with exponential backoff
      if (
        errorMessage.includes("429") ||
        errorMessage.includes("rate") ||
        errorMessage.includes("503") ||
        errorMessage.includes("overloaded") ||
        errorMessage.includes("Service Unavailable") ||
        errorMessage.includes("RESOURCE_EXHAUSTED") ||
        errorMessage.includes("quota")
      ) {
        // Parse suggested retry time from error, or use exponential backoff
        // Cap at 60 seconds for paid tier (higher limits = faster recovery)
        const retryMatch = errorMessage.match(/retry in (\d+)/i);
        const suggestedDelay = retryMatch ? Math.min(parseInt(retryMatch[1]) * 1000, 60000) : null;
        const calculatedDelay = Math.min(baseDelay * Math.pow(2, attempt), 60000);
        const delay = suggestedDelay || calculatedDelay;

        const reason = errorMessage.includes("503") || errorMessage.includes("overloaded")
          ? "Model overloaded"
          : "Rate limited";
        console.log(`${reason}. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // For other errors, throw immediately
      throw error;
    }
  }

  throw lastError;
}

/**
 * Queued retry - combines queue and retry logic
 * First queues the request, then applies retry logic
 * Optimized for paid tier - faster processing with reliable retries
 */
async function withQueuedRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelay: number = 2000
): Promise<T> {
  return queueRequest(() => withRetry(fn, maxRetries, baseDelay));
}

export async function extractPdfTextFromBase64(params: {
  base64: string;
  fileName?: string;
  mimeType?: string;
}): Promise<{ text: string; extractionMethod: "direct" | "vision" }> {
  const model = await getFastModel();
  const mimeType = params.mimeType || "application/pdf";

  const textExtractionPrompt = `You are extracting text from an examination syllabus PDF.

Extract all readable text from every page. Preserve:
- headings and section titles
- exam scheme details like papers, marks, duration, and negative marking
- syllabus subject lists and topic bullets
- educational qualification or eligibility text

Return only the extracted text. If you cannot read useful text, return exactly: "NO_TEXT_EXTRACTED".`;

  let extractedText = "";
  let extractionMethod: "direct" | "vision" = "direct";

  try {
    const result = await withQueuedRetry(async () => {
      return await model.generateContent([
        textExtractionPrompt,
        {
          inlineData: {
            mimeType,
            data: params.base64,
          },
        },
      ]);
    });

    extractedText = result.response.text().trim();
    if (extractedText === "NO_TEXT_EXTRACTED" || extractedText.length < 50) {
      extractedText = "";
    }
  } catch (error) {
    console.error(`[extractPdfTextFromBase64] direct extraction failed for ${params.fileName || "unknown.pdf"}:`, error);
  }

  if (!extractedText) {
    extractionMethod = "vision";
    const visionPrompt = `This PDF may be image-based. Extract all readable syllabus text, including papers, marks, duration, subjects, and eligibility requirements.

Return only the extracted text. If nothing useful is readable, return exactly: "NO_TEXT_EXTRACTED".`;

    const result = await withQueuedRetry(async () => {
      return await model.generateContent([
        visionPrompt,
        {
          inlineData: {
            mimeType,
            data: params.base64,
          },
        },
      ]);
    });

    extractedText = result.response.text().trim();
  }

  if (!extractedText || extractedText === "NO_TEXT_EXTRACTED" || extractedText.length < 50) {
    throw new Error(`Could not extract readable text from ${params.fileName || "PDF document"}`);
  }

  return {
    text: extractedText,
    extractionMethod,
  };
}

/**
 * Batch evaluate multiple MCQ answers in a single API call
 * This dramatically reduces API calls (e.g., 50 questions → 5 batches instead of 50 calls)
 * Includes explanations for why each incorrect option is wrong
 */
export async function evaluateMCQBatch(
  questions: Array<{
    id: number;
    content: string;
    options: QuestionOption[];
    userAnswer: string;
    correctAnswer: string;
  }>
): Promise<Map<number, MCQFeedback>> {
  const model = await getWorkingModel();
  const results = new Map<number, MCQFeedback>();

  if (questions.length === 0) {
    return results;
  }

  // Build batch prompt with option IDs for incorrect options explanation
  const questionsText = questions.map((q, index) => {
    const optionsText = q.options
      .map((opt) => `${opt.id.toUpperCase()}. ${opt.text}`)
      .join("\n  ");
    const isCorrect = q.userAnswer === q.correctAnswer;
    const userOptionText = q.options.find((o) => o.id === q.userAnswer)?.text || q.userAnswer;
    const correctOptionText = q.options.find((o) => o.id === q.correctAnswer)?.text || q.correctAnswer;
    const incorrectOptionIds = q.options
      .filter((opt) => opt.id !== q.correctAnswer)
      .map((opt) => opt.id)
      .join(", ");

    return `
QUESTION ${index + 1} (ID: ${q.id}):
${q.content}

Options:
  ${optionsText}

Correct Answer: ${q.correctAnswer.toUpperCase()}. ${correctOptionText}
User Answer: ${q.userAnswer ? `${q.userAnswer.toUpperCase()}. ${userOptionText}` : "No answer"}
Is Correct: ${isCorrect}
Incorrect Option IDs: ${incorrectOptionIds}`;
  }).join("\n\n---\n");

  const prompt = `You are an expert UPSC/SPSC exam coach with deep knowledge of Indian polity, current affairs, Sikkim state affairs, history, geography, and general studies. Your role is to provide COMPREHENSIVE, EDUCATIONAL explanations that help students truly understand the concepts, not just memorize answers.

${questionsText}

For EACH question, provide a DETAILED analysis covering:

1. **EXPLANATION** (4-6 sentences):
   - Start with the KEY FACT that makes this answer correct
   - Include specific dates, names, places, statistics where relevant
   - Provide CONTEXT: Why is this significant? What's the background?
   - Connect to broader themes (governance, policy, current affairs)
   - For Sikkim questions: Include state-specific context, policies, or initiatives

2. **WHY OTHER OPTIONS ARE WRONG** (2-3 sentences each):
   - Don't just say "this is wrong" - explain the MISCONCEPTION
   - Provide the CORRECT information for each wrong option
   - Help students understand WHY someone might mistakenly choose this

3. **WHY USER'S CHOICE WAS WRONG** (if applicable, 2-3 sentences):
   - Identify the likely confusion or knowledge gap
   - Provide a clear correction with facts
   - Give a tip to avoid this mistake in future

Return ONLY valid JSON array (no markdown, no code blocks):
[
  {
    "questionId": <question ID from above>,
    "isCorrect": <true/false>,
    "explanation": "Comprehensive explanation with facts, dates, context, and significance. Start with the key fact, then provide background and broader context. For current affairs, mention when it happened and why it matters...",
    "incorrectOptionsExplanation": {
      "a": "Explain the misconception. Provide correct information about what option A actually refers to...",
      "b": "Explain why B is wrong. What is the actual fact related to B...",
      "c": "Clarify the confusion. What does option C actually represent..."
    },
    "userChoiceExplanation": "Identify why the user might have chosen this. Clarify the confusion with specific facts. Tip to remember the correct answer..." // only if user was wrong
  },
  ...
]

QUALITY REQUIREMENTS:
- Explanations must be SUBSTANTIVE (minimum 4 sentences for main explanation)
- Include SPECIFIC FACTS: dates, names, numbers, places
- Provide CONTEXT: Why does this matter? What's the background?
- Be EDUCATIONAL: Help students understand, not just memorize
- For current affairs: Include WHEN it happened and WHY it's significant
- For Sikkim questions: Include relevant state policies, geography, or history
- NEVER give generic responses like "this is the correct answer" - always explain WHY`;

  try {
    const result = await withQueuedRetry(async () => {
      return await model.generateContent(prompt);
    });
    const response = result.response;
    const text = response.text();

    // Clean the response
    const cleanedText = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(cleanedText) as Array<{
      questionId: number;
      isCorrect: boolean;
      explanation: string;
      incorrectOptionsExplanation?: Record<string, string>;
      userChoiceExplanation?: string;
    }>;

    // Map results by question ID
    for (const item of parsed) {
      results.set(item.questionId, {
        isCorrect: item.isCorrect,
        explanation: item.explanation,
        incorrectOptionsExplanation: item.incorrectOptionsExplanation,
        userChoiceExplanation: item.userChoiceExplanation,
      });
    }

    return results;
  } catch (error) {
    console.error("Error in batch MCQ evaluation:", error);
    // Return empty map - caller should handle fallback
    return results;
  }
}

/**
 * Evaluate an MCQ answer and provide educational explanation
 */
export async function evaluateMCQ(
  questionContent: string,
  options: QuestionOption[],
  userAnswer: string,
  correctAnswer: string
): Promise<MCQFeedback> {
  // Auto-detect working model on first call
  const model = await getWorkingModel();

  const optionsText = options
    .map((opt) => `${opt.id.toUpperCase()}. ${opt.text}`)
    .join("\n");

  const userOptionText = options.find((o) => o.id === userAnswer)?.text || userAnswer;
  const correctOptionText = options.find((o) => o.id === correctAnswer)?.text || correctAnswer;

  const isUserCorrect = userAnswer === correctAnswer;

  const prompt = `You are an expert UPSC/competitive exam teacher. Provide a comprehensive educational explanation for this MCQ.

**Question:** ${questionContent}

**Options:**
${optionsText}

**Correct Answer:** ${correctAnswer.toUpperCase()}. ${correctOptionText}
${!isUserCorrect && userAnswer ? `**User's Wrong Answer:** ${userAnswer.toUpperCase()}. ${userOptionText}` : ""}

Your task:
1. Explain WHY "${correctOptionText}" is the correct answer (2-3 sentences with facts, concepts, or reasoning)
2. For EACH of the incorrect options, explain why it is wrong (1-2 sentences per option explaining the misconception, factual error, or logical flaw)

Be specific and educational. Don't just say "this is correct" or "this is wrong" - explain the underlying concepts, facts, and reasoning.

Return ONLY valid JSON (no markdown, no code blocks):
{
  "isCorrect": ${isUserCorrect},
  "explanation": "Detailed explanation of why the correct answer is right...",
  "incorrectOptionsExplanation": {
    ${options.filter(opt => opt.id !== correctAnswer).map(opt => `"${opt.id}": "Explanation of why option ${opt.id.toUpperCase()}. ${opt.text} is incorrect..."`).join(",\n    ")}
  }${!isUserCorrect && userAnswer ? `,
  "userChoiceExplanation": "Specific explanation focused on why the user chose ${userAnswer.toUpperCase()} and how to avoid this mistake..."` : ""}
}`;

  try {
    // Use queued retry logic for API calls (prevents rate limits)
    const result = await withQueuedRetry(async () => {
      return await model.generateContent(prompt);
    });
    const response = result.response;
    const text = response.text();

    // Clean the response - remove any markdown code blocks
    const cleanedText = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(cleanedText);

    return {
      isCorrect: parsed.isCorrect,
      explanation: parsed.explanation,
      incorrectOptionsExplanation: parsed.incorrectOptionsExplanation || undefined,
      userChoiceExplanation: parsed.userChoiceExplanation || undefined,
    };
  } catch (error) {
    console.error("Error evaluating MCQ:", error);
    // Fallback to basic evaluation with more informative text
    const isCorrect = userAnswer === correctAnswer;
    return {
      isCorrect,
      explanation: isCorrect
        ? `Correct! "${correctOptionText}" is the right answer for this question.`
        : `The correct answer is ${correctAnswer.toUpperCase()}. "${correctOptionText}". This is a commonly asked concept in competitive exams.`,
      userChoiceExplanation: isCorrect
        ? undefined
        : userAnswer
        ? `You selected "${userOptionText}" which is not the correct option. Review this topic to better understand the concept.`
        : "No answer was selected for this question.",
    };
  }
}

/**
 * Generate an explanation for a question (called after question creation)
 */
export async function generateExplanation(
  questionContent: string,
  questionType: "mcq" | "conventional",
  options?: { id: string; text: string }[],
  correctAnswer?: string
): Promise<string> {
  // Auto-detect working model
  const model = await getWorkingModel();

  let prompt: string;

  if (questionType === "mcq" && options && correctAnswer) {
    const optionsText = options
      .map((opt) => `${opt.id.toUpperCase()}. ${opt.text}`)
      .join("\n");
    const correctOptionText = options.find((o) => o.id === correctAnswer)?.text || correctAnswer;

    prompt = `You are an expert UPSC/competitive exam teacher. Generate a clear and educational explanation for this MCQ.

**Question:** ${questionContent}

**Options:**
${optionsText}

**Correct Answer:** ${correctAnswer.toUpperCase()}. ${correctOptionText}

Write a concise explanation (2-4 sentences) that:
1. Explains why the correct answer is right with relevant facts
2. Briefly mentions why the other options are incorrect
3. Includes any important related information students should know

Return ONLY the explanation text, no formatting or labels.`;
  } else {
    prompt = `You are an expert UPSC/competitive exam teacher. Generate a comprehensive model answer explanation for this conventional/essay question.

**Question:** ${questionContent}

Write a model answer outline (3-5 key points) that:
1. Identifies the main themes/aspects the answer should cover
2. Lists important facts, examples, or cases to include
3. Suggests a good structure for the answer
4. Notes any common mistakes students should avoid

Return ONLY the explanation text as a formatted outline, no extra labels.`;
  }

  try {
    // Use queued retry logic for API calls (prevents rate limits)
    const result = await withQueuedRetry(async () => {
      return await model.generateContent(prompt);
    });
    const response = result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Error generating explanation:", error);
    return questionType === "mcq"
      ? `The correct answer is ${correctAnswer?.toUpperCase() || "as marked"}.`
      : "Please refer to your study materials for a comprehensive answer to this question.";
  }
}

/**
 * Evaluate a conventional (essay) answer from an uploaded image
 * AI analyzes the question to determine what a good answer should contain
 */
export async function evaluateConventional(
  imageBase64: string,
  mimeType: string,
  questionContent: string,
  wordLimit: number | null,
  maxMarks: number
): Promise<ConventionalFeedback> {
  // Auto-detect working model (gemini-1.5-flash supports vision)
  const model = await getWorkingModel();

  console.log("Evaluating conventional answer. Image size:", imageBase64.length, "chars. MimeType:", mimeType);
  console.log("Question:", questionContent.substring(0, 100) + "...");
  console.log("Using model:", workingQualityModel || QUALITY_MODEL);

  // Validate inputs
  if (!imageBase64 || imageBase64.length < 100) {
    console.error("Invalid image data provided");
    throw new Error("Invalid image data");
  }

  // Calculate sub-scores based on max marks
  const contentMax = Math.round(maxMarks * 0.4);
  const structureMax = Math.round(maxMarks * 0.3);
  const presentationMax = Math.round(maxMarks * 0.2);
  const languageMax = Math.round(maxMarks * 0.1);

  const prompt = `You are an expert UPSC Mains examiner with years of experience evaluating civil service examination answers. Your task is to evaluate a handwritten answer submitted by a candidate.

**IMPORTANT**: You MUST carefully read and transcribe the handwritten text from the image. Even if the handwriting is imperfect, make your best effort to read it. Do NOT say you cannot read it unless it is truly illegible.

**Question:** ${questionContent}
**Maximum Marks:** ${maxMarks}
${wordLimit ? `**Word Limit:** ${wordLimit} words` : ""}

**Your Evaluation Process:**

1. **TRANSCRIBE THE ANSWER**: Carefully read the handwritten text in the image and transcribe it fully. This is mandatory - you must extract the text content.

2. **ANALYZE THE QUESTION**: Identify what aspects a good UPSC answer should cover:
   - Key themes/concepts to address
   - Important facts, data, or examples expected
   - Required structure (introduction, body, conclusion)
   - Any specific demands (discuss, analyze, compare, etc.)

3. **EVALUATE THE ANSWER** using UPSC Mains criteria:

   **Content (${contentMax} marks)**:
   - Does it cover all aspects of the question?
   - Are facts, examples, and data accurate?
   - Is there analytical depth or just superficial coverage?
   - Are relevant case studies, schemes, or current affairs mentioned?

   **Structure (${structureMax} marks)**:
   - Clear introduction that addresses the question directly?
   - Well-organized body with logical flow?
   - Proper conclusion with synthesis or way forward?
   - Use of headings, subheadings, or bullet points?

   **Presentation (${presentationMax} marks)**:
   - Neat and legible handwriting?
   - Diagrams, flowcharts, or maps if applicable?
   - Proper paragraphing and spacing?
   - Overall visual appeal of the answer?

   **Language (${languageMax} marks)**:
   - Grammar and sentence construction?
   - Appropriate vocabulary for civil services?
   - Clear expression of ideas?
   - Spelling and punctuation?

4. **PROVIDE DETAILED FEEDBACK** with:
   - Specific strengths (what the candidate did well)
   - Specific areas for improvement (with actionable suggestions)
   - Section-by-section feedback if the answer has multiple parts
   - A model conclusion showing how to end the answer effectively

Return ONLY valid JSON (no markdown code blocks, just raw JSON):
{
  "extractedText": "Full transcription of the handwritten answer...",
  "score": <total score out of ${maxMarks}>,
  "maxScore": ${maxMarks},
  "wordCountEstimate": <estimated word count>,
  "wordLimitStatus": "within" | "over" | "under",
  "contentScore": <score out of ${contentMax}>,
  "structureScore": <score out of ${structureMax}>,
  "presentationScore": <score out of ${presentationMax}>,
  "languageScore": <score out of ${languageMax}>,
  "feedback": "Comprehensive overall assessment (3-4 sentences covering the main evaluation)...",
  "strengths": [
    "Specific strength 1 with explanation...",
    "Specific strength 2 with explanation...",
    "..."
  ],
  "improvements": [
    "Specific improvement area 1 with suggestion on how to improve...",
    "Specific improvement area 2 with suggestion on how to improve...",
    "..."
  ],
  "sectionFeedback": [
    {
      "section": "Introduction",
      "positive": "What was good about this section...",
      "improve": "What could be improved..."
    },
    {
      "section": "Main Body / Content",
      "positive": "What was good...",
      "improve": "What could be improved..."
    },
    {
      "section": "Conclusion",
      "positive": "What was good...",
      "improve": "What could be improved..."
    }
  ],
  "modelConclusion": "A well-crafted model conclusion for this answer that the student can learn from..."
}`;

  try {
    // Use queued retry logic for API calls (prevents rate limits)
    const result = await withQueuedRetry(async () => {
      return await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
      ]);
    });

    const response = result.response;
    const text = response.text();

    // Clean the response - remove any markdown code blocks
    let cleanedText = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // Sanitize JSON to fix common issues from AI responses (unescaped control characters)
    let parsed;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (parseError) {
      // If parsing fails, try sanitizing control characters
      console.warn("Initial JSON parse failed, attempting to sanitize control characters...");

      // Remove or escape problematic control characters
      cleanedText = cleanedText
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove most control chars
        .replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, '\\\\'); // Fix unescaped backslashes

      try {
        parsed = JSON.parse(cleanedText);
      } catch (secondError) {
        // Try to extract JSON object from the response as last resort
        console.warn("Sanitization failed, attempting JSON extraction...");
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0].replace(/[\x00-\x1F\x7F]/g, ''));
        } else {
          throw parseError; // Throw original error
        }
      }
    }

    // Calculate word limit status if not provided
    let wordLimitStatus: "within" | "over" | "under" = "within";
    if (wordLimit && parsed.wordCountEstimate) {
      if (parsed.wordCountEstimate > wordLimit * 1.1) {
        wordLimitStatus = "over";
      } else if (parsed.wordCountEstimate < wordLimit * 0.7) {
        wordLimitStatus = "under";
      }
    }

    // Ensure score doesn't exceed max marks
    const totalScore = Math.min(
      Math.max(0, parsed.score || 0),
      maxMarks
    );

    return {
      extractedText: parsed.extractedText || "",
      score: totalScore,
      maxScore: maxMarks,
      wordCountEstimate: parsed.wordCountEstimate || 0,
      wordLimitStatus: parsed.wordLimitStatus || wordLimitStatus,
      contentScore: Math.min(parsed.contentScore || 0, Math.round(maxMarks * 0.4)),
      structureScore: Math.min(parsed.structureScore || 0, Math.round(maxMarks * 0.3)),
      presentationScore: Math.min(parsed.presentationScore || 0, Math.round(maxMarks * 0.2)),
      languageScore: Math.min(parsed.languageScore || 0, Math.round(maxMarks * 0.1)),
      feedback: parsed.feedback || "Unable to evaluate the answer.",
      strengths: parsed.strengths || [],
      improvements: parsed.improvements || [],
      sectionFeedback: parsed.sectionFeedback || [],
      modelConclusion: parsed.modelConclusion || "",
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Error evaluating conventional answer:");
    console.error("Error name:", err?.name);
    console.error("Error message:", err?.message);
    console.error("Full error:", error);

    // Check if it's a Gemini API error
    const errorMessage = err?.message || "Unknown error";
    const isApiKeyError = errorMessage.includes("API key") || errorMessage.includes("API_KEY") || errorMessage.includes("INVALID_API_KEY");
    const isQuotaError = errorMessage.includes("quota") || errorMessage.includes("rate limit") || errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED");
    const isModelNotFound = errorMessage.includes("not found") || errorMessage.includes("404");
    const isSafetyBlock = errorMessage.includes("SAFETY") || errorMessage.includes("blocked");

    let feedback = `Unable to evaluate the answer: ${errorMessage.substring(0, 100)}`;

    if (isApiKeyError) {
      feedback = "AI evaluation is temporarily unavailable. Please check API key configuration.";
    } else if (isQuotaError) {
      feedback = "AI evaluation quota exceeded. Please try again in a few minutes.";
    } else if (isModelNotFound) {
      feedback = "AI model not available. Please contact support.";
    } else if (isSafetyBlock) {
      feedback = "The image could not be processed. Please ensure the image contains only your handwritten answer.";
    }

    return {
      extractedText: "",
      score: 0,
      maxScore: maxMarks,
      wordCountEstimate: 0,
      wordLimitStatus: "within",
      contentScore: 0,
      structureScore: 0,
      presentationScore: 0,
      languageScore: 0,
      feedback,
      strengths: [],
      improvements: ["Please ensure your handwriting is legible", "Make sure the image is well-lit and clear"],
      sectionFeedback: [],
      modelConclusion: "",
    };
  }
}

/**
 * Convert a file URL to base64 for Gemini processing
 */
export async function fileUrlToBase64(fileUrl: string): Promise<{ base64: string; mimeType: string }> {
  console.log("Fetching image from URL:", fileUrl);

  const response = await fetch(fileUrl);

  if (!response.ok) {
    console.error("Failed to fetch image:", response.status, response.statusText);
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  // Determine mime type from URL or content-type header
  const contentType = response.headers.get("content-type") || "image/jpeg";

  console.log("Image fetched successfully. Size:", arrayBuffer.byteLength, "bytes. Type:", contentType);

  // Validate that we have actual image data
  if (arrayBuffer.byteLength < 100) {
    console.error("Image data seems too small:", arrayBuffer.byteLength, "bytes");
    throw new Error("Image data is too small or empty");
  }

  return {
    base64,
    mimeType: contentType,
  };
}

// =============================================================================
// MCQ PREGENERATION - Generate explanations at question creation time
// =============================================================================

/**
 * Generate MCQ explanation for pregeneration (no user answer needed)
 * Used at question creation time, not during test evaluation.
 * This provides instant feedback during test results since explanations are pre-computed.
 */
export async function generateMCQExplanation(question: {
  content: string;
  options: QuestionOption[];
  correctAnswer: string;
}): Promise<MCQPregenExplanation> {
  const model = await getQualityModel();

  const optionsText = question.options
    .map((opt) => `${opt.id.toUpperCase()}. ${opt.text}`)
    .join("\n  ");

  const correctOptionText = question.options
    .find((o) => o.id === question.correctAnswer)?.text || question.correctAnswer;

  const incorrectOptions = question.options
    .filter((opt) => opt.id !== question.correctAnswer);

  const incorrectOptionIds = incorrectOptions.map((opt) => opt.id);

  const prompt = `You are an expert UPSC/SPSC exam coach with deep knowledge of Indian polity, current affairs, Sikkim state affairs, history, geography, and general studies. Your role is to generate a COMPREHENSIVE, EDUCATIONAL explanation for this MCQ that will help students truly understand the concepts.

QUESTION:
${question.content}

OPTIONS:
  ${optionsText}

CORRECT ANSWER: ${question.correctAnswer.toUpperCase()}. ${correctOptionText}

Generate a detailed analysis:

1. **EXPLANATION** (4-6 sentences):
   - Start with the KEY FACT that makes this answer correct
   - Include specific dates, names, places, statistics where relevant
   - Provide CONTEXT: Why is this significant? What's the background?
   - Connect to broader themes (governance, policy, current affairs)
   - For Sikkim questions: Include state-specific context, policies, or initiatives

2. **WHY EACH INCORRECT OPTION IS WRONG** (2-3 sentences each):
   - Don't just say "this is wrong" - explain the MISCONCEPTION
   - Provide the CORRECT information for each wrong option
   - Help students understand WHY someone might mistakenly choose this

Return ONLY valid JSON (no markdown code blocks, no extra text):
{
  "explanation": "Comprehensive explanation with facts, dates, context, and significance. Start with the key fact, then provide background and broader context...",
  "incorrectOptionsExplanation": {
    ${incorrectOptionIds.map((id) => `"${id}": "Explain the misconception. Provide correct information about what option ${id.toUpperCase()} actually refers to..."`).join(",\n    ")}
  }
}

QUALITY REQUIREMENTS:
- Explanation must be SUBSTANTIVE (minimum 4 sentences)
- Include SPECIFIC FACTS: dates, names, numbers, places
- Provide CONTEXT: Why does this matter? What's the background?
- Be EDUCATIONAL: Help students understand, not just memorize
- For current affairs: Include WHEN it happened and WHY it's significant
- For Sikkim questions: Include relevant state policies, geography, or history
- NEVER give generic responses like "this is the correct answer" - always explain WHY`;

  try {
    const result = await withQueuedRetry(async () => {
      return await model.generateContent(prompt);
    });

    const text = result.response.text();

    // Clean the response - remove any markdown code blocks
    const cleanedText = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(cleanedText);

    return {
      explanation: parsed.explanation,
      incorrectOptionsExplanation: parsed.incorrectOptionsExplanation || {},
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error generating MCQ explanation:", error);
    throw error; // Re-throw to let caller handle fallback
  }
}

/**
 * Batch generate MCQ explanations for multiple questions
 * More efficient for migration of existing questions
 */
export async function generateMCQExplanationBatch(
  questions: Array<{
    id: number;
    content: string;
    options: QuestionOption[];
    correctAnswer: string;
  }>
): Promise<Map<number, MCQPregenExplanation>> {
  const results = new Map<number, MCQPregenExplanation>();

  if (questions.length === 0) {
    return results;
  }

  // Process sequentially to avoid rate limits during migration
  for (const question of questions) {
    try {
      const explanation = await generateMCQExplanation({
        content: question.content,
        options: question.options,
        correctAnswer: question.correctAnswer,
      });
      results.set(question.id, explanation);

      // Small delay between questions to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to generate explanation for question ${question.id}:`, error);
      // Continue with other questions
    }
  }

  return results;
}
