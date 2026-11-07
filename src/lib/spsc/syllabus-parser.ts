import crypto from "crypto";

export type SyllabusParseStatus = "success" | "partial" | "failed";

export interface ParsedSyllabusMetadata {
  subjects: string[];
  topics: string[];
  totalMarks: number | null;
  paperCount: number | null;
  durationMinutes: number | null;
  negativeMarking: boolean | null;
  negativeMarkValue: number | null;
  qualificationHints: string[];
}

export interface ParsedSyllabusText {
  examTitle: string;
  status: SyllabusParseStatus;
  metadata: ParsedSyllabusMetadata;
  normalizedText: string;
  contentHash: string;
}

interface ParseInput {
  examTitle: string;
  text: string;
}

const SUBJECT_PATTERNS: Array<{ subject: string; patterns: RegExp[] }> = [
  { subject: "General English", patterns: [/\bgeneral english\b/i, /\benglish\b/i, /\bgrammar\b/i, /\bcomprehension\b/i] },
  { subject: "General Knowledge", patterns: [/\bgeneral knowledge\b/i, /\bgeneral awareness\b/i, /\bgk\b/i] },
  { subject: "Current Affairs", patterns: [/\bcurrent affairs?\b/i, /\bcurrent events?\b/i] },
  { subject: "Indian Polity", patterns: [/\bindian polity\b/i, /\bpolity\b/i, /\bconstitution\b/i] },
  { subject: "History", patterns: [/\bhistory\b/i, /\bfreedom movement\b/i] },
  { subject: "Geography", patterns: [/\bgeography\b/i, /\bclimate\b/i, /\brivers?\b/i, /\bmountains?\b/i] },
  { subject: "Indian Economy", patterns: [/\bindian economy\b/i, /\beconomy\b/i, /\bbudget\b/i, /\bfiscal\b/i] },
  { subject: "Science", patterns: [/\bgeneral science\b/i, /\bscience\b/i, /\bphysics\b/i, /\bchemistry\b/i, /\bbiology\b/i] },
  { subject: "Arithmetic and Logical Reasoning", patterns: [/\barithmetic\b/i, /\baptitude\b/i, /\breasoning\b/i, /\blogical\b/i] },
  { subject: "Environment", patterns: [/\benvironment\b/i, /\becology\b/i, /\bforests?\b/i, /\bwildlife\b/i] },
  { subject: "Civil Engineering", patterns: [/\bcivil engineering\b/i, /\bstructural analysis\b/i, /\bsurveying\b/i, /\bfluid mechanics\b/i] },
  { subject: "Mechanical Engineering", patterns: [/\bmechanical engineering\b/i, /\bthermodynamics\b/i, /\bmanufacturing\b/i] },
  { subject: "Electrical Engineering", patterns: [/\belectrical engineering\b/i, /\bpower systems?\b/i, /\bcircuit\b/i] },
  { subject: "Sikkim", patterns: [/\bsikkim\b/i] },
];

const TOPIC_PATTERNS: Array<{ topic: string; pattern: RegExp }> = [
  { topic: "comprehension", pattern: /\bcomprehension\b/i },
  { topic: "grammar", pattern: /\bgrammar\b/i },
  { topic: "vocabulary", pattern: /\bvocabulary\b/i },
  { topic: "sentence correction", pattern: /\bsentence correction\b/i },
  { topic: "Sikkim", pattern: /\bsikkim\b/i },
  { topic: "surveying", pattern: /\bsurveying\b/i },
  { topic: "RCC design", pattern: /\brcc design\b/i },
  { topic: "fluid mechanics", pattern: /\bfluid mechanics\b/i },
  { topic: "highway engineering", pattern: /\bhighway engineering\b/i },
  { topic: "strength of materials", pattern: /\bstrength of materials\b/i },
  { topic: "structural analysis", pattern: /\bstructural analysis\b/i },
  { topic: "environmental engineering", pattern: /\benvironmental engineering\b/i },
  { topic: "estimation and costing", pattern: /\bestimation and costing\b/i },
];

export function normalizeSyllabusText(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([,.:;])/g, "$1")
    .trim();
}

function uniquePush(items: string[], value: string) {
  if (!items.includes(value)) {
    items.push(value);
  }
}

function extractPaperCount(text: string): number | null {
  const paperLabels = new Set(
    Array.from(text.matchAll(/\bpaper(?:\s*[-–:]?\s*|\s+)([ivx]+|\d+)\b/gi)).map((match) =>
      match[1].toUpperCase()
    )
  );
  if (paperLabels.size > 0) {
    return paperLabels.size;
  }

  const spelled = text.match(/\b(one|two|three|four|five)\s+papers?\b/i);
  if (!spelled) return null;

  const numberMap: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
  };
  return numberMap[spelled[1].toLowerCase()] ?? null;
}

