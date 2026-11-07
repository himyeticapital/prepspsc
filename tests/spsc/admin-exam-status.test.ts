import { describe, expect, it } from "vitest";

import { replaceUpdatedExam } from "@/app/admin/exams/exam-status";

describe("replaceUpdatedExam", () => {
  it("replaces the matching exam so status changes move between active and inactive sections", () => {
    const exams = [
      { id: "active-1", is_active: true, name: "Active exam" },
      { id: "inactive-1", is_active: false, name: "Inactive exam" },
    ];

    const updated = { id: "inactive-1", is_active: true, name: "Inactive exam" };
    const result = replaceUpdatedExam(exams, updated);

    expect(result).toEqual([
      { id: "active-1", is_active: true, name: "Active exam" },
      { id: "inactive-1", is_active: true, name: "Inactive exam" },
    ]);
  });

  it("leaves unrelated exams untouched", () => {
    const exams = [
      { id: "exam-1", is_active: true, name: "Exam 1" },
      { id: "exam-2", is_active: false, name: "Exam 2" },
    ];

    const result = replaceUpdatedExam(exams, {
      id: "exam-1",
      is_active: false,
      name: "Exam 1 updated",
    });

    expect(result[1]).toEqual({ id: "exam-2", is_active: false, name: "Exam 2" });
  });
});
