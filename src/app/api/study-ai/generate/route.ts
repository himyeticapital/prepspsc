import { AI_MODELS, BASIC_MODEL_CHAIN } from "@/lib/ai-models";
import { BETTER_ANSWER_PRICE_PAISE, chargeBetterAnswer, refundBetterAnswer } from "@/lib/ai-credits";
import { createServiceClient } from "@/lib/supabase/service";
import { enforceDailyCap } from "@/lib/daily-cap";
import { hasProAccess } from "@/lib/access";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { StudyAIGenerationType } from "@/types/database.types";
import { applyRateLimit } from "@/lib/rate-limit";
import { validateBody, studyAIGenerateSchema } from "@/lib/validations";

// CRITICAL: Force dynamic to prevent any caching of this route
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// =============================================================================
// TIERED MODEL SYSTEM - Pro users get better AI quality
// =============================================================================

// Every student gets the cheap basic model by default (see src/lib/ai-models.ts).
const MODEL_TIERS = {
  pro: [...BASIC_MODEL_CHAIN],
  free: [...BASIC_MODEL_CHAIN],
};

// Cache working models per tier to avoid repeated tests
const workingModels: { pro: string | null; free: string | null } = {
  pro: null,
  free: null,
};

// Generation config - slightly different for Pro (more tokens, better quality)
// Temperature increased to 0.8 to ensure variety in repeated generations
// Higher temperature = more randomness = different outputs each time
const GENERATION_CONFIG = {
  free: {
    temperature: 0.8,      // High temp for variety in outputs
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 6144, // Shorter for free users
  },
  pro: {
    temperature: 0.8,      // Same temp - allows variety while maintaining quality
    topK: 50,              // Consider more tokens for better vocabulary
    topP: 0.95,
    maxOutputTokens: 8192, // Longer, more comprehensive for Pro
  },
};

// Initialize Gemini lazily to validate API key at runtime
function getGeminiClient() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_NOT_CONFIGURED");
  }
  return new GoogleGenerativeAI(apiKey);
}

// Get the appropriate model based on user's subscription tier
// Both tiers use gemini-3-flash-preview (latest model with best reasoning)
// Pro users get higher token limits and better generation config
async function getWorkingGeminiModel(isPro: boolean = false) {
  const genAI = getGeminiClient();
  const tier = isPro ? "pro" : "free";
  const modelsToTry = MODEL_TIERS[tier];
  const config = GENERATION_CONFIG[tier];

  // If we already found a working model for this tier, use it
  if (workingModels[tier]) {
    console.log(`[AI Model] Using cached ${tier} model: ${workingModels[tier]}`);
    return genAI.getGenerativeModel({
      model: workingModels[tier]!,
      generationConfig: config,
    });
  }

  // Try each model in order for this tier
  for (const modelName of modelsToTry) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: config,
    });
    try {
      // Quick test to verify model works
      await model.generateContent("test");
      workingModels[tier] = modelName;
      console.log(`[AI Model] ${tier.toUpperCase()} tier using: ${modelName}`);
      return model;
    } catch (error) {
      const err = error as Error;
      const errMsg = err?.message || "";
      // Only try next model if this one doesn't exist
      if (errMsg.includes("404") || errMsg.includes("not found") || errMsg.includes("not supported")) {
        console.log(`[AI Model] ${modelName} not available, trying next...`);
        continue;
      }
      // For other errors (rate limit, etc), assume model works but had temp issue
      workingModels[tier] = modelName;
      console.log(`[AI Model] ${tier.toUpperCase()} tier using: ${modelName}`);
      return model;
    }
  }

  // Fallback to first model if none worked in test
  console.warn(`[AI Model] No model verified for ${tier}, defaulting to`, modelsToTry[0]);
  return genAI.getGenerativeModel({
    model: modelsToTry[0],
    generationConfig: config,
  });
}

// =============================================================================
// CONTENT PRE-PROCESSING & QUALITY IMPROVEMENTS
// =============================================================================

// Detect content source type from the content itself
type ContentSource = "youtube" | "pdf" | "image" | "text" | "unknown";

function detectContentSource(content: string): ContentSource {
  const lowerContent = content.toLowerCase().slice(0, 500);

  // YouTube indicators
  if (
    lowerContent.includes("youtube video:") ||
    lowerContent.includes("transcript") ||
    /\b(um|uh|like|you know|so basically)\b/gi.test(content.slice(0, 2000))
  ) {
    return "youtube";
  }

  // PDF indicators
  if (
    lowerContent.includes("pdf document:") ||
    /page \d+|chapter \d+|section \d+\.\d+/i.test(lowerContent)
  ) {
    return "pdf";
  }

  // Image/OCR indicators
  if (
    lowerContent.includes("image:") ||
    lowerContent.includes("handwritten") ||
    lowerContent.includes("screenshot")
  ) {
    return "image";
  }

  return "text";
}

// Clean and pre-process content based on source
function preprocessContent(content: string, source: ContentSource): string {
  let processed = content;

  if (source === "youtube") {
    // Clean up YouTube transcript issues
    processed = processed
      // Remove common filler words (but preserve meaning)
      .replace(/\b(um|uh|er|ah)\b/gi, "")
      // Normalize multiple spaces
      .replace(/\s+/g, " ")
      // Add sentence breaks where missing (common in auto-captions)
      .replace(/([a-z])([A-Z])/g, "$1. $2")
      // Fix common auto-caption errors
      .replace(/\bi\b/g, "I")
      // Remove [Music] [Applause] type markers
      .replace(/\[[\w\s]+\]/g, "")
      .trim();
  }

  if (source === "image") {
    // Clean OCR artifacts
    processed = processed
      // Fix common OCR errors
      .replace(/[|l](?=[a-z])/g, "I") // | or l at start of word -> I
      .replace(/0(?=[a-z])/g, "O")    // 0 before letters -> O
      // Normalize whitespace
      .replace(/\s+/g, " ")
      .trim();
  }

  return processed;
}

// Detect if content has multiple sources
function hasMultipleSources(content: string): boolean {
  const sourceMarkers = content.match(/=== SOURCE: \w+ - .+? ===/g);
  return (sourceMarkers?.length || 0) > 1;
}

// Extract source types from labeled content
function extractSourceTypes(content: string): string[] {
  const matches = content.match(/=== SOURCE: (\w+) - .+? ===/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.match(/SOURCE: (\w+)/)?.[1] || "").filter(Boolean))];
}

