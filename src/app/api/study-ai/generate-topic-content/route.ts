import { BASIC_MODEL_CHAIN } from "@/lib/ai-models";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_NOT_CONFIGURED");
  }
  return new GoogleGenerativeAI(apiKey);
}

// Model fallback chain for reliability
const MODEL_FALLBACKS = [
  ...BASIC_MODEL_CHAIN,         // Cheap default first, then an even cheaper fallback
];

async function generateWithFallback(
  genAI: GoogleGenerativeAI,
  prompt: string,
  maxTokens: number
): Promise<string> {
  let lastError: Error | null = null;

  for (const modelName of MODEL_FALLBACKS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.8,
          topK: 50,
          topP: 0.95,
          maxOutputTokens: maxTokens,
        },
      });

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Verify we got a non-empty response
      if (responseText && responseText.trim().length > 0) {
        console.log(`[generate-topic-content] Success with model: ${modelName}`);
        return responseText;
      }

      console.warn(`[generate-topic-content] Empty response from ${modelName}, trying next...`);
    } catch (error) {
      lastError = error as Error;
      console.warn(`[generate-topic-content] Model ${modelName} failed:`, (error as Error).message);
      // Continue to next model
    }
  }

  // All models failed
  throw lastError || new Error("All models failed to generate content");
}

// Attempt to repair truncated JSON (for when AI output gets cut off)
function repairTruncatedJSON(text: string): string {
  let repaired = text.trim();

  // Count brackets and braces
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let lastChar = '';

  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (char === '"' && lastChar !== '\\') {
      inString = !inString;
    }
    if (!inString) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      if (char === '[') bracketCount++;
      if (char === ']') bracketCount--;
    }
    lastChar = char;
  }

  // If we're in an unclosed string, close it
  if (inString) {
    repaired += '"';
  }

  // Remove trailing incomplete entries (ends with comma or colon)
  repaired = repaired.replace(/,\s*$/, '');
  repaired = repaired.replace(/:\s*$/, ': null');

  // Close unclosed brackets and braces
  while (bracketCount > 0) {
    repaired += ']';
    bracketCount--;
  }
  while (braceCount > 0) {
    repaired += '}';
    braceCount--;
  }

  return repaired;
}

// Helper function to extract state name from exam type
function getStateName(examType: string): string | null {
  const examTypeLower = (examType || "").toLowerCase();

  // Common state PSC patterns
  const statePatterns: Record<string, string> = {
    'sikkim|spsc': 'Sikkim',
    'uppsc|uttar pradesh': 'Uttar Pradesh',
    'mppsc|madhya pradesh': 'Madhya Pradesh',
    'bpsc|bihar': 'Bihar',
    'rpsc|rajasthan': 'Rajasthan',
    'wbpsc|west bengal': 'West Bengal',
    'kpsc|karnataka': 'Karnataka',
    'tnpsc|tamil nadu': 'Tamil Nadu',
    'appsc|andhra pradesh': 'Andhra Pradesh',
    'tspsc|telangana': 'Telangana',
    'gpsc|gujarat': 'Gujarat',
    'hpsc|haryana': 'Haryana',
    'ppsc|punjab': 'Punjab',
    'opsc|odisha|orissa': 'Odisha',
    'jpsc|jharkhand': 'Jharkhand',
    'cgpsc|chhattisgarh': 'Chhattisgarh',
    'ukpsc|uttarakhand': 'Uttarakhand',
    'hppsc|himachal': 'Himachal Pradesh',
    'jkpsc|jammu|kashmir': 'Jammu & Kashmir',
    'mpsc|maharashtra': 'Maharashtra',
    'kpsc|kerala': 'Kerala',
    'apsc|assam': 'Assam',
  };

  for (const [pattern, stateName] of Object.entries(statePatterns)) {
    if (new RegExp(pattern, 'i').test(examTypeLower)) {
      return stateName;
    }
  }
  return null;
}

