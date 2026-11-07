"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatTime, calculatePercentage } from "@/lib/utils";
import {
  Trophy,
  Clock,
  CheckCircle,
  XCircle,
  MinusCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Home,
  BarChart3,
  FileText,
  Lightbulb,
  AlertCircle,
  FileImage,
  ExternalLink,
  Eye,
  ListX,
  Loader2,
} from "lucide-react";
import { ReviewMode } from "@/components/test/review-mode";
import { Leaderboard } from "@/components/test/leaderboard";
import type { Test, TestAttempt, UserAnswer, Question, QuestionOption, MCQFeedback, ConventionalFeedback, SectionFeedback } from "@/types/database.types";

interface ResultsClientProps {
  attempt: TestAttempt;
  test: Test;
  userAnswers: (UserAnswer & { question: Question })[];
  averageScore: number;
  currentUserId?: string;
}

// Type guards for AI feedback
function isMCQFeedback(feedback: unknown): feedback is MCQFeedback {
  return (
    typeof feedback === "object" &&
    feedback !== null &&
    "isCorrect" in feedback &&
    "explanation" in feedback
  );
}

function isConventionalFeedback(feedback: unknown): feedback is ConventionalFeedback {
  return (
    typeof feedback === "object" &&
    feedback !== null &&
    "score" in feedback &&
    "feedback" in feedback &&
    "strengths" in feedback
  );
}