// Generate source-aware context for the prompt
function getSourceContext(content: string): string {
  const isMultiSource = hasMultipleSources(content);
  const sourceTypes = extractSourceTypes(content);

  // Multi-source handling
  if (isMultiSource) {
    const sourceList = sourceTypes.map(s => s.toUpperCase()).join(", ");
    return `
MULTI-SOURCE CONTENT HANDLING:
This content is compiled from MULTIPLE SOURCES: ${sourceList}

CRITICAL INSTRUCTIONS FOR MULTI-SOURCE CONTENT:
1. CONSOLIDATION: When the same topic appears in multiple sources, MERGE the information:
   - Combine complementary details from different sources
   - Remove redundant/duplicate information
   - Create unified points that incorporate all relevant details

2. EQUAL TREATMENT: All sources are equally important:
   - PDF, YouTube, and Image content all have equal weight
   - Don't prioritize one source type over another
   - Extract the best information from each source

3. DEDUPLICATION: If the same fact appears in multiple sources:
   - Include it only ONCE in your output
   - Use the most complete/accurate version
   - Don't attribute or cite individual sources

4. SOURCE MARKERS: The content has "=== SOURCE: TYPE - filename ===" markers
   - Use these to understand where information came from
   - But DON'T include these markers in your output
   - Focus on creating unified, coherent study material

5. CONFLICT RESOLUTION: If sources contain conflicting information:
   - Use the most specific/detailed version
   - Prefer recent information over older
   - If unclear, include both perspectives

QUALITY NOTES:
- YouTube transcripts may have informal language - extract core educational content
- PDF content may have structured formatting - preserve key hierarchy
- Image/OCR content may have errors - use context to correct`;
  }

  // Single source handling
  const source = detectContentSource(content);

  switch (source) {
    case "youtube":
      return `
SOURCE TYPE: YouTube Video Transcript
IMPORTANT NOTES:
- This content is from a video transcript which may have informal language
- Some sentences might run together (auto-caption limitations)
- Focus on extracting the core educational content
- Ignore any informal speech patterns or filler words
- The speaker may repeat concepts for emphasis - consolidate these`;

    case "pdf":
      return `
SOURCE TYPE: PDF Document
IMPORTANT NOTES:
- This content is from a structured document
- Preserve the document's organizational structure
- Pay attention to headings, sections, and hierarchy
- Tables and lists may be formatted as plain text`;

    case "image":
      return `
SOURCE TYPE: Image/Handwritten Notes (OCR)
IMPORTANT NOTES:
- This content was extracted via OCR from an image
- There may be some recognition errors - use context to correct
- Handwritten notes may have abbreviations - expand them
- Diagrams may be described in text - incorporate that info`;

    default:
      return `
SOURCE TYPE: Text Content
Process this educational content comprehensively.`;
  }
}

// Calculate quality score of extracted content
function assessContentQuality(content: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  // Check content length
  if (content.length < 200) {
    score -= 30;
    issues.push("Content is very short");
  } else if (content.length < 500) {
    score -= 15;
    issues.push("Content is relatively short");
  }

  // Check for meaningful content (not just filler)
  const meaningfulWords = content.match(/\b[a-zA-Z]{4,}\b/g) || [];
  if (meaningfulWords.length < 50) {
    score -= 20;
    issues.push("Limited meaningful content detected");
  }

  // Check for structure (sentences, paragraphs)
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length < 5) {
    score -= 15;
    issues.push("Content lacks sentence structure");
  }

  // Check for educational keywords
  const eduKeywords = /\b(definition|concept|important|because|therefore|example|such as|including|refers to)\b/gi;
  const eduMatches = content.match(eduKeywords) || [];
  if (eduMatches.length < 3) {
    score -= 10;
    issues.push("Limited educational structure");
  }

  return { score: Math.max(0, score), issues };
}

// Content length limits based on gemini-3-flash-preview capabilities
// The model supports 1M tokens (~750K words) but we limit for cost/quality balance
const CONTENT_LIMITS = {
  standard: 15000,    // ~3750 words - good for most content
  extended: 50000,    // ~12500 words - for longer videos/documents
  maximum: 100000,    // ~25000 words - for very long content (10+ hour videos)
};

// Variation seeds to encourage different outputs on repeated generations
const VARIATION_FOCUSES = [
  "Focus on PRACTICAL APPLICATIONS and real-world examples",
  "Focus on HISTORICAL CONTEXT and evolution of concepts",
  "Focus on COMPARISONS and contrasts between related topics",
  "Focus on CAUSE-EFFECT relationships and implications",
  "Focus on EXAM-RELEVANT facts that are frequently tested",
  "Focus on INTERCONNECTIONS between different concepts",
  "Focus on EXCEPTIONS and special cases",
  "Focus on NUMERICAL DATA and statistics",
  "Focus on KEY PERSONALITIES and their contributions",
  "Focus on RECENT DEVELOPMENTS and current relevance",
];

// Get a random variation focus for unique outputs
// Returns focus text and unique ID for logging
function getVariationFocus(): { focus: string; focusIndex: number; uniqueId: string } {
  const focusIndex = Math.floor(Math.random() * VARIATION_FOCUSES.length);
  const randomFocus = VARIATION_FOCUSES[focusIndex];
  // Use crypto for truly random unique ID
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  return { focus: randomFocus, focusIndex, uniqueId };
}