// Helper function to get exam-specific PYQ configuration
function getExamConfig(examType: string) {
  const examTypeLower = (examType || "").toLowerCase();

  // State PSC exams (any state)
  const stateName = getStateName(examType);
  const isStatePSC = stateName !== null || /psc|public service/i.test(examTypeLower);

  // Engineering entrance (JEE)
  const isJEE = /jee|joint entrance|iit|nit/i.test(examTypeLower);
  // Engineering services/jobs (ESE, GATE, JE, AE)
  const isEngineeringServices = /ese|gate|je|junior engineer|ae|assistant engineer|civil|mechanical|electrical|electronics/i.test(examTypeLower) && !isJEE;
  // Medical entrance (NEET)
  const isNEET = /neet|aiims|jipmer|medical entrance/i.test(examTypeLower);
  // Board exams
  const isBoard = /cbse|icse|board|class\s*10|class\s*12|10th|12th|hsc/i.test(examTypeLower);
  // SAT
  const isSAT = /sat|scholastic|college board/i.test(examTypeLower);
  // GRE/GMAT
  const isGRE = /gre|gmat|graduate record/i.test(examTypeLower);
  // Pure UPSC (not state PSC)
  const isUPSC = /upsc|civil services|ias|ips|ifs/i.test(examTypeLower) && !isStatePSC;

  if (isJEE) {
    return {
      examName: "JEE",
      examFull: "Joint Entrance Examination (Mains & Advanced)",
      referenceExams: "JEE Mains, JEE Advanced, BITSAT, VITEEE",
      questionStyle: `1. Questions test problem-solving ability and application of concepts
2. Numerical answer type questions (calculate exact values)
3. Multi-concept questions combining 2-3 topics
4. Questions with diagrams, graphs, and data interpretation
5. Integer type and single/multiple correct answer questions`,
      questionTypes: `- Numerical problems (calculate, find the value)
- Conceptual MCQs with tricky options
- Assertion-Reason questions
- Paragraph-based questions (comprehension + calculation)
- Matrix match questions`,
      emojiMarkers: "⚡ Physics | ⚗️ Chemistry | 📐 Mathematics | 🧮 Calculus | 🔢 Algebra | 📊 Coordinate Geometry",
      exampleRef: "JEE Mains 2023",
    };
  }

  if (isEngineeringServices) {
    return {
      examName: "ESE/GATE",
      examFull: "Engineering Services Examination / GATE",
      referenceExams: "UPSC ESE, GATE, SSC JE, State PSC JE/AE",
      questionStyle: `1. Questions test core engineering concepts and their applications
2. Numerical problems with standard formulas
3. Questions on IS codes and design standards
4. Application of theory to practical engineering problems
5. Questions on recent technology and engineering developments`,
      questionTypes: `- Numerical problems (calculate stress, strain, discharge, power, etc.)
- Conceptual MCQs on engineering principles
- Design-based questions (IS code values, safety factors)
- Statement-based questions on engineering practices
- Match the following (equipment-use, term-definition)`,
      emojiMarkers: "🏗️ Civil | ⚙️ Mechanical | ⚡ Electrical | 📡 Electronics | 🔧 Design | 📏 Analysis",
      exampleRef: "UPSC ESE 2023 / GATE 2024",
    };
  }

  if (isNEET) {
    return {
      examName: "NEET",
      examFull: "National Eligibility cum Entrance Test (NEET-UG)",
      referenceExams: "NEET-UG, AIIMS, JIPMER",
      questionStyle: `1. Questions strictly from NCERT textbook content
2. Factual questions on biological processes and mechanisms
3. Questions on normal values, drug names, disease symptoms
4. Diagram-based questions (anatomy, cell structure, plant parts)
5. Questions testing scientific names and taxonomic classification`,
      questionTypes: `- Direct factual questions (Which organelle...? What is the function of...?)
- Statement-based questions (Select the correct/incorrect statement)
- Assertion-Reason questions (NEET format)
- Match the following (Column A with Column B)
- Questions on exceptions and special cases`,
      emojiMarkers: "🧬 Biology | 🦠 Zoology | 🌱 Botany | ⚗️ Chemistry | ⚡ Physics | 🏥 Medical",
      exampleRef: "NEET-UG 2023",
    };
  }

  if (isBoard) {
    return {
      examName: "Board Exam",
      examFull: "CBSE/State Board Examination",
      referenceExams: "CBSE Board, State Board Previous Years",
      questionStyle: `1. Questions directly from NCERT/textbook content
2. Application of formulas and theorems
3. Case study and competency-based questions
4. Questions testing definitions and key concepts
5. Derivation-based conceptual questions`,
      questionTypes: `- Direct questions from textbook (1-2 marks type)
- Application-based problems (3-5 marks type)
- Case study questions (competency-based)
- Very short answer (VSA) type MCQs
- Diagram-based and labeling questions`,
      emojiMarkers: "📚 NCERT | 🔬 Science | 📐 Math | 🌍 Social Science | 📖 Language | ✍️ Writing",
      exampleRef: "CBSE 2023 Board",
    };
  }

  if (isSAT) {
    return {
      examName: "SAT",
      examFull: "Scholastic Assessment Test",
      referenceExams: "SAT, PSAT, College Board Practice Tests",
      questionStyle: `1. Evidence-based reading and writing questions
2. Questions test critical thinking and analysis
3. Math questions with and without calculator
4. Grammar and punctuation rules testing
5. Data interpretation and graph-based questions`,
      questionTypes: `- Reading comprehension with evidence questions
- Sentence completion and grammar correction
- Math problem solving (algebra, geometry, statistics)
- Data analysis and interpretation
- Writing improvement questions`,
      emojiMarkers: "📖 Reading | ✍️ Writing | 🔢 Math | 📊 Data | 🧠 Reasoning | 📝 Grammar",
      exampleRef: "SAT 2023",
    };
  }

  if (isGRE) {
    return {
      examName: "GRE",
      examFull: "Graduate Record Examination",
      referenceExams: "GRE General, GRE Subject Tests",
      questionStyle: `1. Verbal reasoning with vocabulary-heavy questions
2. Quantitative comparison questions
3. Text completion with multiple blanks
4. Sentence equivalence (two correct answers)
5. Reading comprehension with inference questions`,
      questionTypes: `- Text completion (1-3 blanks)
- Sentence equivalence (pick 2 answers)
- Reading comprehension (inference, main idea, tone)
- Quantitative comparison (A vs B)
- Data interpretation (graphs, tables)`,
      emojiMarkers: "📚 Verbal | 🔢 Quant | 📖 Reading | ✍️ Writing | 🧠 Reasoning | 📊 Data",
      exampleRef: "GRE 2023",
    };
  }

  // State PSC exams - includes both state-specific AND UPSC questions
  if (isStatePSC && !isUPSC) {
    const state = stateName || "State";
    const stateAbbrev = state.split(' ').map(w => w[0]).join('').toUpperCase() + "PSC";
    return {
      examName: `${state} PSC`,
      examFull: `${state} Public Service Commission Examinations`,
      referenceExams: `${stateAbbrev}, UPSC CSE, CDS, State PCS`,
      isStatePSC: true, // Flag to indicate this needs both state and UPSC questions
      stateName: state, // Store state name for prompts
      questionStyle: `1. Questions test conceptual understanding, not just rote memorization
2. Questions often have "All of the above" or "None of the above" options
3. Questions may use statements format: "Consider the following statements..."
4. Include ${state}-specific questions (history, geography, culture, government)
5. Follow UPSC pattern as State PSCs often mirror UPSC style
6. Some questions are straightforward, others require analytical thinking`,
      questionTypes: `- Direct factual questions (Who/What/When/Where)
- Statement-based questions (Which statements are correct?)
- Assertion-Reason questions
- Match the following
- ${state}-specific questions (local history, geography, governance)
- Application-based questions`,
      emojiMarkers: "📜 History | 🏛️ Government/Polity | 💰 Economy | 🌍 Geography | 🔬 Science | 👥 Social | ⚖️ Law | 🏔️ State",
      exampleRef: `${stateAbbrev} Prelims 2023 / UPSC CSE 2023`,
    };
  }

  // Default: UPSC style (also for pure UPSC exams)
  return {
    examName: "UPSC",
    examFull: "Civil Services Examination (CSE)",
    referenceExams: "CSE, CDS, NDA, CAPF",
    questionStyle: `1. Questions test conceptual understanding, not just rote memorization
2. Questions often have "All of the above" or "None of the above" options
3. Questions may use statements format: "Consider the following statements..."
4. Questions test current affairs relevance to topics
5. Questions often require elimination of wrong options
6. Some questions are straightforward, others require analytical thinking`,
    questionTypes: `- Direct factual questions (Who/What/When/Where)
- Statement-based questions (Which statements are correct?)
- Assertion-Reason questions
- Match the following
- Chronological order questions (if applicable)
- Application-based questions`,
    emojiMarkers: "📜 History | 🏛️ Government/Polity | 💰 Economy | 🌍 Geography | 🔬 Science | 👥 Social | ⚖️ Law",
    exampleRef: "UPSC CSE 2023 Prelims",
  };
}

