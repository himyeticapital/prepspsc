import { create } from "zustand";
import type { Question, QuestionOption } from "@/types/database.types";

interface TestState {
  testId: number | null;
  attemptId: number | null;
  questions: Question[];
  currentQuestionIndex: number;
  answers: Record<number, string>; // questionId -> answer
  bookmarkedQuestions: Set<number>;
  markedForReview: Set<number>; // Questions marked for review (separate from bookmarks)
  timePerQuestion: Record<number, number>; // questionId -> time spent in seconds
  lastQuestionChangeTime: number | null; // Timestamp when current question was shown
  startTime: Date | null;
  remainingSeconds: number;
  totalDurationSeconds: number; // Store total duration for percentage calculation
  isSubmitting: boolean;
  intervalId: NodeJS.Timeout | null;

  // Actions
  initTest: (testId: number, attemptId: number, questions: Question[], durationMinutes: number) => void;
  setCurrentQuestion: (index: number) => void;
  setAnswer: (questionId: number, answer: string) => void;
  toggleBookmark: (questionId: number) => void;
  toggleMarkForReview: (questionId: number) => void;
  tick: () => void;
  startTimer: () => void;
  pauseTimer: () => void;
  setSubmitting: (isSubmitting: boolean) => void;
  reset: () => void;
  getAnsweredCount: () => number;
  getBookmarkedCount: () => number;
  getMarkedForReviewCount: () => number;
  getTimePercentage: () => number;
  getTimeSpentOnQuestion: (questionId: number) => number;
}

export const useTestStore = create<TestState>((set, get) => ({
  testId: null,
  attemptId: null,
  questions: [],
  currentQuestionIndex: 0,
  answers: {},
  bookmarkedQuestions: new Set(),
  markedForReview: new Set(),
  timePerQuestion: {},
  lastQuestionChangeTime: null,
  startTime: null,
  remainingSeconds: 0,
  totalDurationSeconds: 0,
  isSubmitting: false,
  intervalId: null,

  initTest: (testId, attemptId, questions, durationMinutes) => {
    const totalSeconds = durationMinutes * 60;
    set({
      testId,
      attemptId,
      questions,
      currentQuestionIndex: 0,
      answers: {},
      bookmarkedQuestions: new Set(),
      markedForReview: new Set(),
      timePerQuestion: {},
      lastQuestionChangeTime: Date.now(),
      startTime: new Date(),
      remainingSeconds: totalSeconds,
      totalDurationSeconds: totalSeconds,
      isSubmitting: false,
    });
  },

  setCurrentQuestion: (index) => {
    const { questions, currentQuestionIndex, lastQuestionChangeTime, timePerQuestion } = get();
    if (index >= 0 && index < questions.length && index !== currentQuestionIndex) {
      // Track time spent on current question before switching
      const currentQuestionId = questions[currentQuestionIndex]?.id;
      let updatedTimePerQuestion = { ...timePerQuestion };

      if (currentQuestionId && lastQuestionChangeTime) {
        const timeSpent = Math.floor((Date.now() - lastQuestionChangeTime) / 1000);
        updatedTimePerQuestion[currentQuestionId] = (updatedTimePerQuestion[currentQuestionId] || 0) + timeSpent;
      }

      set({
        currentQuestionIndex: index,
        lastQuestionChangeTime: Date.now(),
        timePerQuestion: updatedTimePerQuestion,
      });
    }
  },

  setAnswer: (questionId, answer) => {
    set((state) => ({
      answers: { ...state.answers, [questionId]: answer },
    }));
  },

  toggleBookmark: (questionId) => {
    set((state) => {
      const newBookmarks = new Set(state.bookmarkedQuestions);
      if (newBookmarks.has(questionId)) {
        newBookmarks.delete(questionId);
      } else {
        newBookmarks.add(questionId);
      }
      return { bookmarkedQuestions: newBookmarks };
    });
  },

  toggleMarkForReview: (questionId) => {
    set((state) => {
      const newMarked = new Set(state.markedForReview);
      if (newMarked.has(questionId)) {
        newMarked.delete(questionId);
      } else {
        newMarked.add(questionId);
      }
      return { markedForReview: newMarked };
    });
  },

  tick: () => {
    const { startTime, totalDurationSeconds, intervalId } = get();
    if (!startTime) return;

    // Calculate remaining time based on actual elapsed time
    // This ensures accuracy even when browser tab is backgrounded
    const elapsedSeconds = Math.floor((Date.now() - startTime.getTime()) / 1000);
    const newRemainingSeconds = Math.max(0, totalDurationSeconds - elapsedSeconds);

    if (newRemainingSeconds <= 0) {
      if (intervalId) clearInterval(intervalId);
      set({ intervalId: null, remainingSeconds: 0 });
      return;
    }
    set({ remainingSeconds: newRemainingSeconds });
  },

  startTimer: () => {
    const { intervalId } = get();
    if (intervalId) return;

    const newIntervalId = setInterval(() => {
      get().tick();
    }, 1000);

    set({ intervalId: newIntervalId });
  },

  pauseTimer: () => {
    const { intervalId } = get();
    if (intervalId) {
      clearInterval(intervalId);
      set({ intervalId: null });
    }
  },

  setSubmitting: (isSubmitting) => set({ isSubmitting }),

  reset: () => {
    const { intervalId } = get();
    if (intervalId) clearInterval(intervalId);

    set({
      testId: null,
      attemptId: null,
      questions: [],
      currentQuestionIndex: 0,
      answers: {},
      bookmarkedQuestions: new Set(),
      markedForReview: new Set(),
      timePerQuestion: {},
      lastQuestionChangeTime: null,
      startTime: null,
      remainingSeconds: 0,
      totalDurationSeconds: 0,
      isSubmitting: false,
      intervalId: null,
    });
  },

  getAnsweredCount: () => {
    return Object.keys(get().answers).length;
  },

  getBookmarkedCount: () => {
    return get().bookmarkedQuestions.size;
  },

  getMarkedForReviewCount: () => {
    return get().markedForReview.size;
  },

  getTimePercentage: () => {
    const { remainingSeconds, totalDurationSeconds } = get();
    if (totalDurationSeconds === 0) return 100;
    return (remainingSeconds / totalDurationSeconds) * 100;
  },

  getTimeSpentOnQuestion: (questionId: number) => {
    return get().timePerQuestion[questionId] || 0;
  },
}));