// Generation prompts for each type
// Enhanced prompts optimized for gemini-3-flash-preview to produce higher quality output
// Third parameter is variation focus to ensure unique outputs
const GENERATION_PROMPTS: Record<StudyAIGenerationType, (content: string, sourceContext?: string, variationFocus?: string) => string> = {
  mindmap: (content, sourceContext = "", variationFocus = "") => {
    const perspectiveMap: Record<string, string> = {
      "Focus on PRACTICAL APPLICATIONS and real-world examples": "Applied:",
      "Focus on HISTORICAL CONTEXT and evolution of concepts": "Timeline:",
      "Focus on COMPARISONS and contrasts between related topics": "Compare:",
      "Focus on CAUSE-EFFECT relationships and implications": "Cause-Effect:",
      "Focus on EXAM-RELEVANT facts that are frequently tested": "Exam Focus:",
      "Focus on INTERCONNECTIONS between different concepts": "Connections:",
      "Focus on EXCEPTIONS and special cases": "Exceptions:",
      "Focus on NUMERICAL DATA and statistics": "Data:",
      "Focus on KEY PERSONALITIES and their contributions": "Key People:",
      "Focus on RECENT DEVELOPMENTS and current relevance": "Current:",
    };
    const titlePrefix = variationFocus ? (perspectiveMap[variationFocus] || "Mind Map:") : "Mind Map:";

    return `You are an expert UPSC educator and knowledge architect specializing in creating comprehensive, exam-focused study materials with MEMORY TECHNIQUES.
${sourceContext}
${variationFocus ? `
=== MANDATORY UNIQUE PERSPECTIVE FOR THIS MIND MAP ===
${variationFocus}

CRITICAL REQUIREMENTS:
1. TITLE: Must start with "${titlePrefix}" followed by topic
2. PRIMARY BRANCHES: Organize around this perspective
3. SECONDARY BRANCHES: Prioritize details relevant to this angle
4. MNEMONICS: Create memory hooks that emphasize this focus
5. CONNECTIONS: Highlight relationships that support this viewpoint

Every branch and node must reflect this unique focus.
===============================================
` : ""}
TASK: Create a detailed mind map extracting SPECIFIC information from the content below - actual names, dates, events, and facts. Include MNEMONICS and MEMORY HOOKS to help students remember key information.

SPECIAL HANDLING FOR VIDEO METADATA (when transcript unavailable):
If the content contains "Full transcript could not be extracted" or starts with video metadata, use your knowledge to create a comprehensive mind map on the topic based on the video title and description.

CRITICAL RULE: Every node in the mind map must contain SPECIFIC information from the content. For current affairs, use actual news headlines, real names, specific numbers - NOT generic categories like "Economic Development" or "International Relations". For video metadata, supplement with your knowledge.

Content to analyze:
---
${content}
---

FOR CURRENT AFFAIRS/NEWS CONTENT:
- Use actual news items as branches, not generic categories
- Include specific names: ministers, officials, countries, organizations
- Include specific numbers: budget figures, statistics, percentages
- Include actual policy/bill/act names

REQUIREMENTS FOR HIGH-QUALITY MIND MAP:
1. DEPTH: Create a deep, multi-level hierarchy (4-5 levels minimum)
2. BREADTH: Cover ALL important aspects - don't skip minor but relevant details
3. CONNECTIONS: Identify relationships between different concepts
4. EXAM FOCUS: Highlight facts that are frequently asked in competitive exams
5. STRUCTURE:
   - Central Topic (1): The main subject
   - Primary Branches (5-7): Major themes/categories
   - Secondary Branches (3-5 per primary): Key concepts under each theme
   - Tertiary Branches (2-4 per secondary): Specific details, facts, examples
   - Leaf Nodes: Dates, statistics, names, definitions where relevant

MEMORY TECHNIQUES (REQUIRED - add these throughout the mind map):
1. MNEMONICS: Create acronyms or phrases to remember lists
   - Example: "PQRST" for remembering 5 components
   - Example: "Never Eat Soggy Waffles" for directions
2. MEMORY HOOKS: Add memorable associations
   - Link dates to easy-to-remember events: "1947 (Independence year) + 3 = 1950 (Constitution)"
   - Use number patterns: "Article 14-18 = Right to Equality (14 to 18 = teen years = equal treatment)"
3. VISUAL CUES: Add emoji markers for quick topic identification

EMOJI MARKERS (add to nodes based on topic type):
📜 History/Historical events | 🏛️ Government/Constitution | 💰 Economy/Finance
🌍 Geography/Environment | 🔬 Science/Technology | 👥 Social Issues
📊 Statistics/Data | 🎯 Key exam fact | 💡 Memory hook | 🔗 Connection to other topic

QUALITY CHECKLIST:
- Include specific names, dates, places, and statistics
- Add examples and case studies where relevant
- Include cause-effect relationships
- Add comparisons where applicable
- Mention constitutional articles, acts, or provisions if relevant
- Include recent developments or current affairs connections
- ADD AT LEAST 3-5 MNEMONICS OR MEMORY HOOKS

OUTPUT FORMAT (STRICT):
1. Return ONLY valid JSON - no explanations before or after
2. Use \\n for newlines in markdown (NOT actual line breaks)
3. Use ONLY plain text - NO bold (**), NO italic (*), NO links, NO ==marks==
4. Each node should be informative (can be longer for important facts)
5. Use proper indentation with spaces (2 spaces per level)
6. Include emoji markers at the start of relevant nodes

{
  "title": "Descriptive topic title",
  "markdown": "# Central Topic\\n- 🏛️ Primary Branch 1\\n  - Secondary 1.1\\n    - Tertiary 1.1.1\\n    - 💡 MEMORY: [mnemonic or hook here]\\n  - Secondary 1.2\\n    - 🎯 Detail with specific fact/date\\n- 📜 Primary Branch 2\\n  - Secondary 2.1\\n..."
}

EXAMPLE STRUCTURE (for reference only):
# Indian Constitution
- 📜 Historical Background
  - Pre-Independence Developments
    - Government of India Act 1935
    - Cabinet Mission Plan 1946
  - Constituent Assembly
    - 🎯 Formation: Dec 9, 1946
    - Members: 389 initially
    - Chairman: Dr. Rajendra Prasad
    - 💡 MEMORY: "389 members, like 3+8+9=20 = 2 years to draft"
- 🏛️ Salient Features
  - Borrowed Features
    - 💡 MEMORY: "FURIES" = Federal, Unitary, Republic, Independent, Equality, Secular
    - From UK: Parliamentary system
    - From USA: Fundamental Rights
  - Original Features
    - Concurrent List
    - Emergency Provisions

Now create the mind map for the given content:`;
  },

  summary: (content, sourceContext = "", variationFocus = "") => {
    // Generate unique perspective keywords based on variation
    const perspectiveMap: Record<string, string> = {
      "Focus on PRACTICAL APPLICATIONS and real-world examples": "Applied Insights:",
      "Focus on HISTORICAL CONTEXT and evolution of concepts": "Historical Perspective:",
      "Focus on COMPARISONS and contrasts between related topics": "Comparative Analysis:",
      "Focus on CAUSE-EFFECT relationships and implications": "Cause & Effect:",
      "Focus on EXAM-RELEVANT facts that are frequently tested": "Exam Essentials:",
      "Focus on INTERCONNECTIONS between different concepts": "Connected Concepts:",
      "Focus on EXCEPTIONS and special cases": "Key Exceptions:",
      "Focus on NUMERICAL DATA and statistics": "Data & Statistics:",
      "Focus on KEY PERSONALITIES and their contributions": "Key Figures:",
      "Focus on RECENT DEVELOPMENTS and current relevance": "Current Relevance:",
    };
    const titlePrefix = variationFocus ? (perspectiveMap[variationFocus] || "Summary:") : "Summary:";

    return `You are an expert UPSC educator creating comprehensive study notes for competitive exam aspirants.
${sourceContext}
${variationFocus ? `
=== MANDATORY UNIQUE PERSPECTIVE FOR THIS GENERATION ===
${variationFocus}

CRITICAL REQUIREMENTS FOR THIS GENERATION:
1. TITLE: Must start with "${titlePrefix}" followed by topic
2. KEY POINTS: Prioritize facts that relate to this perspective
3. KEY DATES: Select dates/events most relevant to this angle
4. KEY CONCEPTS: Choose concepts that fit this perspective
5. EXAM FACTS: Highlight facts from this viewpoint
6. EXAM QUESTIONS: Generate questions focused on this perspective

Every section must reflect this unique focus. Do NOT produce generic content.
===============================================
` : ""}
TASK: Create a detailed, exam-oriented summary extracting ALL specific facts, names, dates, and information from the content below. Include POTENTIAL EXAM QUESTIONS that could be asked.

SPECIAL HANDLING FOR VIDEO METADATA (when transcript unavailable):
If the content contains "Full transcript could not be extracted" or starts with video metadata (title, channel, description), you should:
1. Use the video TITLE and DESCRIPTION to understand the topic
2. Research and generate comprehensive educational content on that topic using your knowledge
3. Include specific facts, dates, formulas, and exam-relevant information about the topic
4. Make the summary as detailed as if you had the full transcript
5. Focus on UPSC/competitive exam relevant aspects of the topic

CRITICAL RULE: Extract SPECIFIC information from the content - actual names of people, places, policies, exact dates, specific events, real statistics. Every point must contain concrete details from the source material, not generic statements. For video metadata, supplement with your knowledge of the topic.

Content to summarize:
---
${content}
---

FOR CURRENT AFFAIRS/NEWS CONTENT:
- Extract each specific news item with its actual details
- Include actual names: ministers, officials, countries, organizations
- Include actual numbers: budget figures, statistics, percentages
- Include actual policy/bill/act names with their provisions
- Include actual dates and what specifically happened

REQUIREMENTS FOR HIGH-QUALITY SUMMARY:
1. SPECIFICITY: Every point must have concrete details (who, what, when, how much)
   - GOOD: "PM Modi announced ₹2 lakh crore National Infrastructure Pipeline on Jan 26"
   - BAD: "Government announced infrastructure development plans"
2. STRUCTURE: Organize by specific topics/news items discussed
3. EXAM FOCUS: Highlight specific facts that could be asked in exams
4. COMPLETENESS: Don't miss any specific fact, name, date, or number mentioned

EMOJI MARKERS (add to key points based on topic):
📜 History/Historical | 🏛️ Government/Polity | 💰 Economy/Finance
🌍 Geography/Environment | 🔬 Science/Technology | 👥 Social Issues
📊 Statistics/Data | 🎯 High-priority exam fact | ⚖️ Law/Legal

OUTPUT STRUCTURE (all sections must reflect your assigned perspective above):
1. Key Points (10-15 points) - Prioritized by your focus perspective:
   - "🏛️ Minister X announced Y policy affecting Z million people"
   - "💰 India signed ABC agreement with Country X worth $Y billion"
   - Select points that best demonstrate your assigned perspective

2. Important Dates/Events - Choose dates most relevant to your perspective:
   - Select dates that connect to your focus area
   - Include: Date + Specific event + Why it matters for your perspective

3. Key Concepts (4-6) - Concepts that relate to your perspective:
   - Prioritize concepts that fit your assigned focus
   - Explain them through the lens of your perspective

4. Exam Facts - Facts highlighted through your perspective:
   - Choose facts that an examiner focusing on your angle would test
   - Different perspectives emphasize different facts

5. POTENTIAL EXAM QUESTIONS - Questions from your perspective:
   - Generate 5-8 questions aligned with your assigned focus
   - An "Applied Insights" perspective asks different questions than "Historical Perspective"
   - Make questions specific to your unique angle

Return ONLY valid JSON (no markdown, no code blocks):
{
  "title": "UNIQUE TITLE - Must reflect BOTH the content AND your assigned focus perspective above",
  "keyPoints": [
    "🏛️ Specific point with actual name + action + detail/number from content",
    "💰 Another specific fact with who/what/when from content"
  ],
  "keyDates": [
    {"date": "Actual date from content", "event": "Specific event with names and details"}
  ],
  "keyConcepts": [
    {
      "concept": "Actual concept name from content",
      "explanation": "Explanation using specific details from the content"
    }
  ],
  "examFacts": [
    "🎯 Specific statistic or fact with actual number from content",
    "Another specific memorable fact"
  ],
  "potentialExamQuestions": [
    {"question": "What is the budget allocated for [specific scheme] announced in [year]?", "answerHint": "₹X crore as mentioned in the content", "type": "factual"},
    {"question": "Who was appointed as [specific position] in [year]?", "answerHint": "[Name] was appointed", "type": "factual"},
    {"question": "Explain the key provisions of [specific act/policy]", "answerHint": "3 main provisions: A, B, C", "type": "descriptive"},
    {"question": "Compare [X] and [Y] mentioned in the content", "answerHint": "Key differences: purpose, scope, implementation", "type": "analytical"}
  ],
  "conclusion": "Summary of specific key takeaways from this content"
}`;
  },

  flashcards: (content, sourceContext = "", variationFocus = "") => {
    const perspectiveMap: Record<string, string> = {
      "Focus on PRACTICAL APPLICATIONS and real-world examples": "Applied Learning:",
      "Focus on HISTORICAL CONTEXT and evolution of concepts": "Historical Facts:",
      "Focus on COMPARISONS and contrasts between related topics": "Compare & Contrast:",
      "Focus on CAUSE-EFFECT relationships and implications": "Cause & Effect:",
      "Focus on EXAM-RELEVANT facts that are frequently tested": "Exam Prep:",
      "Focus on INTERCONNECTIONS between different concepts": "Connected Ideas:",
      "Focus on EXCEPTIONS and special cases": "Special Cases:",
      "Focus on NUMERICAL DATA and statistics": "Numbers & Stats:",
      "Focus on KEY PERSONALITIES and their contributions": "Key Figures:",
      "Focus on RECENT DEVELOPMENTS and current relevance": "Current Affairs:",
    };
    const titlePrefix = variationFocus ? (perspectiveMap[variationFocus] || "Flashcards:") : "Flashcards:";

    return `You are an expert UPSC educator creating flashcards for competitive exam preparation.
${sourceContext}
${variationFocus ? `
=== MANDATORY UNIQUE PERSPECTIVE FOR THESE FLASHCARDS ===
${variationFocus}

CRITICAL REQUIREMENTS:
1. TITLE: Must start with "${titlePrefix}" followed by topic
2. CARD SELECTION: Prioritize facts that relate to this perspective
3. QUESTION FRAMING: Frame questions from this angle
4. DIFFICULTY MIX: Adjust based on what matters for this perspective
5. HINTS: Create memory hooks that emphasize this focus

Every flashcard must reflect this unique perspective.
===============================================
` : ""}
TASK: Create comprehensive flashcards STRICTLY from the provided content below. Extract and convert the actual facts, concepts, and information into flashcards with DIFFICULTY LEVELS and MEMORY HINTS.

SPECIAL HANDLING FOR VIDEO METADATA (when transcript unavailable):
If the content contains "Full transcript could not be extracted" or starts with video metadata, use the video title and description to identify the topic, then create flashcards using your knowledge of that topic. Generate exam-relevant flashcards covering key facts, formulas, dates, and concepts.

CRITICAL RULE: You must create flashcards from facts in the content or, for video metadata, from your knowledge of the topic. Every flashcard must be accurate and exam-relevant.

Content to convert into flashcards:
---
${content}
---

REQUIREMENTS FOR HIGH-QUALITY FLASHCARDS:
1. QUANTITY: Create 15-20 flashcards covering ALL important facts FROM THE CONTENT ABOVE
2. CONTENT-BASED ONLY: Every question and answer must come directly from the provided content
   - If the content discusses "X happened on Y date", create a card about that
   - If the content mentions a person's role, create a card about them
   - Do NOT create generic meta-questions like "Why is history important?" unless the content explicitly discusses that
3. VARIETY: Mix different types based on what's in the content:
   - Definition cards (What is X?) - only for concepts defined in the content
   - Fact cards (When/Where/Who questions) - only for facts mentioned
   - Comparison cards - only if the content compares things
4. SPECIFICITY: Use exact names, dates, numbers, and details FROM THE CONTENT
5. CONTEXT: Answers should be complete but concise (2-4 sentences)

DIFFICULTY LEVELS (REQUIRED for each card):
- "easy": Direct recall of a single fact (name, date, place) - good for beginners
- "medium": Understanding concepts, connecting 2 facts, or explaining why something matters
- "hard": Analysis, comparison of multiple concepts, or application of knowledge

HINTS (REQUIRED for medium and hard cards):
- Provide a memory hook, mnemonic, or clue to help recall
- Use acronyms, associations, or memorable phrases
- Examples: "Think GDP components", "Recall the 3 pillars", "Starts with 'P'"

EMOJI MARKERS (add to front of each card based on topic):
📜 History/Historical events | 🏛️ Government/Constitution | 💰 Economy/Finance
🌍 Geography/Environment | 🔬 Science/Technology | 👥 Social Issues
📊 Statistics/Data | 🎯 Important for exams | ⚖️ Law/Legal

WHAT TO AVOID:
- Generic questions about "the importance of studying current affairs"
- Meta-questions about learning methods or study techniques
- Any information not explicitly stated in the provided content
- Philosophical questions unless the content specifically discusses them

Return ONLY valid JSON (no markdown, no code blocks):
{
  "title": "Descriptive title reflecting the specific content topic",
  "cards": [
    {"id": "1", "front": "📜 When was [specific event]?", "back": "Answer with details", "difficulty": "easy"},
    {"id": "2", "front": "🏛️ What is [concept]?", "back": "Definition from content", "difficulty": "medium", "hint": "Remember: It has 3 key features starting with P, R, S"},
    {"id": "3", "front": "💰 Compare X and Y", "back": "Detailed comparison", "difficulty": "hard", "hint": "Think about the PURPOSE of each - one is for growth, other for stability"}
  ]
}`;
  },

  quiz: (content, sourceContext = "", variationFocus = "") => {
    const perspectiveMap: Record<string, string> = {
      "Focus on PRACTICAL APPLICATIONS and real-world examples": "Applied Knowledge Quiz:",
      "Focus on HISTORICAL CONTEXT and evolution of concepts": "Historical Quiz:",
      "Focus on COMPARISONS and contrasts between related topics": "Comparative Quiz:",
      "Focus on CAUSE-EFFECT relationships and implications": "Cause-Effect Quiz:",
      "Focus on EXAM-RELEVANT facts that are frequently tested": "Exam-Style Quiz:",
      "Focus on INTERCONNECTIONS between different concepts": "Connections Quiz:",
      "Focus on EXCEPTIONS and special cases": "Special Cases Quiz:",
      "Focus on NUMERICAL DATA and statistics": "Data & Stats Quiz:",
      "Focus on KEY PERSONALITIES and their contributions": "Key Figures Quiz:",
      "Focus on RECENT DEVELOPMENTS and current relevance": "Current Affairs Quiz:",
    };
    const titlePrefix = variationFocus ? (perspectiveMap[variationFocus] || "Quiz:") : "Quiz:";

    return `You are an expert UPSC/PSC question paper setter with years of experience creating competitive exam questions.
${sourceContext}
${variationFocus ? `
=== MANDATORY UNIQUE PERSPECTIVE FOR THIS QUIZ ===
${variationFocus}

CRITICAL REQUIREMENTS:
1. TITLE: Must start with "${titlePrefix}" followed by topic
2. QUESTION SELECTION: Test facts most relevant to this perspective
3. QUESTION FRAMING: Frame questions from this angle
4. DIFFICULTY MIX: Adjust based on what matters for this focus
5. EXPLANATIONS: Explain answers through this lens

Every question must reflect this unique perspective.
===============================================
` : ""}
TASK: Create a quiz testing SPECIFIC facts from the content below. Every question must be directly answerable from the provided content.

SPECIAL HANDLING FOR VIDEO METADATA (when transcript unavailable):
If the content contains "Full transcript could not be extracted" or starts with video metadata, use the topic from the video title and description to create a quiz using your knowledge. Generate exam-relevant MCQs testing key concepts, formulas, facts, and definitions of that topic.

CRITICAL RULE: Every question must test a SPECIFIC fact from the content or, for video metadata, from your knowledge of the topic. Do NOT create generic questions - test ACTUAL exam-relevant facts.

Content to create quiz from:
---
${content}
---

FOR CURRENT AFFAIRS/NEWS CONTENT:
- Test specific news items: "Which country did India sign the XYZ agreement with?"
- Test specific numbers: "What is the budget allocated for ABC scheme?"
- Test specific names: "Who was appointed as the new chairman of XYZ?"
- Test specific dates: "When was the ABC policy announced?"

REQUIREMENTS FOR HIGH-QUALITY QUIZ:
1. QUANTITY: Create 12-15 MCQ questions testing SPECIFIC facts from the content
2. CONTENT-BASED: Every question must test something explicitly stated in the content
   - GOOD: "What was the amount of the infrastructure fund announced?" (if mentioned in content)
   - BAD: "Why is infrastructure development important?" (generic)
3. DIFFICULTY DISTRIBUTION:
   - 4-5 Easy: Direct facts (names, dates, numbers from content)
   - 5-6 Medium: Connecting facts or understanding implications
   - 3-4 Hard: Analysis requiring multiple facts from content
4. DISTRACTOR QUALITY:
   - Wrong options should be plausible but clearly wrong per the content
   - Use similar names/numbers as distractors
5. EXPLANATIONS:
   - Quote or reference the specific part of content that gives the answer
   - Explain why other options don't match the content

EMOJI MARKERS (add to each question based on topic):
📜 History/Historical | 🏛️ Government/Polity | 💰 Economy/Finance
🌍 Geography/Environment | 🔬 Science/Technology | 👥 Social Issues
📊 Statistics/Data | ⚖️ Law/Legal

Return ONLY valid JSON (no markdown, no code blocks):
{
  "title": "Quiz on [specific topic from content]",
  "description": "Testing knowledge of [specific content covered]",
  "questions": [
    {
      "id": "1",
      "question": "🏛️ Question testing specific fact from content?",
      "difficulty": "easy",
      "options": [
        {"id": "a", "text": "Correct answer from content"},
        {"id": "b", "text": "Plausible but incorrect option"},
        {"id": "c", "text": "Another plausible distractor"},
        {"id": "d", "text": "Fourth option"}
      ],
      "correctOptionId": "a",
      "explanation": "As stated in the content, [specific reference]. Option B is wrong because... Option C is wrong because..."
    }
  ]
}`;
  },

  infographic: (content, sourceContext = "", variationFocus = "") => {
    const perspectiveMap: Record<string, string> = {
      "Focus on PRACTICAL APPLICATIONS and real-world examples": "Applied Insights:",
      "Focus on HISTORICAL CONTEXT and evolution of concepts": "Historical Timeline:",
      "Focus on COMPARISONS and contrasts between related topics": "Comparison Chart:",
      "Focus on CAUSE-EFFECT relationships and implications": "Impact Analysis:",
      "Focus on EXAM-RELEVANT facts that are frequently tested": "Exam Facts:",
      "Focus on INTERCONNECTIONS between different concepts": "Concept Web:",
      "Focus on EXCEPTIONS and special cases": "Special Cases:",
      "Focus on NUMERICAL DATA and statistics": "Data Dashboard:",
      "Focus on KEY PERSONALITIES and their contributions": "Key Figures:",
      "Focus on RECENT DEVELOPMENTS and current relevance": "Current Update:",
    };
    const titlePrefix = variationFocus ? (perspectiveMap[variationFocus] || "Infographic:") : "Infographic:";

    return `You are an expert data visualization designer and UPSC educator creating visual study aids.
${sourceContext}
${variationFocus ? `
=== MANDATORY UNIQUE PERSPECTIVE FOR THIS INFOGRAPHIC ===
${variationFocus}

CRITICAL REQUIREMENTS:
1. TITLE: Must start with "${titlePrefix}" followed by topic
2. KEY FACTS: Select facts most relevant to this perspective
3. CHARTS: Design visualizations that highlight this angle
4. TIMELINE: Prioritize events that support this viewpoint
5. HIGHLIGHTS: Emphasize takeaways from this perspective

Every section must reflect this unique focus.
===============================================
` : ""}
TASK: Extract SPECIFIC facts, news items, events, and data from the content below to create an infographic with concrete, exam-relevant information.

SPECIAL HANDLING FOR VIDEO METADATA (when transcript unavailable):
If the content contains "Full transcript could not be extracted" or starts with video metadata, use the topic from the video title and description to create an infographic using your knowledge. Generate exam-relevant facts, data, timelines, and key information about that topic.

CRITICAL RULE: You must extract ACTUAL SPECIFIC information from the content or, for video metadata, from your knowledge of the topic. Do NOT create generic summaries - instead provide SPECIFIC facts, dates, formulas, and data points.

Content to extract information from:
---
${content}
---

FOR CURRENT AFFAIRS/NEWS CONTENT:
- Extract SPECIFIC news headlines and stories discussed (e.g., "India-France signed €20bn defense deal" NOT "International relations highlighted")
- Include actual names: ministers, officials, countries, organizations mentioned
- Include actual numbers: budget figures, statistics, percentages from the news
- Include actual policy/bill/act names mentioned
- Include actual dates of events discussed

REQUIREMENTS FOR HIGH-QUALITY INFOGRAPHIC:
1. KEY FACTS (8-12 items) - Each must be a SPECIFIC fact from the content:
   - Actual news item: "PM Modi announced ₹50,000 crore infrastructure fund"
   - NOT generic: "Government focused on infrastructure development"
   - Include: Person name + Action + Specific detail/number
   - For each fact, extract: WHO did WHAT with WHAT SPECIFIC detail

2. CHARTS: Create 2-4 charts ONLY if the content has actual numerical data:
   - Use real numbers/statistics mentioned in the content
   - If no numbers available, skip charts rather than making up data
   - Chart titles should reflect specific data being shown

3. TIMELINE: Include specific events with actual dates from the content:
   - Only include if specific dates/events are mentioned
   - Each entry should have: specific date + specific event + why it matters

4. HIGHLIGHTS: Key exam-relevant takeaways with specific details:
   - "India became 5th largest economy" NOT "India's economic growth"
   - Include specific names, numbers, and facts students should memorize

EMOJI MARKERS (use in keyFacts based on topic):
📜 History/Historical | 🏛️ Government/Polity | 💰 Economy/Finance
🌍 Geography/Environment | 🔬 Science/Technology | 👥 Social Issues
📊 Statistics/Data | 🎯 High-priority exam fact | ⚖️ Law/Legal

WHAT TO AVOID:
- Generic category labels like "Economic Development", "Social Issues", "International Relations"
- Vague summaries without specific details
- Made-up statistics or numbers not in the source
- Generic statements that could apply to any day's news

Return ONLY valid JSON (no markdown, no code blocks):
{
  "title": "Specific title reflecting actual content topic",
  "subtitle": "Date or specific context",
  "charts": [
    {
      "type": "bar",
      "title": "Specific comparison from content",
      "labels": ["Actual item 1", "Actual item 2"],
      "data": [actual_value1, actual_value2],
      "description": "What this specific data shows"
    }
  ],
  "keyFacts": [
    {"label": "🏛️ Specific Event/Announcement Name", "value": "Who + What + Specific detail/number", "icon": "star"},
    {"label": "💰 Actual Policy/Bill Name", "value": "Key provision with specific impact"},
    {"label": "🎯 Key Exam Fact", "value": "Memorable statistic or first/record"}
  ],
  "timeline": [
    {"date": "Actual date", "event": "Specific event with names and details", "importance": "high"}
  ],
  "highlights": [
    "🎯 Specific fact with name/number that exam might ask",
    "Another specific memorable detail from the content"
  ]
}`;
  },
};