// Enhanced prompts with exam focus, memory techniques, and specific content extraction
const SOURCE_BASED_PROMPTS: Record<string, (subject: string, topics: string[], examType: string, sourceContent: string) => string> = {
  summary: (subject, topics, examType, sourceContent) => {
    const examName = examType === "sikkim-psc" ? "Sikkim PSC" : "UPSC";
    return `You are an expert ${examName} educator creating comprehensive study notes.

TOPIC: ${subject} - ${topics.join(", ")}
EXAM TARGET: ${examName}

The student has provided the following study materials:
---
${sourceContent}
---

TASK: Create a detailed, exam-oriented summary extracting ALL specific facts, names, dates, and information from the content above.

REQUIREMENTS FOR HIGH-QUALITY SUMMARY:
1. SPECIFICITY: Every point must have concrete details (who, what, when, how much)
   - GOOD: "PM announced ₹2 lakh crore National Infrastructure Pipeline"
   - BAD: "Government announced infrastructure development plans"
2. STRUCTURE: Organize by specific topics discussed in the content
3. EXAM FOCUS: Highlight specific facts that could be asked in exams
4. COMPLETENESS: Don't miss any specific fact, name, date, or number mentioned

EMOJI MARKERS (add to key points based on topic):
📜 History | 🏛️ Government | 💰 Economy | 🌍 Geography | 🔬 Science | 👥 Social | 📊 Statistics | 🎯 High-priority fact

OUTPUT STRUCTURE:
1. Key Points (10-15 points with emoji markers and specific details)
2. Important Dates/Events (if mentioned in content)
3. Key Concepts (4-6 with brief explanations from the content)
4. Exam Facts (must-remember specific facts)

Return ONLY valid JSON (no markdown code blocks):
{
  "title": "Summary: ${subject} - ${topics[0]}",
  "keyPoints": ["🏛️ Specific point with actual name/detail from content", "💰 Another specific fact..."],
  "keyDates": [{"date": "Actual date", "event": "Specific event with names"}],
  "keyConcepts": [{"concept": "Concept name from content", "explanation": "Explanation using specific details"}],
  "examFacts": ["🎯 Specific statistic or fact", "Another memorable fact"]
}`;
  },

  flashcards: (subject, topics, examType, sourceContent) => {
    const examName = examType === "sikkim-psc" ? "Sikkim PSC" : "UPSC";
    return `You are an expert ${examName} educator creating flashcards.

TOPIC: ${subject} - ${topics.join(", ")}
EXAM TARGET: ${examName}

Study materials provided:
---
${sourceContent}
---

TASK: Create 15 flashcards extracting SPECIFIC facts from the content above.

REQUIREMENTS:
1. QUANTITY: 15 flashcards covering ALL important facts
2. CONTENT-BASED: Every question must come from the provided content
3. VARIETY: Mix question types:
   - Definition cards (What is X?)
   - Fact cards (When/Where/Who?)
   - Comparison cards (if content compares things)
4. SPECIFICITY: Use exact names, dates, numbers from content

DIFFICULTY LEVELS:
- "easy": Direct recall of single fact
- "medium": Understanding concepts, connecting facts
- "hard": Analysis, comparison of multiple concepts

HINTS (for medium/hard cards):
- Provide memory hooks, mnemonics, or clues
- Use acronyms, associations, or memorable phrases

EMOJI MARKERS:
📜 History | 🏛️ Government | 💰 Economy | 🌍 Geography | 🔬 Science | 👥 Social | 📊 Statistics

Return ONLY valid JSON (no markdown code blocks):
{
  "title": "Flashcards: ${subject}",
  "cards": [
    {"id": "1", "front": "📜 When was [specific event from content]?", "back": "Answer with specific detail", "difficulty": "easy"},
    {"id": "2", "front": "🏛️ What is [concept from content]?", "back": "Definition from content", "difficulty": "medium", "hint": "Remember: Has 3 key features..."},
    {"id": "3", "front": "💰 Compare X and Y from content", "back": "Detailed comparison", "difficulty": "hard", "hint": "Think about purpose and scope"}
  ]
}`;
  },

  quiz: (subject, topics, examType, sourceContent) => {
    const examName = examType === "sikkim-psc" ? "Sikkim PSC" : "UPSC";
    return `You are an expert ${examName} question paper setter with years of experience creating competitive exam questions.

TOPIC: ${subject} - ${topics.join(", ")}
EXAM TARGET: ${examName}

Study materials provided:
---
${sourceContent}
---

TASK: Create a quiz testing SPECIFIC facts from the content above. Every question must be directly answerable from the provided content.

CRITICAL RULES - STRICTLY FOLLOW:
1. Questions must be CLEAN and DIRECT - just the question text
2. NEVER EVER use these phrases or anything similar in questions:
   - "According to the content/passage/text/video/channel..."
   - "Based on the passage/video/description..."
   - "As mentioned in the text/video..."
   - "According to the [ANY CHANNEL NAME] video..."
   - "According to the metadata/source..."
   - "The video/content states that..."
   - ANY reference to YouTube, video, channel name, description, transcript, metadata, passage, source
3. Do NOT include difficulty labels IN the question text
4. Questions should read like REAL EXAM QUESTIONS - direct and professional
5. Write questions as if testing GENERAL KNOWLEDGE, NOT reading comprehension or video comprehension
6. NEVER mention or reference where the information came from

WRONG EXAMPLES (NEVER DO THIS):
❌ "According to the SPSC Adda video description, what is..."
❌ "Based on the YouTube video, which..."
❌ "According to the content provided, which..."
❌ "The passage mentions that..."
❌ "As shown in the video..."

CORRECT EXAMPLES:
✅ "What is the capital of Sikkim?"
✅ "Which river flows through Gangtok?"
✅ "When was the treaty signed?"
✅ "What are the main features of the Indus Valley Civilization?"

REQUIREMENTS:
1. QUANTITY: 12-15 MCQ questions testing SPECIFIC facts
2. CONTENT-BASED: Every question tests something explicitly stated in the content
   - GOOD: "What is the capital of Sikkim?"
   - BAD: "Based on the passage, what does the author say about..."
3. DIFFICULTY DISTRIBUTION:
   - 4-5 Easy: Direct facts (names, dates, numbers)
   - 5-6 Medium: Connecting facts or understanding implications
   - 3-4 Hard: Analysis requiring multiple facts from content
4. DISTRACTOR QUALITY:
   - Wrong options should be plausible but clearly wrong per the content
   - Use similar names/numbers as distractors
5. EXPLANATIONS (CRITICAL - MUST INCLUDE):
   - Main explanation: Why the correct answer is correct
   - Per-option explanations: For EACH option, explain why it's correct or incorrect
   - This helps students understand their mistakes and learn better

QUESTION FORMAT:
- Start with an emoji marker for topic type
- Write a clear, direct question
- NO metadata, labels, or source references in the question

EMOJI MARKERS (add to start of each question):
📜 History | 🏛️ Government | 💰 Economy | 🌍 Geography | 🔬 Science | 👥 Social | 📊 Statistics | ⚖️ Law

Return ONLY valid JSON (no markdown code blocks):
{
  "title": "Quiz: ${subject} - ${topics[0]}",
  "questions": [
    {
      "id": "1",
      "question": "🏛️ What is the main function of the State Legislative Assembly?",
      "difficulty": "easy",
      "options": [
        {"id": "a", "text": "Making laws for the state", "explanation": "Correct! The primary constitutional function of the State Legislative Assembly is to make laws for the state on subjects in the State List and Concurrent List."},
        {"id": "b", "text": "Appointing judges", "explanation": "Incorrect. Judges are appointed by the Governor on advice of the High Court, not by the Legislative Assembly."},
        {"id": "c", "text": "Conducting elections", "explanation": "Incorrect. Elections are conducted by the Election Commission of India, an independent constitutional body."},
        {"id": "d", "text": "Managing foreign affairs", "explanation": "Incorrect. Foreign affairs are handled exclusively by the Central Government, not state legislatures."}
      ],
      "correctOptionId": "a",
      "explanation": "The State Legislative Assembly's primary function is making laws for the state."
    },
    {
      "id": "2",
      "question": "💰 Which year saw the highest GDP growth?",
      "difficulty": "medium",
      "options": [
        {"id": "a", "text": "2020", "explanation": "Incorrect. 2020 saw negative growth due to the pandemic."},
        {"id": "b", "text": "2021", "explanation": "Incorrect. Though recovery started, growth was still catching up."},
        {"id": "c", "text": "2022", "explanation": "Correct! 2022 recorded 8.7% growth, the highest in the given period."},
        {"id": "d", "text": "2023", "explanation": "Incorrect. Growth moderated to around 6.5% in 2023."}
      ],
      "correctOptionId": "c",
      "explanation": "2022 recorded the highest GDP growth at 8.7%."
    }
  ]
}`;
  },

  mindmap: (subject, topics, examType, sourceContent) => {
    const examName = examType === "sikkim-psc" ? "Sikkim PSC" : "UPSC";
    return `You are an expert ${examName} educator and knowledge architect.

TOPIC: ${subject} - ${topics.join(", ")}
EXAM TARGET: ${examName}

Study materials provided:
---
${sourceContent}
---

TASK: Create a detailed mind map extracting SPECIFIC information from the content - actual names, dates, events, and facts. Include MNEMONICS and MEMORY HOOKS.

REQUIREMENTS FOR HIGH-QUALITY MIND MAP:
1. DEPTH: Create multi-level hierarchy (4-5 levels minimum)
2. BREADTH: Cover ALL important aspects from the content
3. CONNECTIONS: Identify relationships between concepts
4. EXAM FOCUS: Highlight facts frequently asked in exams
5. STRUCTURE:
   - Central Topic (1): Main subject
   - Primary Branches (5-7): Major themes
   - Secondary Branches (3-5 per primary): Key concepts
   - Tertiary Branches (2-4 per secondary): Specific details
   - Leaf Nodes: Dates, statistics, names

MEMORY TECHNIQUES (add throughout):
1. MNEMONICS: Create acronyms for lists
2. MEMORY HOOKS: Link dates to easy-to-remember events
3. VISUAL CUES: Add emoji markers

EMOJI MARKERS:
📜 History | 🏛️ Government | 💰 Economy | 🌍 Geography | 🔬 Science | 👥 Social
📊 Statistics | 🎯 Key exam fact | 💡 Memory hook | 🔗 Connection

OUTPUT FORMAT (STRICT):
1. Return ONLY valid JSON
2. Use \\n for newlines in markdown
3. Use ONLY plain text - NO bold (**), NO italic (*)
4. Use proper indentation (2 spaces per level)

Return ONLY valid JSON (no markdown code blocks):
{
  "title": "Mind Map: ${subject}",
  "markdown": "# ${subject}\\n- 🏛️ Primary Branch 1\\n  - Secondary 1.1\\n    - 🎯 Specific fact from content\\n    - 💡 MEMORY: [mnemonic here]\\n  - Secondary 1.2\\n- 📜 Primary Branch 2\\n  - Secondary 2.1\\n    - Detail with date/name\\n  - Secondary 2.2"
}`;
  },

  infographic: (subject, topics, examType, sourceContent) => {
    const examName = examType === "sikkim-psc" ? "Sikkim PSC" : "UPSC";
    return `You are an expert ${examName} educator creating visual study aids.

TOPIC: ${subject} - ${topics.join(", ")}
EXAM TARGET: ${examName}

Study materials provided:
---
${sourceContent}
---

TASK: Extract SPECIFIC facts, events, and data from the content to create an infographic.

REQUIREMENTS:
1. KEY FACTS (8-12 items) - Each must be SPECIFIC from content:
   - Include: Person name + Action + Specific detail/number
   - Extract: WHO did WHAT with WHAT SPECIFIC detail
2. TIMELINE: Include specific events with actual dates (if available)
3. HIGHLIGHTS: Key exam-relevant takeaways with specific details

EMOJI MARKERS (use in keyFacts):
📜 History | 🏛️ Government | 💰 Economy | 🌍 Geography | 🔬 Science | 👥 Social
📊 Statistics | 🎯 High-priority exam fact

WHAT TO AVOID:
- Generic category labels like "Economic Development"
- Vague summaries without specific details
- Made-up statistics not in source

Return ONLY valid JSON (no markdown code blocks):
{
  "title": "Infographic: ${subject}",
  "keyFacts": [
    {"label": "🏛️ Specific Event Name", "value": "Who + What + Specific detail", "icon": "📌"},
    {"label": "💰 Policy/Act Name", "value": "Key provision with impact", "icon": "📋"},
    {"label": "🎯 Key Exam Fact", "value": "Memorable statistic", "icon": "⭐"}
  ],
  "highlights": ["🎯 Specific fact exam might ask", "Another memorable detail from content"]
}`;
  },

  pyq: (subject, topics, examType, sourceContent) => {
    // Get exam-specific configuration
    const examConfig = getExamConfig(examType);
    const isStatePSC = (examConfig as any).isStatePSC === true;
    const stateName = (examConfig as any).stateName || "State";

    // For state PSC exams, include both state-specific and UPSC questions
    const questionMixInstruction = isStatePSC
      ? `IMPORTANT - QUESTION MIX FOR STATE PSC:
Since this is for ${examConfig.examName}, include a MIX of questions from:
1. UPSC Civil Services PYQs (6-7 questions): These are highly relevant as state PSCs follow UPSC patterns
2. State PSC specific questions (4-5 questions): Include ${stateName}-specific questions where applicable (local history, geography, governance, current affairs)

For UPSC questions, use examReference like "UPSC CSE 2023 Prelims", "UPSC CSE 2022", etc.
For State PSC questions, use examReference like "Similar to ${examConfig.examName} Prelims 2022", "${examConfig.examName} Pattern", etc.`
      : `Generate questions following ${examConfig.examName} pattern.`;

    return `You are an expert question paper analyst with deep knowledge of previous year questions from ${examConfig.examFull}, UPSC Civil Services, and related exams like ${examConfig.referenceExams}.

TOPIC: ${subject} - ${topics.join(", ")}

Study context provided:
---
${sourceContent}
---

TASK: Generate 10-12 Previous Year Question (PYQ) style MCQs that are commonly asked in competitive examinations.

${questionMixInstruction}

QUESTION CHARACTERISTICS:
${examConfig.questionStyle}

QUESTION TYPES TO INCLUDE:
${examConfig.questionTypes}

DIFFICULTY DISTRIBUTION:
- 3-4 Easy: Direct facts frequently asked in exams
- 4-5 Medium: Conceptual questions requiring understanding
- 3-4 Hard: Multi-concept questions or less common facts

CRITICAL RULES:
1. Questions MUST be exam-style - direct, professional, no references to sources
2. Include exam reference where possible (e.g., "UPSC CSE 2023", "Similar to SPSC Prelims 2022" in examReference field)
3. NEVER reference "content", "passage", "video", or any source material
4. Each option MUST have detailed explanation for learning
5. Explanations should mention if this topic is frequently asked (high-yield)

EMOJI MARKERS:
${examConfig.emojiMarkers}

Return ONLY valid JSON (no markdown code blocks):
{
  "title": "PYQs: ${subject} - ${topics[0]}",
  "questions": [
    {
      "id": "1",
      "question": "Question text with appropriate emoji marker",
      "difficulty": "medium",
      "examReference": "UPSC CSE 2023 / Similar to ${examConfig.examName} Prelims",
      "options": [
        {"id": "a", "text": "Option A", "explanation": "Why correct/incorrect with detailed reasoning"},
        {"id": "b", "text": "Option B", "explanation": "Why correct/incorrect"},
        {"id": "c", "text": "Option C", "explanation": "Why correct/incorrect"},
        {"id": "d", "text": "Option D", "explanation": "Why correct/incorrect"}
      ],
      "correctOptionId": "a",
      "explanation": "Detailed explanation with exam relevance. HIGH-YIELD topic for ${examConfig.examName}.",
      "highYield": true
    }
  ]
}`;
  },
};

