"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useTestStore } from "@/stores/test-store";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatTime } from "@/lib/utils";
import {
  Clock,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Trophy,
  LogIn,
  RotateCcw,
  FileText,
  Loader2,
  Flag,
  Eye,
  List,
  Keyboard,
} from "lucide-react";
import { AnswerUpload } from "@/components/test/answer-upload";
import { UploadTipsDialog } from "@/components/test/upload-tips-dialog";
import { FullPaperView } from "@/components/test/full-paper-view";
import type { Test, Question, QuestionOption } from "@/types/database.types";

interface TestClientProps {
  test: Test;
  questions: Question[];
  userId: string;
  isPreview?: boolean;
}

export function TestClient({ test, questions, userId, isPreview = false }: TestClientProps) {
  const router = useRouter();
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [showTipsDialog, setShowTipsDialog] = useState(false);
  const [fileUrls, setFileUrls] = useState<Record<number, string>>({});
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationStartTime, setEvaluationStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Ref to track if submission has been initiated - prevents duplicate submissions during re-renders
  const submissionInitiatedRef = useRef(false);
  const [viewMode, setViewMode] = useState<"single" | "full">("single");
  const [previewResults, setPreviewResults] = useState<{
    score: number;
    total: number;
    correct: number;
    incorrect: number;
    unanswered: number;
  } | null>(null);

  // Swipe handling for mobile - must be declared before any conditional returns
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Check if test has conventional questions
  const hasConventionalQuestions = questions.some((q) => q.type === "conventional");

  const {
    currentQuestionIndex,
    answers,
    bookmarkedQuestions,
    markedForReview,
    remainingSeconds,
    isSubmitting,
    initTest,
    setCurrentQuestion,
    setAnswer,
    toggleBookmark,
    toggleMarkForReview,
    startTimer,
    pauseTimer,
    setSubmitting,
    reset,
    getAnsweredCount,
    getBookmarkedCount,
    getMarkedForReviewCount,
    getTimePercentage,
  } = useTestStore();

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  // Start test
  const handleStartTest = async () => {
    if (isPreview) {
      // Preview mode - skip database operations
      setAttemptId(-1); // Use dummy ID for preview
      initTest(test.id, -1, questions, test.duration_minutes);
      startTimer();
      setIsStarted(true);
      return;
    }

    const supabase = createClient();

    // Get the current attempt count for this user on this test
    const { count: previousAttempts } = await supabase
      .from("test_attempts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("test_id", test.id);

    const attemptNumber = (previousAttempts || 0) + 1;

    // Create test attempt
    const { data: attempt, error } = await supabase
      .from("test_attempts")
      .insert({
        user_id: userId,
        test_id: test.id,
        total_marks: test.total_marks,
        status: "in_progress",
        attempt_number: attemptNumber,
      })
      .select()
      .single();

    if (error || !attempt) {
      console.error("Failed to create attempt:", error);
      return;
    }

    setAttemptId(attempt.id);
    initTest(test.id, attempt.id, questions, test.duration_minutes);
    startTimer();
    setIsStarted(true);
  };

  // Handle bookmark toggle with database persistence
  const handleToggleBookmark = async (questionId: number) => {
    // Update local state first for immediate UI feedback
    toggleBookmark(questionId);

    // Skip database operations in preview mode
    if (isPreview) return;

    const supabase = createClient();
    const isCurrentlyBookmarked = bookmarkedQuestions.has(questionId);

    if (isCurrentlyBookmarked) {
      // Remove bookmark from database
      await supabase
        .from("bookmarks")
        .delete()
        .eq("user_id", userId)
        .eq("question_id", questionId);
    } else {
      // Add bookmark to database
      await supabase
        .from("bookmarks")
        .upsert({
          user_id: userId,
          question_id: questionId,
        }, {
          onConflict: "user_id,question_id"
        });
    }
  };

  // Submit test
  const handleSubmitTest = useCallback(async () => {
    // Guard against duplicate submissions
    if (!attemptId || isSubmitting || submissionInitiatedRef.current) return;

    // Mark submission as initiated to prevent duplicate calls
    submissionInitiatedRef.current = true;
    setSubmitting(true);
    pauseTimer();

    // Capture current remaining seconds before any async operations
    const currentRemainingSeconds = useTestStore.getState().remainingSeconds;
    const testStartTime = useTestStore.getState().startTime;

    // Calculate score
    let totalScore = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;

    for (const question of questions) {
      const userAnswer = answers[question.id];

      if (question.type === "mcq") {
        if (!userAnswer) {
          unansweredCount++;
        } else if (userAnswer === question.correct_answer) {
          correctCount++;
          totalScore += question.marks;
        } else {
          incorrectCount++;
          if (question.negative_marks > 0) {
            totalScore -= question.negative_marks;
          }
        }
      }
    }

    // Preview mode - show results locally without saving to database
    if (isPreview) {
      setPreviewResults({
        score: Math.max(0, totalScore),
        total: test.total_marks || questions.reduce((sum, q) => sum + q.marks, 0),
        correct: correctCount,
        incorrect: incorrectCount,
        unanswered: unansweredCount,
      });
      setSubmitting(false);
      return;
    }

    const supabase = createClient();
    const userAnswers = [];

    // Debug: Log all answers being saved
    console.log("=== Saving Answers ===");
    console.log("answers object:", answers);
    console.log("fileUrls object:", fileUrls);

    for (const question of questions) {
      const userAnswer = answers[question.id];
      const answerFileUrl = fileUrls[question.id] || null;
      console.log(`Question ${question.id} (${question.type}):`, {
        userAnswer,
        answerFileUrl,
      });
      let isCorrect = false;
      let marksObtained = 0;

      if (question.type === "mcq" && userAnswer) {
        isCorrect = userAnswer === question.correct_answer;
        if (isCorrect) {
          marksObtained = question.marks;
        } else if (question.negative_marks > 0) {
          marksObtained = -question.negative_marks;
        }
      }

      userAnswers.push({
        attempt_id: attemptId,
        question_id: question.id,
        user_answer: userAnswer || null,
        // For MCQ: only set is_correct if user actually answered (not skipped)
        is_correct: question.type === "mcq" && userAnswer ? isCorrect : null,
        marks_obtained: marksObtained,
        answer_file_url: answerFileUrl,
        grading_status: question.type === "conventional" ? "pending" : "completed",
      });
    }

    // Log what we're about to save
    console.log("=== User Answers to Insert ===");
    userAnswers.forEach((ua, i) => {
      console.log(`Answer ${i + 1}:`, {
        question_id: ua.question_id,
        user_answer: ua.user_answer,
        is_correct: ua.is_correct,
        marks_obtained: ua.marks_obtained,
        has_file: !!ua.answer_file_url,
      });
    });

    // Try to save answers client-side first (faster), but don't block on failure
    // The evaluate-test API will re-insert using service_role if client-side fails
    let answersInsertedClientSide = false;
    try {
      // First, delete any existing answers for this attempt (in case of re-submission)
      const { error: deleteError } = await supabase.from("user_answers").delete().eq("attempt_id", attemptId);
      if (deleteError) {
        console.error("Failed to delete old answers:", deleteError);
      }

      // Then insert new answers
      const { error: insertError } = await supabase.from("user_answers").insert(userAnswers);
      if (insertError) {
        console.error("Failed to insert answers (will retry via API):", insertError);
      } else {
        console.log("Answers inserted successfully");
        answersInsertedClientSide = true;
      }
    } catch (clientInsertError) {
      // Auth session may have expired - API will handle insertion with service_role
      console.error("Client-side answer insert failed (will retry via API):", clientInsertError);
    }

    // Update attempt - calculate time taken
    // Primary method: use startTime (most reliable)
    const totalDuration = test.duration_minutes * 60;
    let timeTaken = 1; // Default minimum

    if (testStartTime) {
      // Calculate from actual start time - most reliable
      timeTaken = Math.floor((Date.now() - testStartTime.getTime()) / 1000);
    } else if (currentRemainingSeconds > 0 && currentRemainingSeconds < totalDuration) {
      // Fallback: calculate from remaining seconds
      timeTaken = totalDuration - currentRemainingSeconds;
    }

    console.log("Time calculation:", {
      totalDuration,
      currentRemainingSeconds,
      testStartTime: testStartTime?.toISOString(),
      calculatedTimeTaken: timeTaken,
    });

    // Ensure minimum of 1 second and cap at total duration
    timeTaken = Math.min(Math.max(timeTaken, 1), totalDuration);

    // If there are conventional questions, keep as in_progress until AI evaluation completes
    const hasConventional = questions.some((q) => q.type === "conventional");

    // NOTE: We no longer update test_attempts from the client-side due to RLS issues.
    // The evaluate-test API handles all updates using service_role key (bypasses RLS).
    // This is more reliable and avoids the intermittent 400 errors from client-side updates.

    // Trigger AI evaluation for ALL tests (MCQ explanation + conventional evaluation)
    // This ensures AI feedback is generated before showing results
    if (!isPreview) {
      setIsEvaluating(true);
      try {
        console.log("Starting AI evaluation for attempt:", attemptId);

        // Create AbortController for timeout (90 seconds max wait)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);

        const evalResponse = await fetch("/api/evaluate-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId,
            // Pass completion data so server can set it (in case client-side update failed)
            timeTakenSeconds: timeTaken,
            completedAt: new Date().toISOString(),
            mcqScore: hasConventional ? null : Math.max(0, totalScore),
            // Pass answers for server-side insert if client-side failed
            userAnswers: answersInsertedClientSide ? undefined : userAnswers,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!evalResponse.ok) {
          const errorData = await evalResponse.json().catch(() => ({}));
          console.error("Evaluation API error:", evalResponse.status, errorData);
          // Still navigate to results even if evaluation fails
        } else {
          // Wait for the response to ensure evaluation is complete
          const evalResult = await evalResponse.json();
          console.log("Evaluation completed successfully:", evalResult);

          // Small delay to ensure database writes are committed
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn("Evaluation timed out after 90s - results may still be processing");
        } else {
          console.error("Failed to trigger evaluation:", error);
        }
        // Still navigate to results even if evaluation fails/times out
      }
      // Note: Don't setIsEvaluating(false) here - keep the loading dialog visible
      // until navigation completes to prevent flash of questions page
    }

    // Navigate first, then reset - prevents brief flash of reset state
    router.push(`/results/${attemptId}`);
    reset();
  }, [attemptId, isSubmitting, answers, questions, test, pauseTimer, setSubmitting, reset, router, isPreview, fileUrls]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (isStarted && remainingSeconds <= 0) {
      handleSubmitTest();
    }
  }, [isStarted, remainingSeconds, handleSubmitTest]);

  // Prevent copy/paste and right-click
  useEffect(() => {
    const preventContext = (e: Event) => e.preventDefault();
    const preventCopy = (e: Event) => e.preventDefault();

    document.addEventListener("contextmenu", preventContext);
    document.addEventListener("copy", preventCopy);
    document.addEventListener("cut", preventCopy);

    return () => {
      document.removeEventListener("contextmenu", preventContext);
      document.removeEventListener("copy", preventCopy);
      document.removeEventListener("cut", preventCopy);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isStarted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in textarea
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
          if (currentQuestionIndex > 0) {
            setCurrentQuestion(currentQuestionIndex - 1);
          }
          break;
        case "ArrowRight":
          if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestion(currentQuestionIndex + 1);
          }
          break;
        case "1":
        case "2":
        case "3":
        case "4":
          // MCQ option shortcuts (1 = a, 2 = b, etc.)
          if (currentQuestion?.type === "mcq") {
            const optionIndex = parseInt(e.key) - 1;
            const optionIds = ["a", "b", "c", "d"];
            const currentOptions = (currentQuestion.options as QuestionOption[]) || [];
            if (optionIndex >= 0 && optionIndex < currentOptions.length) {
              setAnswer(currentQuestion.id, optionIds[optionIndex]);
            }
          }
          break;
        case "m":
        case "M":
          // Toggle mark for review
          if (currentQuestion) {
            toggleMarkForReview(currentQuestion.id);
          }
          break;
        case "b":
        case "B":
          // Toggle bookmark
          if (currentQuestion) {
            handleToggleBookmark(currentQuestion.id);
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isStarted, currentQuestionIndex, currentQuestion, questions.length, setCurrentQuestion, setAnswer, toggleMarkForReview, handleToggleBookmark]);

  // Timer for evaluation progress
  useEffect(() => {
    if (isEvaluating && !evaluationStartTime) {
      setEvaluationStartTime(Date.now());
    }

    if (!isEvaluating) {
      setEvaluationStartTime(null);
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      if (evaluationStartTime) {
        setElapsedSeconds(Math.floor((Date.now() - evaluationStartTime) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isEvaluating, evaluationStartTime]);

  // Format elapsed time for display
  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0
      ? `${mins}:${secs.toString().padStart(2, '0')}`
      : `${secs}s`;
  };

  // Calculate timer color and animation
  const timePercentage = getTimePercentage();
  const getTimerColor = () => {
    if (timePercentage > 50) return "bg-green-500/10 text-green-500 border-green-500/30";
    if (timePercentage > 25) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
    return "bg-destructive/10 text-destructive border-destructive/30";
  };
  const shouldPulse = remainingSeconds <= 300; // 5 minutes

  // Start Screen
  if (!isStarted) {
    return (
      <div className="max-w-2xl mx-auto">
        {isPreview && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-lg bg-primary/20 border border-primary/30 text-center"
          >
            <p className="text-sm text-primary">
              Preview Mode - Your answers won&apos;t be saved. Sign in to track your progress!
            </p>
          </motion.div>
        )}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 text-center"
        >
          <h1 className="text-2xl font-bold mb-2">{test.title}</h1>
          {test.description && (
            <p className="text-muted-foreground mb-6">{test.description}</p>
          )}

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="text-2xl font-bold text-primary">{questions.length}</p>
              <p className="text-sm text-muted-foreground">Questions</p>
            </div>
            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="text-2xl font-bold text-primary">{test.duration_minutes}</p>
              <p className="text-sm text-muted-foreground">Minutes</p>
            </div>
            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="text-2xl font-bold text-primary">{test.total_marks || "N/A"}</p>
              <p className="text-sm text-muted-foreground">Total Marks</p>
            </div>
            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="text-2xl font-bold text-primary">{test.passing_marks || "N/A"}</p>
              <p className="text-sm text-muted-foreground">Passing Marks</p>
            </div>
          </div>

          {/* Test Type Badge */}
          {test.test_type && test.test_type !== "mcq" && (
            <div className="flex justify-center mb-6">
              <Badge variant="outline" className="text-sm px-3 py-1">
                {test.test_type === "conventional" ? (
                  <>
                    <FileText className="w-4 h-4 mr-1" />
                    Essay Questions - Upload handwritten answers
                  </>
                ) : (
                  <>MCQ + Essay Questions</>
                )}
              </Badge>
            </div>
          )}

          <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 mb-6 text-left">
            <div className="flex items-center gap-2 text-accent mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Instructions</span>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Do not refresh the page during the test</li>
              <li>The test will auto-submit when time runs out</li>
              <li>You can navigate between questions using the sidebar</li>
              <li>Bookmark questions to review later</li>
              {hasConventionalQuestions && !isPreview && (
                <>
                  <li>For essay questions, upload photos of your handwritten answers</li>
                  <li>AI will evaluate your answers after submission</li>
                </>
              )}
            </ul>
          </div>

          <Button className="w-full primary-glow" onClick={handleStartTest}>
            Start Test
          </Button>
        </motion.div>
      </div>
    );
  }

  // Parse options for MCQ - safely filter out invalid entries
  const rawOptions = currentQuestion?.type === "mcq" ? currentQuestion.options : null;
  const options: QuestionOption[] = Array.isArray(rawOptions)
    ? (rawOptions as unknown[]).filter(
        (opt): opt is QuestionOption =>
          opt !== null && typeof opt === "object" && "id" in opt && "text" in opt && typeof (opt as QuestionOption).id === "string" && typeof (opt as QuestionOption).text === "string"
      )
    : [];

  // Swipe handling for mobile
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isSwipe = Math.abs(distance) > minSwipeDistance;

    if (isSwipe) {
      if (distance > 0 && currentQuestionIndex < questions.length - 1) {
        // Swipe left -> next question
        setCurrentQuestion(currentQuestionIndex + 1);
      } else if (distance < 0 && currentQuestionIndex > 0) {
        // Swipe right -> previous question
        setCurrentQuestion(currentQuestionIndex - 1);
      }
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
      {/* Main Test Area */}
      <div className="flex-1 space-y-4 lg:space-y-6">
        {/* Header */}
        <div className="glass-card p-4 sticky top-20 z-40 bg-background/95 backdrop-blur-md">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="font-semibold line-clamp-1">{test.title}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Q {currentQuestionIndex + 1} of {questions.length}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* View Toggle */}
              <div className="hidden sm:flex items-center rounded-lg border bg-secondary/50 p-1">
                <Button
                  variant={viewMode === "single" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setViewMode("single")}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Single
                </Button>
                <Button
                  variant={viewMode === "full" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setViewMode("full")}
                >
                  <List className="w-4 h-4 mr-1" />
                  Full
                </Button>
              </div>

              {/* Timer with color transitions */}
              <div className={cn(
                "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-mono text-lg sm:text-xl font-bold border transition-colors",
                getTimerColor(),
                shouldPulse && "animate-pulse"
              )}>
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                {formatTime(remainingSeconds)}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <Progress value={progress} className="mt-4 h-2" />

          {/* Progress stats */}
          <div className="flex items-center justify-between mt-3 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center flex-wrap gap-2 sm:gap-4">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                {getAnsweredCount()}/{questions.length} Answered
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                {getMarkedForReviewCount()} Review
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-secondary"></div>
                {questions.length - getAnsweredCount()} Remaining
              </span>
            </div>
            {/* Keyboard shortcut hint - hide on mobile */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="hidden sm:flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                    <Keyboard className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="text-xs space-y-1">
                    <p><kbd className="px-1 bg-secondary rounded">←</kbd> <kbd className="px-1 bg-secondary rounded">→</kbd> Navigate</p>
                    <p><kbd className="px-1 bg-secondary rounded">1-4</kbd> Select MCQ option</p>
                    <p><kbd className="px-1 bg-secondary rounded">M</kbd> Mark for review</p>
                    <p><kbd className="px-1 bg-secondary rounded">B</kbd> Bookmark</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Full Paper View */}
        {viewMode === "full" ? (
          <FullPaperView
            questions={questions}
            answers={answers}
            bookmarkedQuestions={bookmarkedQuestions}
            markedForReview={markedForReview}
            onSetAnswer={setAnswer}
            onToggleBookmark={handleToggleBookmark}
            onToggleMarkForReview={toggleMarkForReview}
            onJumpToQuestion={(index) => {
              setViewMode("single");
              setCurrentQuestion(index);
            }}
            fileUrls={fileUrls}
          />
        ) : (
          <>
            {/* Single Question View */}
            <div
              className="glass-card p-4 sm:p-6 no-select relative z-30"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {/* Invisible render trigger - same structure as working debug box */}
              <div className="bg-zinc-900 text-zinc-900 p-2 mb-1 rounded font-bold text-xs leading-none select-none pointer-events-none">.</div>

              {/* Question type and actions row */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {currentQuestion?.type === "mcq" ? "Multiple Choice" : "Conventional"}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {currentQuestion?.marks} {currentQuestion?.marks === 1 ? "mark" : "marks"}
                  </Badge>
                </div>
                  <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleMarkForReview(currentQuestion.id)}
                            className={cn(
                              markedForReview.has(currentQuestion?.id) && "text-yellow-500"
                            )}
                          >
                            <Flag className={cn(
                              "w-5 h-5",
                              markedForReview.has(currentQuestion?.id) && "fill-yellow-500"
                            )} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {markedForReview.has(currentQuestion?.id) ? "Unmark for review" : "Mark for review"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleBookmark(currentQuestion.id)}
                          >
                            {bookmarkedQuestions.has(currentQuestion?.id) ? (
                              <BookmarkCheck className="w-5 h-5 text-accent" />
                            ) : (
                              <Bookmark className="w-5 h-5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {bookmarkedQuestions.has(currentQuestion?.id) ? "Remove bookmark" : "Bookmark"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                <div className="text-lg mb-6">{currentQuestion?.content}</div>

                {/* MCQ Options */}
                {currentQuestion?.type === "mcq" && (
                  <RadioGroup
                    value={answers[currentQuestion.id] || ""}
                    onValueChange={(value) => setAnswer(currentQuestion.id, value)}
                    className="space-y-3"
                  >
                    {options.map((option, optIndex) => (
                      <div
                        key={`${currentQuestion.id}-${option.id}-${optIndex}`}
                        className={cn(
                          "flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-colors",
                          answers[currentQuestion.id] === option.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        )}
                        onClick={() => setAnswer(currentQuestion.id, option.id)}
                      >
                        <RadioGroupItem value={option.id} id={`option-${currentQuestion.id}-${option.id}`} />
                        <Label
                          htmlFor={`option-${currentQuestion.id}-${option.id}`}
                          className="flex-1 cursor-pointer"
                        >
                          {option.text}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {/* Conventional (Essay) - File Upload */}
                {currentQuestion?.type === "conventional" && (
                  <div className="space-y-4">
                    {currentQuestion.word_limit && (
                      <p className="text-sm text-muted-foreground">
                        Word limit: <span className="font-medium">{currentQuestion.word_limit} words</span>
                      </p>
                    )}

                    {isPreview ? (
                      // Preview mode - show simple textarea
                      <Textarea
                        placeholder="Write your answer here (preview mode - file upload disabled)..."
                        value={answers[currentQuestion.id] || ""}
                        onChange={(e) => setAnswer(currentQuestion.id, e.target.value)}
                        className="min-h-[200px]"
                      />
                    ) : (
                      // Real mode - show file upload
                      <AnswerUpload
                        questionId={currentQuestion.id}
                        attemptId={attemptId || 0}
                        userId={userId}
                        existingUrl={fileUrls[currentQuestion.id]}
                        onUploadComplete={(url) => {
                          setFileUrls((prev) => ({ ...prev, [currentQuestion.id]: url }));
                          // Also mark as answered in the store
                          if (url) {
                            setAnswer(currentQuestion.id, `[FILE:${url}]`);
                          } else {
                            setAnswer(currentQuestion.id, "");
                          }
                        }}
                        onShowTips={() => setShowTipsDialog(true)}
                      />
                    )}
                  </div>
                )}
            </div>

            {/* Desktop Navigation */}
            <div className="hidden sm:flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentQuestion(currentQuestionIndex - 1)}
                disabled={currentQuestionIndex === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              {currentQuestionIndex === questions.length - 1 ? (
                <Button
                  className="primary-glow"
                  onClick={() => setShowSubmitDialog(true)}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Submit Test
                </Button>
              ) : (
                <Button
                  onClick={() => setCurrentQuestion(currentQuestionIndex + 1)}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>

            {/* Mobile Bottom Navigation - positioned above main mobile nav */}
            <div className="fixed bottom-16 left-0 right-0 sm:hidden bg-background/95 backdrop-blur-sm border-t z-50">
              <div className="flex items-center justify-between px-4 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentQuestion(currentQuestionIndex - 1)}
                  disabled={currentQuestionIndex === 0}
                  className="flex-1"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>

                <div className="flex items-center gap-2 px-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMarkForReview(currentQuestion.id)}
                    className={cn(
                      markedForReview.has(currentQuestion?.id) && "text-yellow-500"
                    )}
                  >
                    <Flag className={cn(
                      "w-5 h-5",
                      markedForReview.has(currentQuestion?.id) && "fill-yellow-500"
                    )} />
                  </Button>

                  <span className="text-sm font-medium">
                    {currentQuestionIndex + 1}/{questions.length}
                  </span>

                  {currentQuestionIndex === questions.length - 1 ? (
                    <Button
                      size="sm"
                      className="primary-glow"
                      onClick={() => setShowSubmitDialog(true)}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  ) : null}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentQuestion(currentQuestionIndex + 1)}
                  disabled={currentQuestionIndex === questions.length - 1}
                  className="flex-1"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Spacer for mobile bottom nav (test nav + main nav) */}
            <div className="h-32 sm:hidden"></div>
          </>
        )}
      </div>

      {/* Question Navigation Sidebar */}
      <div className="w-full lg:w-64 order-first lg:order-last">
        <div className="glass-card p-4 sticky top-20">
          <h3 className="font-semibold mb-4">Questions</h3>

          <TooltipProvider>
            <div className="flex flex-wrap gap-2 mb-4">
              {questions.map((q, index) => (
                <Tooltip key={q.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setCurrentQuestion(index)}
                      className={cn(
                        "w-10 h-10 rounded-lg text-sm font-medium transition-colors relative",
                        index === currentQuestionIndex
                          ? "bg-primary text-primary-foreground"
                          : answers[q.id]
                          ? "bg-primary/20 text-primary"
                          : "bg-secondary hover:bg-secondary/80",
                        bookmarkedQuestions.has(q.id) && "ring-2 ring-accent",
                        markedForReview.has(q.id) && "ring-2 ring-yellow-500"
                      )}
                    >
                      {index + 1}
                      {markedForReview.has(q.id) && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full"></span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    <p className="text-xs line-clamp-2">{q.content.substring(0, 50)}...</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {q.type === "mcq" ? "MCQ" : "Essay"} • {q.marks} marks
                      {answers[q.id] && " • Answered"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-primary/20"></div>
              <span>Answered ({getAnsweredCount()})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-secondary"></div>
              <span>Unanswered ({questions.length - getAnsweredCount()})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded ring-2 ring-yellow-500"></div>
              <span>For Review ({getMarkedForReviewCount()})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded ring-2 ring-accent"></div>
              <span>Bookmarked ({getBookmarkedCount()})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Test?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3">
                <p>Are you sure you want to submit?</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>{getAnsweredCount()} Answered</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg">
                    <MinusCircle className="w-4 h-4 text-muted-foreground" />
                    <span>{questions.length - getAnsweredCount()} Unanswered</span>
                  </div>
                </div>
                {(getMarkedForReviewCount() > 0 || getBookmarkedCount() > 0) && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-600 dark:text-yellow-400 text-sm">
                    <AlertTriangle className="w-4 h-4 inline-block mr-2" />
                    {getMarkedForReviewCount() > 0 && (
                      <span>{getMarkedForReviewCount()} marked for review</span>
                    )}
                    {getMarkedForReviewCount() > 0 && getBookmarkedCount() > 0 && ", "}
                    {getBookmarkedCount() > 0 && (
                      <span>{getBookmarkedCount()} bookmarked</span>
                    )}
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowSubmitDialog(false);
                // Navigate to first marked-for-review question, or first unanswered, or stay
                const reviewIndex = questions.findIndex(q => markedForReview.has(q.id));
                if (reviewIndex !== -1) {
                  setCurrentQuestion(reviewIndex);
                } else {
                  // No marked questions - go to first unanswered
                  const unansweredIndex = questions.findIndex(q => !answers[q.id]);
                  if (unansweredIndex !== -1) {
                    setCurrentQuestion(unansweredIndex);
                  }
                }
              }}
              className="w-full sm:w-auto"
            >
              Review Answers
            </Button>
            <Button
              onClick={() => {
                setShowSubmitDialog(false); // Close dialog first
                handleSubmitTest(); // Then submit
              }}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? "Submitting..." : "Submit Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Results Dialog */}
      <Dialog open={!!previewResults} onOpenChange={() => setPreviewResults(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Preview Results
            </DialogTitle>
            <DialogDescription>
              Your test has been evaluated. Sign in to save your progress!
            </DialogDescription>
          </DialogHeader>

          {previewResults && (
            <div className="space-y-4">
              {/* Score */}
              <div className="text-center p-6 bg-secondary/50 rounded-lg">
                <p className="text-4xl font-bold text-primary">
                  {previewResults.score}/{previewResults.total}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {previewResults.score >= (test.passing_marks || 0) ? (
                    <span className="text-green-500">Passed!</span>
                  ) : (
                    <span className="text-red-500">Needs Improvement</span>
                  )}
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center p-3 bg-green-500/10 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mb-1" />
                  <span className="text-lg font-semibold">{previewResults.correct}</span>
                  <span className="text-xs text-muted-foreground">Correct</span>
                </div>
                <div className="flex flex-col items-center p-3 bg-red-500/10 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-500 mb-1" />
                  <span className="text-lg font-semibold">{previewResults.incorrect}</span>
                  <span className="text-xs text-muted-foreground">Incorrect</span>
                </div>
                <div className="flex flex-col items-center p-3 bg-gray-500/10 rounded-lg">
                  <MinusCircle className="w-5 h-5 text-gray-500 mb-1" />
                  <span className="text-lg font-semibold">{previewResults.unanswered}</span>
                  <span className="text-xs text-muted-foreground">Skipped</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  className="w-full primary-glow"
                  onClick={() => router.push("/auth/login")}
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In to Save Progress
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setPreviewResults(null);
                    reset();
                    setIsStarted(false);
                    setShowSubmitDialog(false);
                  }}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Tips Dialog */}
      <UploadTipsDialog
        open={showTipsDialog}
        onOpenChange={setShowTipsDialog}
      />

      {/* Evaluating Dialog */}
      <Dialog open={isEvaluating}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="sr-only">
            <DialogTitle>Evaluating Your Answers</DialogTitle>
            <DialogDescription>AI is generating feedback for your answers</DialogDescription>
          </DialogHeader>
          <div className="text-center py-6">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Evaluating Your Answers</h3>
            <p className="text-sm text-muted-foreground mb-3">
              AI is generating detailed feedback and explanations for your answers.
            </p>
            <div className="text-2xl font-mono font-bold text-primary">
              {formatElapsedTime(elapsedSeconds)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {elapsedSeconds < 30
                ? "This usually takes 30-60 seconds..."
                : elapsedSeconds < 60
                  ? "Almost there..."
                  : "Still working on detailed analysis..."}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
