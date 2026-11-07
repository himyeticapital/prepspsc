export interface ExamStatusRecord {
  id: string;
  is_active: boolean;
}

export function replaceUpdatedExam<T extends ExamStatusRecord>(
  exams: T[],
  updatedExam: T
): T[] {
  return exams.map((exam) => (exam.id === updatedExam.id ? updatedExam : exam));
}