function extractTotalMarks(text: string): number | null {
  const explicitTotal = text.match(/\btotal marks?\s*[:\-]?\s*(\d{2,4})\b/i);
  if (explicitTotal) {
    return Number.parseInt(explicitTotal[1], 10);
  }

  const onePaperMarks = text.match(/\bone paper of\s+(\d{2,4})\s+marks?\b/i);
  if (onePaperMarks) {
    return Number.parseInt(onePaperMarks[1], 10);
  }

  return null;
}

function extractDurationMinutes(text: string): number | null {
  const hourMatches = Array.from(text.matchAll(/\b(\d+(?:\.\d+)?)\s*hours?\b/gi));
  if (hourMatches.length > 0) {
    const maxHours = Math.max(...hourMatches.map((match) => Number.parseFloat(match[1])));
    return Math.round(maxHours * 60);
  }

  const minuteMatches = Array.from(text.matchAll(/\b(\d{2,3})\s*minutes?\b/gi));
  if (minuteMatches.length > 0) {
    return Math.max(...minuteMatches.map((match) => Number.parseInt(match[1], 10)));
  }

  return null;
}

function extractNegativeMarking(text: string): Pick<ParsedSyllabusMetadata, "negativeMarking" | "negativeMarkValue"> {
  const lowered = text.toLowerCase();
  if (!lowered.includes("negative")) {
    return { negativeMarking: null, negativeMarkValue: null };
  }

  const markValueMatch = text.match(/negative marking(?: of)?\s*(\d+(?:\.\d+)?)\s*marks?/i);
  if (markValueMatch) {
    return {
      negativeMarking: true,
      negativeMarkValue: Number.parseFloat(markValueMatch[1]),
    };
  }

  const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*negative marking/i);
  if (percentMatch) {
    return {
      negativeMarking: true,
      negativeMarkValue: Number.parseFloat(percentMatch[1]) / 100,
    };
  }

  const fractionalMatch = text.match(/\b1\/4(?:th)?\s+negative marking\b/i);
  if (fractionalMatch) {
    return {
      negativeMarking: true,
      negativeMarkValue: 0.25,
    };
  }

  return { negativeMarking: true, negativeMarkValue: null };
}

function extractQualificationHints(text: string): string[] {
  const hints: string[] = [];
  const patterns = [
    /\bminimum educational qualification\s*[:\-]?\s*([^\n.]+)/gi,
    /\beligibility\s*[:\-]?\s*([^\n.]+)/gi,
    /\bcandidates? must have\s*([^\n.]+)/gi,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[1]?.trim();
      if (value) {
        uniquePush(hints, value);
      }
    }
  }

  return hints;
}

function extractSubjects(text: string, examTitle: string): string[] {
  const subjects: string[] = [];
  const corpus = `${examTitle}\n${text}`;

  for (const entry of SUBJECT_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(corpus))) {
      uniquePush(subjects, entry.subject);
    }
  }

  return subjects;
}

function extractTopics(text: string): string[] {
  const topics: string[] = [];
  for (const entry of TOPIC_PATTERNS) {
    if (entry.pattern.test(text)) {
      uniquePush(topics, entry.topic);
    }
  }
  return topics;
}

function computeStatus(metadata: ParsedSyllabusMetadata): SyllabusParseStatus {
  let score = 0;

  if (metadata.subjects.length >= 2) score += 2;
  else if (metadata.subjects.length === 1) score += 1;
  if (metadata.topics.length >= 2) score += 1;
  if (metadata.totalMarks !== null) score += 1;
  if (metadata.paperCount !== null) score += 1;
  if (metadata.durationMinutes !== null) score += 1;
  if (metadata.negativeMarking !== null) score += 1;
  if (metadata.qualificationHints.length > 0) score += 1;

  if (score >= 5) return "success";
  if (score >= 2) return "partial";
  return "failed";
}

export function parseSyllabusText({ examTitle, text }: ParseInput): ParsedSyllabusText {
  const normalizedText = normalizeSyllabusText(text);
  const negativeMarking = extractNegativeMarking(normalizedText);

  const metadata: ParsedSyllabusMetadata = {
    subjects: extractSubjects(normalizedText, examTitle),
    topics: extractTopics(normalizedText),
    totalMarks: extractTotalMarks(normalizedText),
    paperCount: extractPaperCount(normalizedText),
    durationMinutes: extractDurationMinutes(normalizedText),
    negativeMarking: negativeMarking.negativeMarking,
    negativeMarkValue: negativeMarking.negativeMarkValue,
    qualificationHints: extractQualificationHints(normalizedText),
  };

  return {
    examTitle,
    status: computeStatus(metadata),
    metadata,
    normalizedText,
    contentHash: crypto.createHash("sha256").update(normalizedText).digest("hex"),
  };
}
