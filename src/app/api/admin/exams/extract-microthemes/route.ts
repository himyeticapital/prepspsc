import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120; // Allow up to 2 minutes for AI processing

// Initialize Gemini
function getGeminiModel() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_NOT_CONFIGURED");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: "gemini-3-flash-preview",
    generationConfig: {
      temperature: 0.3, // Lower temperature for structured output
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
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || "";

      const isRateLimit =
        error?.status === 429 ||
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { examId } = body;

    if (!examId) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 });
    }

    // Fetch exam with all uploads
    const { data: exam, error: examError } = await supabase
      .from("admin_exams")
      .select(`
        *,
        admin_exam_uploads(*)
      `)
      .eq("id", examId)
      .single();

    if (examError || !exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    // Get syllabus content
    const syllabusContent = exam.syllabus_content || "";

    // Get PYQ content from all uploads
    const pyqUploads = (exam.admin_exam_uploads || []).filter(
      (u: any) => u.upload_type === "pyq" && u.parsed_content
    );
    const pyqContent = pyqUploads
      .map((u: any) => `\n--- PYQ ${u.year || "Unknown Year"} ---\n${u.parsed_content}`)
      .join("\n\n");

    // Check if we have content to analyze
    if (!syllabusContent && !pyqContent) {
      return NextResponse.json(
        { error: "No content available. Please upload syllabus or PYQ documents first." },
        { status: 400 }
      );
    }

    console.log(`[Microtheme Extraction] Content lengths - Syllabus: ${syllabusContent.length} chars, PYQ: ${pyqContent.length} chars`);

    // Determine the source of microthemes
    const hasPYQs = pyqUploads.length > 0;
    const microthemesSource: "pyq_analysis" | "syllabus_estimation" = hasPYQs ? "pyq_analysis" : "syllabus_estimation";

    const model = getGeminiModel();

    // Detect exam type from exam name for better context
    // Replace underscores/dashes with spaces for better word matching
    const examNameLower = exam.name.toLowerCase().replace(/[_-]/g, " ");
    console.log(`[Microtheme Extraction] Exam name: "${exam.name}" → normalized: "${examNameLower}"`);

    // Engineering exams (JE, AE, GATE, etc.) - NOT JEE entrance
    const isEngineeringExam = /(^|\s)(je|junior engineer|ae|assistant engineer|gate|civil|mechanical|electrical|electronics|computer|ece|eee|cse|it)(\s|$)/i.test(examNameLower) &&
      !/(jee|joint entrance)/i.test(examNameLower);

    // JEE (Mains & Advanced) - separate from engineering job exams
    const isJEEExam = /(jee|joint entrance|iit|nit)/i.test(examNameLower);

    // Medical entrance (NEET, AIIMS, JIPMER)
    const isNEETExam = /(neet|aiims|jipmer|medical entrance|mbbs entrance)/i.test(examNameLower);

    // Medical professional exams
    const isMedicalProfessionalExam = /(mbbs|nursing|pharmacy|dental|bds|md|ms|anatomy|physiology|fmge|next)/i.test(examNameLower) &&
      !/(neet|entrance)/i.test(examNameLower);

    // Board exams (Class 10, 12, CBSE, ICSE, State Boards)
    const isBoardExam = /(class\s*10|class\s*12|cbse|icse|isc|board|ssc|hsc|10th|12th|secondary|higher secondary|matriculation)/i.test(examNameLower);

    // SAT exam
    const isSATExam = /(sat|scholastic|college board)/i.test(examNameLower);

    // GRE/GMAT exams
    const isGREExam = /(gre|gmat|graduate record|management admission)/i.test(examNameLower);

    // General studies/PSC exams - check last to avoid matching SSC JE as PSC
    const isGeneralStudiesExam = !isEngineeringExam && /(spsc|psc|upsc|ias|ips|prelims|mains|gs|general studies|current affairs|polity)/i.test(examNameLower);

    console.log(`[Microtheme Extraction] Detected: Engineering=${isEngineeringExam}, JEE=${isJEEExam}, NEET=${isNEETExam}, Board=${isBoardExam}, PSC=${isGeneralStudiesExam}`);

    // Construct the analysis prompt - different for syllabus-only vs with PYQs
    const sourceNote = hasPYQs
      ? "Analyze the PYQs to calculate ACTUAL question frequencies and importance levels."
      : `IMPORTANT: No PYQ data available. ESTIMATE pyqFrequency based on:
- Syllabus weightage (topics with more detail = higher frequency)
- Standard exam patterns for this type of exam
- Mark as estimated: Use reasonable estimates (8-15 for high priority, 4-8 for medium, 1-4 for low)`;

    // Dynamic prompt based on exam type
    let examTypeGuidance = "";

    if (isJEEExam) {
      examTypeGuidance = `
EXAM TYPE DETECTED: JEE (MAINS/ADVANCED) - ENGINEERING ENTRANCE

This is an engineering entrance exam. Extract microthemes for Physics, Chemistry, and Mathematics.

PHYSICS subjects to cover:
- Mechanics (Kinematics, Laws of Motion, Work-Energy-Power, Rotational Motion, Gravitation)
- Thermodynamics & Kinetic Theory
- Waves & Oscillations
- Electrostatics & Current Electricity
- Magnetism & EMI
- Optics (Ray & Wave)
- Modern Physics (Atomic, Nuclear, Semiconductors)

CHEMISTRY subjects to cover:
- Physical Chemistry (Mole Concept, Thermodynamics, Equilibrium, Electrochemistry, Kinetics)
- Inorganic Chemistry (Periodic Table, Chemical Bonding, Coordination Compounds, Metallurgy)
- Organic Chemistry (GOC, Hydrocarbons, Functional Groups, Biomolecules, Polymers)

MATHEMATICS subjects to cover:
- Algebra (Complex Numbers, Quadratics, Sequences, Permutations, Binomial)
- Calculus (Limits, Differentiation, Integration, Differential Equations)
- Coordinate Geometry (Straight Lines, Circles, Conics)
- Vectors & 3D Geometry
- Trigonometry
- Probability & Statistics

For JEE subtopics, include:
- Key formulas (e.g., "v = u + at", "E = hν", "∫x^n dx = x^(n+1)/(n+1)")
- Important values (e.g., "g = 9.8 m/s²", "R = 8.314 J/mol·K")
- Reaction mechanisms and named reactions
- Problem-solving shortcuts and patterns`;
    } else if (isNEETExam) {
      examTypeGuidance = `
EXAM TYPE DETECTED: NEET - MEDICAL ENTRANCE

This is a medical entrance exam. Extract microthemes for Physics, Chemistry, and Biology (Botany + Zoology).

PHYSICS (45 questions):
- Mechanics, Thermodynamics, Waves
- Electrostatics, Current Electricity, Magnetism
- Optics, Modern Physics, Semiconductors

CHEMISTRY (45 questions):
- Physical Chemistry (Solutions, Electrochemistry, Chemical Kinetics, Surface Chemistry)
- Inorganic Chemistry (p-Block, d-Block, Coordination Compounds)
- Organic Chemistry (Hydrocarbons, Haloalkanes, Alcohols, Aldehydes, Amines, Biomolecules)

BIOLOGY (90 questions - most important):
- Botany: Plant Physiology, Plant Anatomy, Genetics, Ecology, Cell Biology
- Zoology: Human Physiology, Animal Kingdom, Reproduction, Evolution, Biotechnology

For NEET subtopics, include:
- NCERT-specific facts and diagrams
- Important biological values (e.g., "Normal BP: 120/80 mmHg", "RBC count: 5 million/mm³")
- Named reactions in Chemistry
- Diseases, disorders, and their causes
- Scientific names of organisms`;
    } else if (isBoardExam) {
      examTypeGuidance = `
EXAM TYPE DETECTED: BOARD EXAM (Class 10/12)

Extract microthemes based on NCERT syllabus structure.

For CLASS 10 typically:
- Mathematics (Number Systems, Algebra, Geometry, Trigonometry, Statistics)
- Science (Physics, Chemistry, Biology combined)
- Social Science (History, Geography, Civics, Economics)
- English/Hindi Language

For CLASS 12 typically:
- Physics, Chemistry, Mathematics/Biology (separate subjects)
- English/Hindi
- Optional subjects based on stream

For board exam subtopics, include:
- Chapter-wise important topics from NCERT
- Formulas and derivations commonly asked
- Important dates, events, and definitions
- Diagram-based questions
- Case study and competency-based question patterns
- Previous year repeated topics`;
    } else if (isSATExam) {
      examTypeGuidance = `
EXAM TYPE DETECTED: SAT (Scholastic Assessment Test)

Extract microthemes for the SAT sections:

READING & WRITING:
- Reading Comprehension (Literature, History/Social Studies, Science passages)
- Words in Context
- Command of Evidence
- Expression of Ideas
- Standard English Conventions (Grammar, Punctuation)

MATH (Calculator & No-Calculator):
- Heart of Algebra (Linear equations, inequalities, systems)
- Problem Solving & Data Analysis (Ratios, percentages, statistics)
- Passport to Advanced Math (Quadratics, polynomials, exponentials)
- Additional Topics (Geometry, trigonometry, complex numbers)

For SAT subtopics, include:
- Common question patterns and traps
- Key grammar rules (subject-verb agreement, parallelism, etc.)
- Math formulas provided vs. must-know
- Time management strategies per section
- Score-improving tips`;
    } else if (isGREExam) {
      examTypeGuidance = `
EXAM TYPE DETECTED: GRE (Graduate Record Examination)

Extract microthemes for GRE sections:

VERBAL REASONING:
- Text Completion (1-3 blanks)
- Sentence Equivalence
- Reading Comprehension (Short & Long passages)
- Vocabulary (High-frequency GRE words)
- Critical Reasoning

QUANTITATIVE REASONING:
- Arithmetic (Number properties, Ratios, Percentages)
- Algebra (Equations, Inequalities, Functions)
- Geometry (Lines, Angles, Triangles, Circles, Coordinate Geometry)
- Data Analysis (Statistics, Probability, Data Interpretation)
- Quantitative Comparison questions

ANALYTICAL WRITING:
- Issue Essay (Analyze an issue)
- Argument Essay (Analyze an argument)

For GRE subtopics, include:
- High-frequency vocabulary words with meanings
- Math shortcuts and number properties
- Common logical fallacies for AWA
- Question patterns and strategies
- Time management per question type`;
    } else if (isEngineeringExam) {
      examTypeGuidance = `
EXAM TYPE DETECTED: ENGINEERING/TECHNICAL EXAM (JE/AE/GATE)

Extract microthemes based on ACTUAL subjects found in the syllabus. Common engineering subjects include:
- For Civil: Structural Analysis, Geotechnical Engineering, Fluid Mechanics, Building Materials, Surveying, Transportation Engineering, Environmental Engineering, Concrete Technology, Steel Structures, Estimating & Costing
- For Mechanical: Thermodynamics, Fluid Mechanics, Strength of Materials, Machine Design, Manufacturing Processes, Heat Transfer, IC Engines, Refrigeration & AC, Industrial Engineering
- For Electrical: Circuit Theory, Electrical Machines, Power Systems, Control Systems, Power Electronics, Electrical Measurements, Digital Electronics
- For Electronics/ECE: Analog Circuits, Digital Circuits, Microprocessors, Communication Systems, Signal Processing, VLSI, Embedded Systems

IMPORTANT: Extract subjects DIRECTLY from the syllabus. Do NOT use generic competitive exam subjects like "Indian Polity" or "Ethics" unless they are explicitly in the syllabus.

For engineering subtopics, include:
- Formulas (e.g., "Bending stress σ = My/I")
- Standard values (e.g., "Steel yield strength fy = 250 MPa for Fe250")
- Design codes (e.g., "IS 456:2000 for RCC design")
- Key concepts (e.g., "Mohr's circle for stress analysis")
- Important theorems (e.g., "Castigliano's theorem", "Maxwell's reciprocal theorem")`;
    } else if (isMedicalProfessionalExam) {
      examTypeGuidance = `
EXAM TYPE DETECTED: MEDICAL/HEALTHCARE PROFESSIONAL EXAM

Extract microthemes based on ACTUAL subjects found in the syllabus. Common medical subjects include:
- Pre-clinical: Anatomy, Physiology, Biochemistry, Histology, Embryology
- Para-clinical: Pathology, Pharmacology, Microbiology, Forensic Medicine
- Clinical: Medicine, Surgery, OBG, Pediatrics, ENT, Ophthalmology, Dermatology, Psychiatry, Orthopedics
- For Nursing: Fundamentals, Medical-Surgical, Pediatric, Psychiatric, Community Health
- For Pharmacy: Pharmaceutics, Pharmacology, Pharmacognosy, Pharmaceutical Chemistry

IMPORTANT: Extract subjects DIRECTLY from the syllabus. Do NOT use generic competitive exam subjects.

For medical subtopics, include:
- Drug names and dosages (e.g., "Adrenaline 0.5mg IM for anaphylaxis")
- Normal values (e.g., "Normal BP: 120/80 mmHg", "HbA1c normal: <5.7%")
- Diagnostic criteria (e.g., "Duke's criteria for Infective Endocarditis")
- Key syndromes (e.g., "Down syndrome - Trisomy 21")
- Important mnemonics (e.g., "VITAMIN D for hypercalcemia causes")`;
    } else if (isGeneralStudiesExam) {
      examTypeGuidance = `
EXAM TYPE DETECTED: GENERAL STUDIES / ADMINISTRATIVE EXAM (PSC/UPSC TYPE)

Create microthemes covering standard administrative exam subjects:
- Current Affairs (National & International)
- Indian History & National Movement
- Indian Polity & Constitution
- Indian Economy & Social Development
- General Science (Physics, Chemistry, Biology)
- Geography (Indian & World)
- Ethics, Integrity & Decision Making
- Logical Reasoning & Mental Ability
- Quantitative Aptitude
- English Language / Regional Language

For general studies subtopics, include:
- Article numbers (e.g., "Article 32 - Right to Constitutional Remedies")
- Important dates and years (e.g., "Quit India Movement - 1942")
- Government schemes with launch dates
- Constitutional provisions and amendments`;
    } else {
      examTypeGuidance = `
EXAM TYPE: ANALYZE FROM SYLLABUS CONTENT

The exam type could not be determined from the name. Analyze the syllabus content carefully and:
1. Identify the domain (Engineering, Medical, Commerce, Law, General Studies, Board Exam, Entrance Exam, etc.)
2. Extract ALL major subjects mentioned in the syllabus
3. Create microthemes that accurately reflect the syllabus structure

Common exam types to consider:
- Board Exams: Focus on NCERT chapters, diagrams, derivations
- Entrance Exams: Focus on problem-solving, shortcuts, high-yield topics
- Professional Exams: Focus on practical applications, case studies
- Competitive Exams: Focus on current affairs, reasoning, aptitude

Do NOT force generic subjects - extract what is actually in the syllabus.`;
    }

    const prompt = `You are an expert exam preparation analyst. Analyze the following exam syllabus${hasPYQs ? " and previous year questions (PYQs)" : ""} to extract detailed microthemes for study planning.

${sourceNote}

${examTypeGuidance}

EXAM NAME: ${exam.name}

${syllabusContent ? `SYLLABUS CONTENT:\n${syllabusContent}\n` : ""}
${pyqContent ? `PREVIOUS YEAR QUESTIONS:\n${pyqContent}\n` : ""}

TASK: Extract structured microthemes DIRECTLY FROM THE SYLLABUS CONTENT.

CRITICAL RULES:
1. Extract 8-20 microthemes based on the ACTUAL syllabus structure (not a fixed number)
2. Each microtheme should represent a major subject/unit from the syllabus
3. DO NOT invent subjects that are not in the syllabus
4. DO NOT use generic PSC subjects if this is an engineering/medical exam
5. Subjects should be named exactly as they appear in the syllabus

For EACH microtheme, extract:
- subject: The main subject/unit name from syllabus
- topics: 4-8 main chapters or sub-areas within this subject
- subtopics: 8-20 SPECIFIC testable items including:
  * Formulas with variables explained
  * Standard values and constants
  * Key theorems/principles
  * Important definitions
  * Numerical types frequently asked
  * Design codes/standards if applicable
- pyqFrequency: Question count from PYQs (or estimate from syllabus weightage)
- importance: "high" (8+ questions), "medium" (4-7), "low" (<4)

OUTPUT FORMAT (STRICT JSON):
{
  "microthemes": [
    {
      "subject": "[Subject name from syllabus]",
      "topics": [
        "Topic 1",
        "Topic 2",
        "Topic 3"
      ],
      "subtopics": [
        "Specific concept with formula/value",
        "Key definition or theorem",
        "Important numerical type",
        "Standard code reference"
      ],
      "pyqFrequency": 10,
      "importance": "high"
    }
  ],
  "examPattern": {
    "totalSubjects": "[count]",
    "highPrioritySubjects": ["Subject 1", "Subject 2"],
    "recommendedFocus": "Key preparation strategy based on analysis"
  },
  "examType": "jee|neet|board_exam|sat|gre|engineering|medical|general_studies|other"
}

SUBTOPIC QUALITY GUIDELINES:
- Be SPECIFIC, not generic (❌ "Fluid properties" → ✅ "Viscosity: μ = τ/(du/dy), units: Pa·s or Poise")
- Include NUMBERS and FORMULAS (❌ "Mohr's circle" → ✅ "Mohr's circle: radius = (σ1-σ2)/2, center = (σ1+σ2)/2")
- Reference STANDARDS (❌ "RCC design" → ✅ "IS 456:2000 - minimum cover for mild exposure = 20mm")
- List COMMON NUMERICAL TYPES (e.g., "Find discharge using Manning's equation: Q = (1/n)AR^(2/3)S^(1/2)")

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
      console.log(`[Microtheme Extraction] Successfully parsed ${extractedData.microthemes?.length || 0} microthemes`);
    } catch (parseError) {
      console.error("[Microtheme Extraction] Failed to parse JSON:", parseError);
      console.error("[Microtheme Extraction] Response preview:", cleanedText.slice(0, 1000));
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

    // Update the exam with extracted microthemes and source
    const { error: updateError } = await supabase
      .from("admin_exams")
      .update({
        microthemes: extractedData.microthemes,
        microthemes_source: microthemesSource,
      })
      .eq("id", examId);

    if (updateError) {
      console.error("Failed to save microthemes:", updateError);
      return NextResponse.json(
        { error: "Failed to save microthemes" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      microthemes: extractedData.microthemes,
      examPattern: extractedData.examPattern || null,
      totalMicrothemes: extractedData.microthemes.length,
      source: microthemesSource,
      hasPYQs,
    });
  } catch (error: any) {
    console.error("Microtheme extraction error:", error);

    // Handle rate limit errors
    if (error?.status === 429 || error?.message?.includes("429")) {
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
