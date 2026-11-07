export interface ExamOption {
  value: string;
  label: string;
  category: "state-psc" | "central" | "defense" | "entrance" | "other";
}

export const EXAM_CATEGORIES = [
  { key: "state-psc" as const, label: "State PSC" },
  { key: "central" as const, label: "Central Govt" },
  { key: "defense" as const, label: "Defense" },
  { key: "entrance" as const, label: "Entrance Exams" },
  { key: "other" as const, label: "Other" },
];

export const PREDEFINED_EXAMS: ExamOption[] = [
  // State PSC
  { value: "sikkim-psc", label: "Sikkim PSC (SPSC)", category: "state-psc" },
  // Central Govt
  { value: "upsc-prelims", label: "UPSC Prelims", category: "central" },
  { value: "upsc-mains", label: "UPSC Mains", category: "central" },
  { value: "ssc-cgl", label: "SSC CGL", category: "central" },
  { value: "ssc-chsl", label: "SSC CHSL", category: "central" },
  // Defense
  { value: "ssb", label: "SSB Interview", category: "defense" },
  { value: "cds", label: "CDS", category: "defense" },
  { value: "nda", label: "NDA", category: "defense" },
  { value: "afcat", label: "AFCAT", category: "defense" },
  // Entrance
  { value: "neet", label: "NEET", category: "entrance" },
  { value: "jee-main", label: "JEE Main", category: "entrance" },
  { value: "jee-advanced", label: "JEE Advanced", category: "entrance" },
  { value: "gate", label: "GATE", category: "entrance" },
  // Other
  { value: "banking", label: "Banking (IBPS/SBI)", category: "other" },
  { value: "rrb", label: "RRB (Railways)", category: "other" },
];

const examLabelMap = new Map(PREDEFINED_EXAMS.map((e) => [e.value, e.label]));

/** Maps an exam slug to its display label. Falls back to title-casing the slug. */
export function getExamLabel(slug: string): string {
  const predefined = examLabelMap.get(slug);
  if (predefined) return predefined;
  // Title-case custom entries: "my-custom-exam" → "My Custom Exam"
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Normalizes a custom exam input to a slug: "My Exam" → "my-exam" */
export function toExamSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}
