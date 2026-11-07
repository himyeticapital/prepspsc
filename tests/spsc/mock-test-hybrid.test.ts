import { describe, expect, it } from "vitest";

import {
  isHighQualityOptionSet,
  normalizeGeneratedQuestions,
  rebalanceCorrectAnswerDistribution,
  type HybridQuestion,
} from "@/lib/spsc/mock-test-hybrid";

describe("mock-test hybrid helpers", () => {
  it("rebalances correct answers so they do not collapse to one option id", () => {
    const questions: HybridQuestion[] = Array.from({ length: 8 }, (_, index) => ({
      question: `Question ${index + 1}`,
      options: [
        { id: "a", text: `Correct ${index}` },
        { id: "b", text: `Distractor B ${index}` },
        { id: "c", text: `Distractor C ${index}` },
        { id: "d", text: `Distractor D ${index}` },
      ],
      correct_option_id: "a",
      explanation: null,
      difficulty: "medium",
      subject: "General Knowledge",
      source_type: "ai_generated_from_pyq",
    }));

    const rebalanced = rebalanceCorrectAnswerDistribution(questions);
    const distribution = rebalanced.reduce<Record<string, number>>((acc, question) => {
      acc[question.correct_option_id] = (acc[question.correct_option_id] || 0) + 1;
      return acc;
    }, {});

    expect(Object.keys(distribution).sort()).toEqual(["a", "b", "c", "d"]);
    expect(Math.max(...Object.values(distribution)) - Math.min(...Object.values(distribution))).toBeLessThanOrEqual(1);
  });

  it("rejects low-quality option sets with duplicate or giveaway distractors", () => {
    expect(
      isHighQualityOptionSet([
        { id: "a", text: "1861" },
        { id: "b", text: "1861" },
        { id: "c", text: "All of the above" },
        { id: "d", text: "None of the above" },
      ])
    ).toBe(false);
  });

  it("normalizes only well-formed generated questions", () => {
    const normalized = normalizeGeneratedQuestions(
      [
        {
          question: "Which body audits the accounts of the Union and the States?",
          options: [
            { id: "a", text: "Comptroller and Auditor General of India" },
            { id: "b", text: "Finance Commission of India" },
            { id: "c", text: "Union Public Service Commission" },
            { id: "d", text: "Election Commission of India" },
          ],
          correct_option_id: "a",
          explanation: "The CAG audits Union and State accounts.",
          difficulty: "medium",
          subject: "Indian Polity",
        },
        {
          question: "Bad question",
          options: [
            { id: "a", text: "Same" },
            { id: "b", text: "Same" },
            { id: "c", text: "Same" },
            { id: "d", text: "Same" },
          ],
          correct_option_id: "a",
        },
      ],
      "Indian Polity"
    );

    expect(normalized).toHaveLength(1);
    expect(normalized[0].source_type).toBe("ai_generated_from_pyq");
    expect(normalized[0].subject).toBe("Indian Polity");
  });
});