// A paid "Better answer" charge in flight for this request (refunded if the answer fails).
interface BetterCharge {
  userId: string;
  chargeId: string;
  balancePaise: number;
}

export async function POST(request: NextRequest) {
  const ctx: { charge: BetterCharge | null } = { charge: null };
  let response: NextResponse;
  try {
    response = await generate(request, ctx);
  } catch (error) {
    console.error("Study AI generate error:", (error as Error)?.message || error);
    response = NextResponse.json({ error: "Failed to generate content. Please try again." }, { status: 500 });
  }
  // The student only pays for a better answer they actually got.
  if (ctx.charge && response.status >= 400) {
    await refundBetterAnswer(createServiceClient(), ctx.charge.userId, ctx.charge.chargeId);
  }
  return response;
}

async function generate(request: NextRequest, ctx: { charge: BetterCharge | null }): Promise<NextResponse> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResponse = await applyRateLimit(request, "aiGeneration", user.id);
    if (rateLimitResponse) return rateLimitResponse;

    let rawBody;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validation = validateBody(studyAIGenerateSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    const { goalId, generationType, sourceContent, modelTier } = validation.data;

    // Verify user owns the goal
    const { data: goal, error: goalError } = await supabase
      .from("study_ai_goals")
      .select("id, user_id")
      .eq("id", goalId)
      .single();

    if (goalError || !goal || goal.user_id !== user.id) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    // Check user's Pro status
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro_member")
      .eq("id", user.id)
      .single();

    const isPro = hasProAccess(profile);

    // DEV MODE: Set to true to bypass daily limit during testing
    const DEV_BYPASS_LIMIT = process.env.NODE_ENV === "development";

    // Check per-type daily limit for free users (1 of each type per day)
    if (!isPro && !DEV_BYPASS_LIMIT) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Check if user already generated this type today
      const { count } = await supabase
        .from("ai_generations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("generation_type", generationType)
        .gte("created_at", todayStart.toISOString());

      if ((count ?? 0) >= 1) {
        return NextResponse.json(
          {
            error: `You've already generated a ${generationType} today. Try a different type or upgrade to Pro for unlimited.`,
            code: "DAILY_LIMIT_TYPE",
            generationType,
            upgradeUrl: "/pricing",
          },
          { status: 429 }
        );
      }
    }

    // Get the prompt for this generation type
    const promptFn = GENERATION_PROMPTS[generationType as StudyAIGenerationType];
    if (!promptFn) {
      return NextResponse.json(
        { error: "Invalid generation type" },
        { status: 400 }
      );
    }

    // ==========================================================
    // CONTENT VALIDATION - Ensure we have real content to work with
    // ==========================================================

    // Debug logging for content analysis
    console.log(`[Study AI] Source content length: ${sourceContent.length} characters`);
    console.log(`[Study AI] Source content preview: "${sourceContent.slice(0, 200)}..."`);

    // Check for fallback messages that indicate no real content was extracted
    const fallbackIndicators = [
      "Note: This video does not have a transcript available",
      "Note: Transcript is not available",
      "Note: Could not fetch transcript",
      "Note: Could not extract text automatically",
      "Note: Text extraction timed out",
    ];

    const hasFallbackMessage = fallbackIndicators.some((indicator) =>
      sourceContent.includes(indicator)
    );

    // Remove source URL headers and fallback messages to get actual content
    const cleanedContent = sourceContent
      .replace(/\[Source:.*?\]\n\n/g, "")
      .replace(/YouTube Video:.*?\n\n/g, "")
      .replace(/Note:.*?(?:\n|$)/g, "")
      .trim();

    // Check if content is too short to generate meaningful output
    const MIN_CONTENT_LENGTH = 100; // At least 100 chars of actual content
    if (cleanedContent.length < MIN_CONTENT_LENGTH || hasFallbackMessage) {
      return NextResponse.json(
        {
          error: "Not enough content to generate study materials. The uploaded content doesn't have enough text - YouTube videos need captions/transcripts available, or try uploading PDF/images with more text.",
          code: "INSUFFICIENT_CONTENT",
          details: hasFallbackMessage
            ? "The YouTube video doesn't have a transcript available. Try a video with captions enabled, or upload your notes as images/PDFs instead."
            : `Content is too short (${cleanedContent.length} characters). Please add more source material.`,
        },
        { status: 400 }
      );
    }

    // ==========================================================
    // CONTENT QUALITY PROCESSING
    // ==========================================================

    // 1. Detect content source type
    const contentSource = detectContentSource(sourceContent);
    console.log(`[Study AI] Content source detected: ${contentSource}`);

    // 2. Pre-process content based on source
    const processedContent = preprocessContent(sourceContent, contentSource);

    // 3. Assess content quality
    const { score: qualityScore, issues: qualityIssues } = assessContentQuality(processedContent);
    console.log(`[Study AI] Content quality score: ${qualityScore}/100`, qualityIssues);

    // 4. Determine content limit based on source and length
    // YouTube long videos get extended limit, others use standard
    let contentLimit = CONTENT_LIMITS.standard;
    if (contentSource === "youtube" && processedContent.length > CONTENT_LIMITS.standard) {
      contentLimit = CONTENT_LIMITS.extended;
      console.log(`[Study AI] Extended content limit for long YouTube video: ${contentLimit}`);
    }

    // 5. Get source-aware context for the prompt (handles multi-source detection)
    const isMultiSource = hasMultipleSources(processedContent);
    const sourceTypes = extractSourceTypes(processedContent);
    if (isMultiSource) {
      console.log(`[Study AI] Multi-source content detected: ${sourceTypes.join(", ")}`);
    }
    const sourceContext = getSourceContext(processedContent);

    // 6. Build the final prompt with source context and variation for uniqueness
    const finalContent = processedContent.slice(0, contentLimit);
    const { focus: variationFocus, focusIndex, uniqueId } = getVariationFocus();

    // LOG the variation being used - this helps debug if same summaries are generated
    console.log(`[Study AI] === VARIATION SELECTED ===`);
    console.log(`[Study AI] Focus: ${variationFocus}`);
    console.log(`[Study AI] Focus Index: ${focusIndex}/9`);
    console.log(`[Study AI] Unique ID: ${uniqueId}`);
    console.log(`[Study AI] ===========================`);

    // Pass variation directly INTO the prompt function so it's integrated into the title requirement
    const prompt = promptFn(finalContent, sourceContext, variationFocus);

    // Per-user daily cap (abuse guard; see src/lib/daily-cap.ts)
    const dailyCapResponse = await enforceDailyCap(user.id, "aiGeneration");
    if (dailyCapResponse) return dailyCapResponse;

    // Paid upgrade: take ₹5 from the student's AI credits before calling the stronger model.
    if (modelTier === "better") {
      const charge = await chargeBetterAnswer(createServiceClient(), user.id, `study_ai_${generationType}`);
      if (!charge.ok) {
        return NextResponse.json(
          {
            error: "Not enough AI credits for a better answer. Top up to continue.",
            code: "INSUFFICIENT_CREDITS",
            balancePaise: charge.balancePaise,
            pricePaise: BETTER_ANSWER_PRICE_PAISE,
          },
          { status: 402 }
        );
      }
      ctx.charge = { userId: user.id, chargeId: charge.chargeId, balancePaise: charge.balancePaise };
    }

    let model;
    try {
      model =
        modelTier === "better"
          ? getGeminiClient().getGenerativeModel({ model: AI_MODELS.better, generationConfig: GENERATION_CONFIG.pro })
          : await getWorkingGeminiModel(isPro);
    } catch (configError: any) {
      console.error("Gemini config error:", configError.message);
      return NextResponse.json(
        { error: "AI service is not configured. Please contact support." },
        { status: 503 }
      );
    }

    // Retry with exponential backoff for rate limit errors
    let result;
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        result = await model.generateContent(prompt);
        break; // Success, exit retry loop
      } catch (genError: any) {
        const errMsg = genError.message || "";

        const isRateLimit = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("Too Many Requests") || errMsg.includes("RESOURCE_EXHAUSTED");

        // Retry on rate limit if we have attempts left
        if (isRateLimit && attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        console.error("Gemini API error:", errMsg);

        if (isRateLimit) {
          return NextResponse.json(
            {
              error: "AI service is temporarily busy. Please wait a minute and try again.",
              code: "RATE_LIMIT",
              retryAfter: 60
            },
            { status: 429 }
          );
        }

        if (errMsg.includes("API_KEY_INVALID") || errMsg.includes("401") || errMsg.includes("403")) {
          return NextResponse.json(
            { error: "AI service authentication failed. Please contact support." },
            { status: 503 }
          );
        }

        if (errMsg.includes("SAFETY") || errMsg.includes("blocked")) {
          return NextResponse.json(
            { error: "Content was blocked by safety filters. Please try different source material." },
            { status: 400 }
          );
        }

        return NextResponse.json(
          { error: "AI generation failed. Please try again." },
          { status: 500 }
        );
      }
    }

    if (!result) {
      return NextResponse.json(
        { error: "AI generation failed. Please try again." },
        { status: 500 }
      );
    }

    const responseText = result.response.text();

    // Clean and parse JSON response
    let cleanedText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // Strip any preamble text before the JSON (Gemini sometimes adds explanations)
    const jsonStartIndex = cleanedText.indexOf('{');
    if (jsonStartIndex > 0) {
      console.log("Stripping preamble:", cleanedText.slice(0, jsonStartIndex).slice(0, 100));
      cleanedText = cleanedText.slice(jsonStartIndex);
    }

    let outputData;
    try {
      outputData = JSON.parse(cleanedText);
    } catch (parseError: any) {
      console.error("JSON parse error:", parseError.message);
      console.error("Raw response preview:", cleanedText.slice(0, 300));

      // Try to fix common JSON issues
      try {
        let fixedText = cleanedText;

        // First, find the balanced JSON object (remove trailing content)
        let braceCount = 0;
        let jsonEndIndex = -1;
        for (let i = 0; i < fixedText.length; i++) {
          if (fixedText[i] === '{') braceCount++;
          if (fixedText[i] === '}') braceCount--;
          if (braceCount === 0 && fixedText[i] === '}') {
            jsonEndIndex = i + 1;
            break;
          }
        }

        if (jsonEndIndex > 0) {
          fixedText = fixedText.slice(0, jsonEndIndex);
        }

        // Try parsing the trimmed JSON
        try {
          outputData = JSON.parse(fixedText);
        } catch {
          // Fix newlines inside string values by processing character by character
          let result = '';
          let inString = false;
          let escaped = false;

          for (let i = 0; i < fixedText.length; i++) {
            const char = fixedText[i];

            if (escaped) {
              result += char;
              escaped = false;
              continue;
            }

            if (char === '\\') {
              escaped = true;
              result += char;
              continue;
            }

            if (char === '"') {
              inString = !inString;
              result += char;
              continue;
            }

            // If we're inside a string and encounter a real newline, escape it
            if (inString && (char === '\n' || char === '\r')) {
              result += '\\n';
              continue;
            }

            result += char;
          }

          outputData = JSON.parse(result);
        }
      } catch (retryError: any) {
        console.error("Retry parse also failed:", retryError.message);
        console.error("Response preview:", cleanedText.slice(0, 500));
        return NextResponse.json(
          { error: "Failed to generate content. Please try again." },
          { status: 500 }
        );
      }
    }

    // Save generation to database
    const { data: generation, error: insertError } = await supabase
      .from("ai_generations")
      .insert({
        user_id: user.id,
        goal_id: goalId,
        generation_type: generationType,
        output_data: outputData,
        title: outputData.title || `${generationType} - ${new Date().toLocaleDateString()}`,
        is_saved: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to save generation:", insertError);
      return NextResponse.json(
        { error: "Failed to save generation" },
        { status: 500 }
      );
    }

    // Award XP based on generation type
    const XP_REWARDS: Record<string, number> = {
      mindmap: 10,
      summary: 5,
      flashcards: 8,
      quiz: 10,
      infographic: 8,
    };

    const xpAmount = XP_REWARDS[generationType] || 5;

    // Insert XP transaction
    await supabase.from("xp_transactions").insert({
      user_id: user.id,
      amount: isPro ? Math.floor(xpAmount * 1.5) : xpAmount,
      reason: `study_ai_${generationType}`,
      multiplier: isPro ? 1.5 : 1,
      reference_id: generation.id.toString(),
    });

    // Update profile XP
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("xp_points")
      .eq("id", user.id)
      .single();

    if (currentProfile) {
      const newXP = (currentProfile.xp_points || 0) + (isPro ? Math.floor(xpAmount * 1.5) : xpAmount);
      await supabase
        .from("profiles")
        .update({ xp_points: newXP })
        .eq("id", user.id);
    }

    // Revalidate the goal page cache so new generation shows when navigating back
    revalidatePath(`/study-ai/goals/${goalId}`);

    return NextResponse.json({
      success: true,
      generation,
      modelTier,
      ...(ctx.charge ? { creditsBalancePaise: ctx.charge.balancePaise } : {}),
    });
  } catch (error: any) {
    console.error("Study AI generate error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to generate content. Please try again." },
      { status: 500 }
    );
  }
}