// Fallback prompts when no source content is provided (uses AI knowledge)
const FALLBACK_PROMPTS: Record<string, (subject: string, topics: string[], examType: string) => string> = {
  summary: (subject, topics, examType) => {
    const examName = examType === "sikkim-psc" ? "Sikkim PSC" : "UPSC";
    return `You are an expert ${examName} educator.

Create a comprehensive summary for: ${subject} - ${topics.join(", ")}

Include specific facts, names, dates, and exam-relevant details. Use emoji markers:
📜 History | 🏛️ Government | 💰 Economy | 🌍 Geography | 🔬 Science | 👥 Social | 🎯 Key fact

Return ONLY valid JSON:
{
  "title": "Summary: ${subject}",
  "keyPoints": ["🏛️ Point 1 with specific detail", "💰 Point 2..."],
  "examFacts": ["🎯 Fact 1", "Fact 2..."],
  "keyDates": [{"date": "Date", "event": "Event"}],
  "keyConcepts": [{"concept": "Name", "explanation": "Brief explanation"}]
}`;
  },

  flashcards: (subject, topics, examType) => {
    const examName = examType === "sikkim-psc" ? "Sikkim PSC" : "UPSC";
    return `Create 15 flashcards for ${examName} preparation on: ${subject} - ${topics.join(", ")}

Include difficulty levels (easy/medium/hard) and memory hints for harder cards.

Return ONLY valid JSON:
{
  "title": "Flashcards: ${subject}",
  "cards": [
    {"id": "1", "front": "📜 Question?", "back": "Answer with detail", "difficulty": "easy"},
    {"id": "2", "front": "🏛️ Question?", "back": "Answer", "difficulty": "medium", "hint": "Remember..."}
  ]
}`;
  },

  quiz: (subject, topics, examType) => {
    const examName = examType === "sikkim-psc" ? "Sikkim PSC" : "UPSC";
    return `Create 12-15 MCQ questions for ${examName} preparation on: ${subject} - ${topics.join(", ")}

CRITICAL RULES - STRICTLY FOLLOW:
1. Questions must be CLEAN and DIRECT - just the question text
2. NEVER use phrases like "According to...", "Based on...", "The passage/video states..."
3. NEVER reference "metadata", "content", "passage", "video", "channel", "source", or "description" in questions
4. Do NOT include difficulty labels IN the question text
5. Questions should read like REAL EXAM QUESTIONS - direct and professional
6. Write questions testing GENERAL KNOWLEDGE, not reading/video comprehension

WRONG: "According to the content, what is..." or "Based on the video..."
CORRECT: "What is the capital of Sikkim?" or "What are the features of Indus Valley Civilization?"

Include difficulty levels (easy/medium/hard) and DETAILED PER-OPTION EXPLANATIONS.
Each option MUST have an explanation field explaining why it's correct or incorrect.
Use emoji markers: 📜 History | 🏛️ Government | 💰 Economy | 🌍 Geography | 🔬 Science | 👥 Social

Return ONLY valid JSON:
{
  "title": "Quiz: ${subject}",
  "questions": [
    {
      "id": "1",
      "question": "🏛️ What is the primary function of the State Legislature?",
      "difficulty": "easy",
      "options": [
        {"id": "a", "text": "Making state laws", "explanation": "Correct! The State Legislature's primary function is to make laws on State and Concurrent List subjects."},
        {"id": "b", "text": "Appointing judges", "explanation": "Incorrect. Judges are appointed by the Governor on advice of the High Court."},
        {"id": "c", "text": "Conducting elections", "explanation": "Incorrect. Elections are conducted by the Election Commission."},
        {"id": "d", "text": "Foreign affairs", "explanation": "Incorrect. Foreign affairs are exclusively handled by the Central Government."}
      ],
      "correctOptionId": "a",
      "explanation": "The State Legislature makes laws for the state."
    }
  ]
}`;
  },

  mindmap: (subject, topics, examType) => {
    const examName = examType === "sikkim-psc" ? "Sikkim PSC" : "UPSC";
    return `Create a detailed mind map for ${examName} preparation on: ${subject} - ${topics.join(", ")}

Include 4-5 levels deep, emoji markers, and memory hooks (mnemonics).
Use: 📜 History | 🏛️ Government | 💰 Economy | 🎯 Key fact | 💡 Memory hook

Return ONLY valid JSON (use \\n for newlines):
{
  "title": "Mind Map: ${subject}",
  "markdown": "# ${subject}\\n- 🏛️ Branch 1\\n  - Sub-branch 1.1\\n    - 🎯 Key fact\\n    - 💡 MEMORY: [mnemonic]\\n  - Sub-branch 1.2\\n- 📜 Branch 2\\n  - Detail"
}`;
  },

  infographic: (subject, topics, examType) => {
    const examName = examType === "sikkim-psc" ? "Sikkim PSC" : "UPSC";
    return `Create infographic data for ${examName} preparation on: ${subject} - ${topics.join(", ")}

Include 8-12 specific facts with emoji markers and exam-relevant highlights.

Return ONLY valid JSON:
{
  "title": "Infographic: ${subject}",
  "keyFacts": [
    {"label": "🏛️ Category", "value": "Specific fact or statistic", "icon": "📌"},
    {"label": "🎯 Key Point", "value": "Important detail", "icon": "⭐"}
  ],
  "highlights": ["🎯 Key takeaway 1", "Key takeaway 2"]
}`;
  },

  pyq: (subject, topics, examType) => {
    // Get exam-specific configuration
    const examConfig = getExamConfig(examType);
    const isStatePSC = (examConfig as any).isStatePSC === true;
    const stateName = (examConfig as any).stateName || "State";

    // For state PSC exams, include both state-specific and UPSC questions
    const questionMixInstruction = isStatePSC
      ? `IMPORTANT - QUESTION MIX FOR STATE PSC:
Since this is for ${examConfig.examName}, include a MIX of questions from:
1. UPSC Civil Services PYQs (6-7 questions): These are highly relevant as state PSCs follow UPSC patterns
2. State PSC specific questions (4-5 questions): Include ${stateName}-specific questions where applicable (local history, geography, governance, current affairs)

For UPSC questions, use examReference like "UPSC CSE 2023 Prelims", "UPSC CSE 2022", etc.
For State PSC questions, use examReference like "Similar to ${examConfig.examName} Prelims 2022", "${examConfig.examName} Pattern", etc.`
      : `Generate questions following ${examConfig.examName} pattern.`;

    return `You are an expert question paper analyst with deep knowledge of previous year questions from ${examConfig.examFull}, UPSC Civil Services, and related exams like ${examConfig.referenceExams}.

Generate 10-12 Previous Year Question (PYQ) style MCQs on: ${subject} - ${topics.join(", ")}

${questionMixInstruction}

QUESTION CHARACTERISTICS:
${examConfig.questionStyle}

QUESTION TYPES TO INCLUDE:
${examConfig.questionTypes}

CRITICAL RULES:
1. Questions must be exam-style - direct, professional
2. Include exam reference where possible (e.g., "UPSC CSE 2023", "Similar to ${examConfig.examName} Prelims 2022")
3. Each option MUST have detailed explanation
4. Mark high-yield topics that are frequently asked

EMOJI MARKERS:
${examConfig.emojiMarkers}

Return ONLY valid JSON:
{
  "title": "PYQs: ${subject}",
  "questions": [
    {
      "id": "1",
      "question": "Question with appropriate emoji marker",
      "difficulty": "medium",
      "examReference": "UPSC CSE 2023 / Similar to ${examConfig.examName} Prelims",
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
  },
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { subject, topics, examType, generationType, sourceContent } = body;

    if (!subject || !topics || !generationType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Use source-based prompts when content is provided, otherwise use fallback
    let prompt: string;
    if (sourceContent && sourceContent.trim().length > 0) {
      const sourcePromptFn = SOURCE_BASED_PROMPTS[generationType];
      if (!sourcePromptFn) {
        return NextResponse.json(
          { error: "Invalid generation type" },
          { status: 400 }
        );
      }
      prompt = sourcePromptFn(subject, topics, examType || "upsc", sourceContent);
    } else {
      const fallbackPromptFn = FALLBACK_PROMPTS[generationType];
      if (!fallbackPromptFn) {
        return NextResponse.json(
          { error: "Invalid generation type" },
          { status: 400 }
        );
      }
      prompt = fallbackPromptFn(subject, topics, examType || "upsc");
    }

    const genAI = getGeminiClient();
    // PYQ needs more tokens for 10-12 questions with detailed explanations
    const maxTokens = generationType === "pyq" ? 16384 : 8192;

    // Use fallback mechanism for reliability
    const responseText = await generateWithFallback(genAI, prompt, maxTokens);

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
    } catch (parseError) {
      // Try to repair truncated JSON
      console.warn("Initial parse failed, attempting JSON repair...");
      try {
        const repairedText = repairTruncatedJSON(cleanedText);
        content = JSON.parse(repairedText);
        console.log("JSON repair successful");
      } catch (repairError) {
        console.error("Failed to parse:", cleanedText.slice(0, 200));

        // For PYQ type, return a friendly "not available" response instead of error
        if (generationType === "pyq") {
          const pyqExamConfig = getExamConfig(examType);
          return NextResponse.json({
            success: true,
            content: {
              title: `${pyqExamConfig.examName} PYQs: ${subject} - ${topics[0]}`,
              questions: [],
              notAvailable: true,
              message: `Previous year questions are not available for this topic. This topic may not be commonly tested in ${pyqExamConfig.examName} examinations, or it falls under skill-based/practical areas rather than factual knowledge.`
            },
            title: `${pyqExamConfig.examName} PYQs: ${subject} - ${topics[0]}`,
          });
        }

        return NextResponse.json(
          { error: "Failed to generate content. Please try again." },
          { status: 500 }
        );
      }
    }

    // Check if PYQ response has valid questions
    if (generationType === "pyq" && (!content.questions || content.questions.length === 0)) {
      const pyqExamConfig = getExamConfig(examType);
      content.notAvailable = true;
      content.message = `Previous year questions are not available for this topic. This topic may not be commonly tested in ${pyqExamConfig.examName} examinations.`;
    }

    return NextResponse.json({
      success: true,
      content,
      title: content.title || `${generationType}: ${subject}`,
    });
  } catch (error: unknown) {
    console.error("Generate topic content error:", error);

    // Extract more specific error message
    let errorMessage = "Failed to generate content. Please try again.";
    if (error instanceof Error) {
      console.error("Error details:", error.message, error.stack);
      if (error.message.includes("API_KEY")) {
        errorMessage = "AI service configuration error. Please contact support.";
      } else if (error.message.includes("quota") || error.message.includes("rate")) {
        errorMessage = "AI service is busy. Please try again in a moment.";
      } else if (error.message.includes("model")) {
        errorMessage = "AI model unavailable. Please try again.";
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