export function ResultsClient({
  attempt,
  test,
  userAnswers,
  averageScore,
  currentUserId,
}: ResultsClientProps) {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [reviewMode, setReviewMode] = useState<"wrong" | "all" | null>(null);
  // Using a ref to track mount status to avoid lint warnings about setState in useEffect
  const [isMounted, setIsMounted] = useState(false);
  // State for AI retry functionality
  const [retryingQuestions, setRetryingQuestions] = useState<Set<number>>(new Set());

  // Determine test type - used for UI hints
  const hasConventional = userAnswers.some(a => a.question.type === "conventional");

  // Ensure charts only render on client (avoids SSR hydration issues with Recharts)
  useEffect(() => {
    // This pattern is intentional for detecting client-side rendering
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  // Note: Conventional grading polling moved to test-client.tsx
  // Results page now assumes all grading is complete when user arrives

  const score = attempt.score || 0;
  const totalMarks = attempt.total_marks || test.total_marks || 100;
  const percentage = calculatePercentage(score, totalMarks);
  const isPassed = test.passing_marks ? score >= test.passing_marks : percentage >= 40;

  // Calculate stats - separate MCQ and conventional
  const mcqAnswers = userAnswers.filter((a) => a.question.type === "mcq");
  const conventionalAnswers = userAnswers.filter((a) => a.question.type === "conventional");

  // MCQ stats: based on is_correct
  const mcqCorrect = mcqAnswers.filter((a) => a.is_correct === true).length;
  const mcqIncorrect = mcqAnswers.filter((a) => a.user_answer && a.is_correct === false).length;
  const mcqSkipped = mcqAnswers.filter((a) => !a.user_answer).length;

  // Conventional stats: based on whether AI evaluated it (has feedback or marks > 0)
  const conventionalAnswered = conventionalAnswers.filter((a) =>
    a.answer_file_url || a.ai_feedback || (a.marks_obtained && a.marks_obtained > 0)
  ).length;
  const conventionalSkipped = conventionalAnswers.filter((a) =>
    !a.answer_file_url && !a.ai_feedback && (!a.marks_obtained || a.marks_obtained === 0)
  ).length;

  // Combined stats
  const correctCount = mcqCorrect;
  const incorrectCount = mcqIncorrect;
  const skippedCount = mcqSkipped + conventionalSkipped;

  // Debug logging - log each value separately so they're visible in console
  console.log("=== Results Stats ===");
  console.log("Total answers:", userAnswers.length);
  console.log("MCQ answers:", mcqAnswers.length);
  console.log("Conventional answers:", conventionalAnswers.length);
  console.log("MCQ - correct:", mcqCorrect, "incorrect:", mcqIncorrect, "skipped:", mcqSkipped);
  console.log("Conventional - answered:", conventionalAnswered, "skipped:", conventionalSkipped);
  console.log("Attempt time_taken_seconds:", attempt.time_taken_seconds);
  if (conventionalAnswers.length > 0) {
    console.log("Conventional details:", conventionalAnswers.map(a => ({
      qId: a.question_id,
      fileUrl: a.answer_file_url ? "YES" : "NO",
      feedback: a.ai_feedback ? "YES" : "NO",
      marks: a.marks_obtained,
    })));
  }

  // Pie chart data - include conventional answered as a separate category
  const pieData = [
    { name: "Correct", value: mcqCorrect, color: "#2dd4bf" },
    { name: "Incorrect", value: mcqIncorrect, color: "#ef4444" },
    ...(conventionalAnswered > 0 ? [{ name: "Conv.", value: conventionalAnswered, color: "#60a5fa" }] : []),
    { name: "Skipped", value: skippedCount, color: "#a1a1aa" },
  ].filter(d => d.value > 0); // Only show non-zero values

  // Comparison data
  const comparisonData = [
    { name: "Your Score", value: score },
    { name: "Average", value: Math.round(averageScore) },
    { name: "Passing", value: test.passing_marks || 0 },
  ];

  const toggleQuestion = (id: number) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedQuestions(newExpanded);
  };

  // Handler for retrying AI analysis on failed questions
  const handleRetryAI = async (questionId: number, answerId: number) => {
    setRetryingQuestions(prev => new Set(prev).add(questionId));

    try {
      const response = await fetch('/api/retry-ai-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Refresh the page to show updated feedback
        window.location.reload();
      } else {
        console.error('Retry failed:', data.error);
        // Remove from retrying state so user can try again
        setRetryingQuestions(prev => {
          const next = new Set(prev);
          next.delete(questionId);
          return next;
        });
      }
    } catch (error) {
      console.error('Retry failed:', error);
      setRetryingQuestions(prev => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
    }
  };

  // If in review mode, show the review component
  if (reviewMode) {
    return (
      <div className="max-w-4xl mx-auto">
        <ReviewMode
          questions={userAnswers.map((ua) => ua.question)}
          userAnswers={userAnswers}
          mode={reviewMode}
          onClose={() => setReviewMode(null)}
        />
      </div>
    );
  }

  return (
      <div className="max-w-4xl mx-auto space-y-6">
      {/* Score Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "glass-card p-8 text-center",
          isPassed ? "border-primary/30" : "border-destructive/30"
        )}
      >
        <div className={cn(
          "w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center",
          isPassed ? "bg-primary/10" : "bg-destructive/10"
        )}>
          <Trophy className={cn(
            "w-10 h-10",
            isPassed ? "text-primary" : "text-destructive"
          )} />
        </div>

        <h1 className="text-2xl font-bold mb-1">{test.title}</h1>

        {attempt.attempt_number > 0 && (
          <p className="text-sm text-muted-foreground mb-2">
            Attempt #{attempt.attempt_number}
          </p>
        )}

        <div className={cn(
          "text-5xl font-bold mb-2",
          isPassed ? "text-primary" : "text-destructive"
        )}>
          {score}/{totalMarks}
        </div>

        <p className="text-xl text-muted-foreground mb-4">
          {percentage}% • {isPassed ? "Passed" : "Not Passed"}
        </p>

        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {formatTime(attempt.time_taken_seconds || 0)}
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-primary" />
            {correctCount} correct
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="w-4 h-4 text-destructive" />
            {incorrectCount} wrong
          </div>
        </div>

      </motion.div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6"
        >
          <h3 className="font-semibold mb-4">Performance Breakdown</h3>
          <div style={{ width: '100%', height: 200 }} className="flex justify-center">
            {isMounted && pieData.length > 0 ? (
              <PieChart width={340} height={200}>
                <Pie
                  data={pieData}
                  cx="55%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                {!isMounted ? "Loading chart..." : "No data available"}
              </div>
            )}
          </div>
        </motion.div>

        {/* Comparison Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6"
        >
          <h3 className="font-semibold mb-4">Score Comparison</h3>
          <div style={{ width: '100%', height: 200 }}>
            {isMounted ? (
              <BarChart width={320} height={200} data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} />
                <YAxis stroke="#a1a1aa" fontSize={12} domain={[0, totalMarks]} />
                <Tooltip
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="value" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Loading chart...
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Leaderboard */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Leaderboard
          testId={test.id}
          totalMarks={totalMarks}
          currentUserId={currentUserId}
        />
      </motion.div>

      {/* Question Review */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-6"
      >
        <Tabs defaultValue="all">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Question Review</h3>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="correct">Correct</TabsTrigger>
              <TabsTrigger value="incorrect">Incorrect</TabsTrigger>
            </TabsList>
          </div>

          {["all", "correct", "incorrect"].map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-4">
              {userAnswers
                .filter((answer) => {
                  if (tab === "all") return true;
                  // Only MCQs should appear in correct/incorrect tabs
                  // Conventional questions are graded on a spectrum, not right/wrong
                  if (answer.question.type === "conventional") return false;
                  if (tab === "correct") return answer.is_correct;
                  return answer.user_answer && !answer.is_correct;
                })
                // Sort: questions with proper AI feedback first, fallback/unavailable last
                .sort((a, b) => {
                  const aHasProperFeedback = a.ai_feedback &&
                    !(a.ai_feedback as unknown as MCQFeedback & { aiUnavailable?: boolean }).aiUnavailable &&
                    !(a.ai_feedback as unknown as MCQFeedback).explanation?.includes("being generated");
                  const bHasProperFeedback = b.ai_feedback &&
                    !(b.ai_feedback as unknown as MCQFeedback & { aiUnavailable?: boolean }).aiUnavailable &&
                    !(b.ai_feedback as unknown as MCQFeedback).explanation?.includes("being generated");

                  if (aHasProperFeedback && !bHasProperFeedback) return -1;
                  if (!aHasProperFeedback && bHasProperFeedback) return 1;
                  return 0; // maintain original order for same category
                })
                .map((answer, index) => {
                  const question = answer.question;
                  const isExpanded = expandedQuestions.has(answer.id);
                  const options: QuestionOption[] = question.type === "mcq"
                    ? (question.options as QuestionOption[]) || []
                    : [];

                  return (
                    <div
                      key={answer.id}
                      className="border border-border rounded-lg overflow-hidden"
                    >
                      <button
                        className="w-full p-4 flex items-center gap-4 hover:bg-secondary/30 transition-colors"
                        onClick={() => toggleQuestion(answer.id)}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                          question.type === "conventional"
                            ? answer.answer_file_url
                              ? (answer.marks_obtained ?? 0) > 0
                                ? "bg-primary/10 text-primary"
                                : "bg-amber-500/10 text-amber-500"
                              : "bg-muted text-muted-foreground"
                            : answer.is_correct
                              ? "bg-primary/10 text-primary"
                              : answer.user_answer
                                ? "bg-destructive/10 text-destructive"
                                : "bg-muted text-muted-foreground"
                        )}>
                          {question.type === "conventional" ? (
                            answer.answer_file_url ? (
                              (answer.marks_obtained ?? 0) > 0 ? (
                                <CheckCircle className="w-5 h-5" />
                              ) : (
                                <FileText className="w-5 h-5" />
                              )
                            ) : (
                              <MinusCircle className="w-5 h-5" />
                            )
                          ) : answer.is_correct ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : answer.user_answer ? (
                            <XCircle className="w-5 h-5" />
                          ) : (
                            <MinusCircle className="w-5 h-5" />
                          )}
                        </div>

                        <div className="flex-1 text-left">
                          <p className="line-clamp-1">{question.content}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {question.marks} marks
                            </Badge>
                            {answer.marks_obtained !== 0 && (
                              <span className={cn(
                                "text-xs",
                                answer.marks_obtained > 0 ? "text-primary" : "text-destructive"
                              )}>
                                {answer.marks_obtained > 0 ? "+" : ""}{answer.marks_obtained}
                              </span>
                            )}
                          </div>
                        </div>

                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-border bg-secondary/20">
                          <div className="pt-4">
                            <p className="font-medium mb-4">{question.content}</p>

                            {question.type === "mcq" && (
                              <>
                                <div className="space-y-2 mb-4">
                                  {options.map((option) => {
                                    const isCorrect = option.id === question.correct_answer;
                                    const isSelected = option.id === answer.user_answer;

                                    return (
                                      <div
                                        key={option.id}
                                        className={cn(
                                          "p-3 rounded-lg border",
                                          isCorrect
                                            ? "border-primary bg-primary/10"
                                            : isSelected
                                            ? "border-destructive bg-destructive/10"
                                            : "border-border"
                                        )}
                                      >
                                        <div className="flex items-center gap-2">
                                          {isCorrect && <CheckCircle className="w-4 h-4 text-primary" />}
                                          {isSelected && !isCorrect && (
                                            <XCircle className="w-4 h-4 text-destructive" />
                                          )}
                                          <span>{option.text}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* AI Feedback for MCQ */}
                                {answer.ai_feedback && isMCQFeedback(answer.ai_feedback) && (
                                  <div className="space-y-3">
                                    {/* Notice when AI analysis was unavailable - with retry button */}
                                    {(answer.ai_feedback as MCQFeedback & { aiUnavailable?: boolean }).aiUnavailable && (
                                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-xs text-amber-600 flex items-center gap-1.5">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            AI analysis temporarily unavailable.
                                          </p>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-xs px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-500/20"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRetryAI(question.id, answer.id);
                                            }}
                                            disabled={retryingQuestions.has(question.id)}
                                          >
                                            {retryingQuestions.has(question.id) ? (
                                              <>
                                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                Retrying...
                                              </>
                                            ) : (
                                              <>
                                                <RotateCcw className="w-3 h-3 mr-1" />
                                                Retry
                                              </>
                                            )}
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                                      <div className="flex items-start gap-2">
                                        <Lightbulb className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                        <div>
                                          <p className="text-sm font-medium text-primary mb-1">Why this is correct</p>
                                          <p className="text-sm">{answer.ai_feedback.explanation}</p>
                                        </div>
                                      </div>
                                    </div>

                                    {!answer.is_correct && answer.ai_feedback.userChoiceExplanation && (
                                      <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                                        <div className="flex items-start gap-2">
                                          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                                          <div>
                                            <p className="text-sm font-medium text-destructive mb-1">Why your choice was incorrect</p>
                                            <p className="text-sm">{answer.ai_feedback.userChoiceExplanation}</p>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Explanations for all incorrect options */}
                                    {answer.ai_feedback.incorrectOptionsExplanation && Object.keys(answer.ai_feedback.incorrectOptionsExplanation).length > 0 && (
                                      <div className="p-3 rounded-lg bg-muted/50 border border-border">
                                        <div className="flex items-start gap-2 mb-3">
                                          <ListX className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                          <p className="text-sm font-medium">Why the other options are incorrect</p>
                                        </div>
                                        <div className="space-y-2 pl-6">
                                          {Object.entries(answer.ai_feedback.incorrectOptionsExplanation).map(([optionId, explanation]) => {
                                            const option = (question.options as QuestionOption[])?.find(o => o.id === optionId);
                                            if (!option) return null;
                                            return (
                                              <div key={optionId} className="text-sm">
                                                <span className="font-medium text-muted-foreground">{optionId.toUpperCase()}.</span>{" "}
                                                <span className="text-muted-foreground/80">{option.text}:</span>{" "}
                                                <span>{explanation}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}

                            {question.type === "conventional" && (
                              <div className="space-y-4">
                                {/* Uploaded file preview */}
                                {answer.answer_file_url && (
                                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30">
                                    <FileImage className="w-5 h-5 text-muted-foreground" />
                                    <span className="text-sm flex-1">Your uploaded answer</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      asChild
                                    >
                                      <a
                                        href={answer.answer_file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <ExternalLink className="w-4 h-4 mr-1" />
                                        View
                                      </a>
                                    </Button>
                                  </div>
                                )}

                                {!answer.answer_file_url && (
                                  <div className="p-3 rounded-lg border border-border bg-secondary/30">
                                    <p className="text-sm text-muted-foreground">No answer submitted</p>
                                  </div>
                                )}

                                {/* AI Feedback for Conventional */}
                                {answer.ai_feedback && isConventionalFeedback(answer.ai_feedback) && (
                                  <div className="space-y-4">
                                    {/* Score breakdown */}
                                    <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                                      <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-medium flex items-center gap-2">
                                          <BarChart3 className="w-4 h-4" />
                                          AI Evaluation
                                        </h4>
                                        <Badge variant={answer.marks_obtained >= question.marks * 0.6 ? "default" : "secondary"}>
                                          {answer.marks_obtained}/{question.marks} marks
                                        </Badge>
                                      </div>

                                      {/* Score breakdown bars */}
                                      <div className="space-y-3">
                                        <div>
                                          <div className="flex justify-between text-xs mb-1">
                                            <span>Content (40%)</span>
                                            <span>{answer.ai_feedback.contentScore}/{Math.round(question.marks * 0.4)}</span>
                                          </div>
                                          <Progress
                                            value={(answer.ai_feedback.contentScore / Math.round(question.marks * 0.4)) * 100}
                                            className="h-2"
                                          />
                                        </div>
                                        <div>
                                          <div className="flex justify-between text-xs mb-1">
                                            <span>Structure (30%)</span>
                                            <span>{answer.ai_feedback.structureScore}/{Math.round(question.marks * 0.3)}</span>
                                          </div>
                                          <Progress
                                            value={(answer.ai_feedback.structureScore / Math.round(question.marks * 0.3)) * 100}
                                            className="h-2"
                                          />
                                        </div>
                                        <div>
                                          <div className="flex justify-between text-xs mb-1">
                                            <span>Presentation (20%)</span>
                                            <span>{answer.ai_feedback.presentationScore}/{Math.round(question.marks * 0.2)}</span>
                                          </div>
                                          <Progress
                                            value={(answer.ai_feedback.presentationScore / Math.round(question.marks * 0.2)) * 100}
                                            className="h-2"
                                          />
                                        </div>
                                        <div>
                                          <div className="flex justify-between text-xs mb-1">
                                            <span>Language (10%)</span>
                                            <span>{answer.ai_feedback.languageScore}/{Math.round(question.marks * 0.1)}</span>
                                          </div>
                                          <Progress
                                            value={(answer.ai_feedback.languageScore / Math.round(question.marks * 0.1)) * 100}
                                            className="h-2"
                                          />
                                        </div>
                                      </div>

                                      {/* Word count status */}
                                      {question.word_limit && (
                                        <div className="mt-3 pt-3 border-t border-border">
                                          <div className="flex items-center gap-2 text-sm">
                                            <FileText className="w-4 h-4" />
                                            <span>Word count: ~{answer.ai_feedback.wordCountEstimate}</span>
                                            <Badge
                                              variant={answer.ai_feedback.wordLimitStatus === "within" ? "default" : "destructive"}
                                              className="text-xs"
                                            >
                                              {answer.ai_feedback.wordLimitStatus === "within" && "Within limit"}
                                              {answer.ai_feedback.wordLimitStatus === "over" && "Over limit"}
                                              {answer.ai_feedback.wordLimitStatus === "under" && "Under limit"}
                                            </Badge>
                                            <span className="text-muted-foreground">(limit: {question.word_limit})</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Overall feedback */}
                                    <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                                      <p className="text-sm font-medium mb-2">Overall Feedback</p>
                                      <p className="text-sm text-muted-foreground">{answer.ai_feedback.feedback}</p>
                                    </div>

                                    {/* Strengths and Improvements */}
                                    <div className="grid md:grid-cols-2 gap-3">
                                      {answer.ai_feedback.strengths.length > 0 && (
                                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                                          <p className="text-sm font-medium text-primary mb-2 flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4" />
                                            Strengths
                                          </p>
                                          <ul className="space-y-1">
                                            {answer.ai_feedback.strengths.map((strength, i) => (
                                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                                <span className="text-primary">•</span>
                                                {strength}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}

                                      {answer.ai_feedback.improvements.length > 0 && (
                                        <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                                          <p className="text-sm font-medium text-orange-500 mb-2 flex items-center gap-2">
                                            <Lightbulb className="w-4 h-4" />
                                            Areas for Improvement
                                          </p>
                                          <ul className="space-y-1">
                                            {answer.ai_feedback.improvements.map((improvement, i) => (
                                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                                <span className="text-orange-500">•</span>
                                                {improvement}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>

                                    {/* Section-wise Specific Feedback */}
                                    {answer.ai_feedback.sectionFeedback && answer.ai_feedback.sectionFeedback.length > 0 && (
                                      <div className="p-4 rounded-lg border border-border bg-secondary/20">
                                        <p className="text-sm font-medium mb-3 flex items-center gap-2">
                                          <FileText className="w-4 h-4" />
                                          Specific Feedback
                                        </p>
                                        <div className="space-y-4">
                                          {answer.ai_feedback.sectionFeedback.map((section, i) => (
                                            <div key={i} className="pl-3 border-l-2 border-primary/30">
                                              <p className="text-sm font-medium text-foreground mb-2">{section.section}</p>
                                              {section.positive && (
                                                <div className="text-sm text-muted-foreground mb-1">
                                                  <span className="text-primary font-medium">Positive: </span>
                                                  {section.positive}
                                                </div>
                                              )}
                                              {section.improve && (
                                                <div className="text-sm text-muted-foreground">
                                                  <span className="text-orange-500 font-medium">Improve: </span>
                                                  {section.improve}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Model Conclusion */}
                                    {answer.ai_feedback.modelConclusion && (
                                      <div className="p-4 rounded-lg border border-blue-500/30 bg-blue-500/5">
                                        <p className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-2">
                                          <Lightbulb className="w-4 h-4" />
                                          Model Conclusion
                                        </p>
                                        <p className="text-sm text-muted-foreground italic">
                                          {answer.ai_feedback.modelConclusion}
                                        </p>
                                      </div>
                                    )}

                                    {/* Extracted text preview (collapsed by default) */}
                                    {answer.ai_feedback.extractedText && (
                                      <details className="p-3 rounded-lg border border-border bg-secondary/20">
                                        <summary className="text-sm font-medium cursor-pointer">
                                          View Extracted Text
                                        </summary>
                                        <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                                          {answer.ai_feedback.extractedText}
                                        </p>
                                      </details>
                                    )}
                                  </div>
                                )}

                                {/* Grading status if still pending or failed */}
                                {answer.grading_status === "pending" && (
                                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                    <p className="text-sm text-yellow-600 flex items-center gap-2">
                                      <Clock className="w-4 h-4" />
                                      AI evaluation in progress...
                                    </p>
                                  </div>
                                )}

                                {answer.grading_status === "failed" && (
                                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
                                    <p className="text-sm text-destructive flex items-center gap-2">
                                      <AlertCircle className="w-4 h-4 shrink-0" />
                                      {(answer.ai_feedback as { message?: string })?.message ||
                                        "Failed to evaluate this answer. Please ensure the uploaded image is clear and readable."}
                                    </p>
                                    {(answer.ai_feedback as { errorCategory?: string })?.errorCategory && (
                                      <p className="text-xs text-muted-foreground">
                                        Error type: {(answer.ai_feedback as { errorCategory?: string })?.errorCategory}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Fallback to question explanation if no AI feedback */}
                            {question.explanation && !answer.ai_feedback && (
                              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                                <p className="text-sm font-medium text-primary mb-1">Explanation</p>
                                <p className="text-sm">{question.explanation}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </TabsContent>
          ))}
        </Tabs>
      </motion.div>

      {/* Review Mode Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-4"
      >
        <h3 className="font-semibold mb-3">Study & Review</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setReviewMode("wrong")}
            disabled={incorrectCount === 0}
          >
            <ListX className="w-4 h-4 mr-2" />
            Review Wrong Answers ({incorrectCount})
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setReviewMode("all")}
          >
            <Eye className="w-4 h-4 mr-2" />
            Review All Questions
          </Button>
        </div>
      </motion.div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button variant="outline" className="flex-1" asChild>
          <Link href="/tests">
            <Home className="w-4 h-4 mr-2" />
            Back to Tests
          </Link>
        </Button>
        <Button variant="outline" className="flex-1" asChild>
          <Link href={`/test-analytics/${test.id}`}>
            <BarChart3 className="w-4 h-4 mr-2" />
            View Analytics
          </Link>
        </Button>
        <Button className="flex-1 primary-glow" asChild>
          <Link href={`/test/${test.id}`}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Retake Test
          </Link>
        </Button>
      </div>
    </div>
  );
}
