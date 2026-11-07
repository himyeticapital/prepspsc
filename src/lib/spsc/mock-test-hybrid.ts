export interface HybridQuestionOption {
  id: string;
  text: string;
}

export interface HybridQuestion {
  question: string;
  options: HybridQuestionOption[];
  correct_option_id: string;
  explanation: string | null;
  difficulty: "easy" | "medium" | "hard";
  subject: string;
  source_type: "pyq_reused" | "ai_generated_from_pyq";
}

interface RawGeneratedQuestion {
  question?: string;
  options?: Array<{ id?: string; text?: string } | string>;
  correct_option_id?: string;
  explanation?: string | null;
  difficulty?: string;
  subject?: string;
}

const OPTION_IDS = ["a", "b", "c", "d"] as const;

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksDistinct(options: HybridQuestionOption[]): boolean {
  const normalized = options.map((option) => normalizeText(option.text));
  return new Set(normalized).size === normalized.length;
}

export function isHighQualityOptionSet(options: HybridQuestionOption[]): boolean {
  if (options.length !== 4) return false;
  if (!looksDistinct(options)) return false;

  return options.every((option) => {
    const normalized = normalizeText(option.text);
    return normalized.length >= 4 && !["all of the above", "none of the above", "both a and b"].includes(normalized);
  });
}

export function normalizeGeneratedQuestions(
  rawQuestions: RawGeneratedQuestion[],
  defaultSubject: string
): HybridQuestion[] {
  const normalized: HybridQuestion[] = [];

  for (const raw of rawQuestions) {
    const question = raw.question?.trim();
    if (!question) continue;

    const options = (raw.options || [])
      .map((option, index) => {
        if (typeof option === "string") {
          return { id: OPTION_IDS[index] || "a", text: option.trim() };
        }
        return {
          id: (option.id || OPTION_IDS[index] || "a").toLowerCase(),
          text: (option.text || "").trim(),
        };
      })
      .filter((option) => option.text);

    if (options.length !== 4) continue;
    if (!isHighQualityOptionSet(options)) continue;

    const correctId = (raw.correct_option_id || "").toLowerCase();
    if (!options.some((option) => option.id === correctId)) continue;

    normalized.push({
      question,
      options,
      correct_option_id: correctId,
      explanation: raw.explanation?.trim() || null,
      difficulty: raw.difficulty === "easy" || raw.difficulty === "hard" ? raw.difficulty : "medium",
      subject: raw.subject?.trim() || defaultSubject,
      source_type: "ai_generated_from_pyq",
    });
  }

  return normalized;
}

export function rebalanceCorrectAnswerDistribution<T extends {
  options: HybridQuestionOption[];
  correct_option_id: string;
}>(questions: T[]): T[] {
  return questions.map((question, index) => {
    const correctOption = question.options.find((option) => option.id === question.correct_option_id);
    if (!correctOption) return question;

    const targetCorrectId = OPTION_IDS[index % OPTION_IDS.length];
    const distractors = question.options.filter((option) => option.id !== question.correct_option_id);
    const reordered = [...distractors];
    reordered.splice(indexOfOptionId(targetCorrectId), 0, {
      id: targetCorrectId,
      text: correctOption.text,
    });

    const normalizedOptions = reordered.slice(0, 4).map((option, optionIndex) => ({
      id: OPTION_IDS[optionIndex],
      text: option.text,
    }));

    const updatedCorrect = normalizedOptions.find((option) => option.text === correctOption.text)?.id || targetCorrectId;

    return {
      ...question,
      options: normalizedOptions,
      correct_option_id: updatedCorrect,
    };
  });
}

function indexOfOptionId(id: string): number {
  const index = OPTION_IDS.indexOf(id as (typeof OPTION_IDS)[number]);
  return index === -1 ? 0 : index;
}
