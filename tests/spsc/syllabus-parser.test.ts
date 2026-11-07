import { describe, expect, it } from "vitest";

import { parseSyllabusText } from "@/lib/spsc/syllabus-parser";

describe("parseSyllabusText", () => {
  it("extracts structured syllabus metadata from an under secretary style syllabus", () => {
    const text = `
      SIKKIM PUBLIC SERVICE COMMISSION
      UNDER SECRETARY PRELIMINARY EXAMINATION, 2025

      SCHEME OF EXAMINATION
      Paper-I: General English - 100 Marks - 2 Hours
      Paper-II: General Knowledge - 100 Marks - 2 Hours
      Total Marks: 200

      There shall be negative marking of 0.25 marks for each wrong answer.

      SYLLABUS
      General English: comprehension, précis writing, grammar, vocabulary, sentence correction.
      General Knowledge: Indian Polity, History of India, Geography of India, Economy, Current Affairs, Sikkim subjects and government schemes.

      Minimum educational qualification: Degree from a recognized University.
    `;

    const parsed = parseSyllabusText({
      examTitle: "Under Secretary Preliminary Examination",
      text,
    });

    expect(parsed.status).toBe("success");
    expect(parsed.metadata.paperCount).toBe(2);
    expect(parsed.metadata.totalMarks).toBe(200);
    expect(parsed.metadata.durationMinutes).toBe(120);
    expect(parsed.metadata.negativeMarking).toBe(true);
    expect(parsed.metadata.negativeMarkValue).toBe(0.25);
    expect(parsed.metadata.subjects).toEqual(
      expect.arrayContaining(["General English", "General Knowledge", "Indian Polity", "History", "Geography", "Indian Economy", "Current Affairs"])
    );
    expect(parsed.metadata.topics).toEqual(
      expect.arrayContaining(["comprehension", "grammar", "vocabulary", "Sikkim"])
    );
    expect(parsed.metadata.qualificationHints).toEqual(
      expect.arrayContaining(["Degree from a recognized University"])
    );
  });

  it("extracts technical subjects and scheme details from a junior engineer style syllabus", () => {
    const text = `
      ADVERTISEMENT FOR THE POST OF JUNIOR ENGINEER (CIVIL)
      Written Examination Pattern:
      One paper of 300 marks. Duration: 3 hours.
      25% negative marking shall apply for every incorrect answer.

      Section A: General English
      Section B: General Knowledge and Current Affairs
      Section C: Civil Engineering

      Civil Engineering syllabus includes surveying, strength of materials, structural analysis,
      RCC design, fluid mechanics, environmental engineering, highway engineering, estimation and costing.

      Eligibility: Diploma in Civil Engineering from a recognized institute.
    `;

    const parsed = parseSyllabusText({
      examTitle: "Junior Engineer (Civil)",
      text,
    });

    expect(parsed.status).toBe("success");
    expect(parsed.metadata.paperCount).toBe(1);
    expect(parsed.metadata.totalMarks).toBe(300);
    expect(parsed.metadata.durationMinutes).toBe(180);
    expect(parsed.metadata.negativeMarking).toBe(true);
    expect(parsed.metadata.negativeMarkValue).toBe(0.25);
    expect(parsed.metadata.subjects).toEqual(
      expect.arrayContaining(["Civil Engineering", "General English", "General Knowledge", "Current Affairs"])
    );
    expect(parsed.metadata.topics).toEqual(
      expect.arrayContaining(["surveying", "RCC design", "fluid mechanics", "highway engineering"])
    );
    expect(parsed.metadata.qualificationHints).toEqual(
      expect.arrayContaining(["Diploma in Civil Engineering from a recognized institute"])
    );
  });

  it("returns partial status when only sparse syllabus cues are present", () => {
    const text = `
      Forest Guard Examination
      Syllabus includes General Knowledge, English, Arithmetic and questions on forests and environment.
      Candidates must have passed Class XII.
    `;

    const parsed = parseSyllabusText({
      examTitle: "Forest Guard Examination",
      text,
    });

    expect(parsed.status).toBe("partial");
    expect(parsed.metadata.subjects).toEqual(
      expect.arrayContaining(["General Knowledge", "General English", "Arithmetic and Logical Reasoning", "Environment"])
    );
    expect(parsed.metadata.qualificationHints).toEqual(
      expect.arrayContaining(["passed Class XII"])
    );
    expect(parsed.metadata.paperCount).toBeNull();
    expect(parsed.metadata.totalMarks).toBeNull();
  });
});
