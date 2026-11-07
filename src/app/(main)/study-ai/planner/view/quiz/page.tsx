"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Bookmark,
  BookmarkCheck,
  Loader2,
  Trophy,
  RotateCcw,
} from "lucide-react";

interface QuizQuestion {
  id: string;
  question: string;
  options: { id: string; text: string; explanation?: string }[];
  correctOptionId: string;
  explanation?: string;
}

interface PlannerQuizData {
  title: string;
  questions: QuizQuestion[];
  subject: string;
  topics: string[];
  topicKey?: string; // For back navigation to expanded topic
  planId?: string;
}

// Clean up question text by removing metadata references that AI sometimes adds
function cleanQuestionText(text: string): string {
  // First, extract any emoji prefix to preserve it (emoji + optional space)
  const emojiPrefixMatch = text.match(/^([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+\s*)/u);
  const emojiPrefix = emojiPrefixMatch ? emojiPrefixMatch[1] : "";
  let textWithoutEmoji = emojiPrefix ? text.slice(emojiPrefix.length) : text;

  const patternsToRemove = [
    // Generic content references
    /^(According to|Based on|As (mentioned|stated|described) in|Per|From|In) the (content|passage|text|metadata|source|material|'[^']+')[,:]?\s*/i,
    /^(According to|Based on) the '[^']+' (section|metadata)[,:]?\s*/i,
    /^The (content|passage|text) (states|mentions|describes|indicates) that\s*/i,

    // Video/channel specific references (catches "According to the SPSC Adda video description")
    /^(According to|Based on|As (mentioned|stated|described) in|Per|From|In) the .{1,50}(video|channel|youtube|description|transcript)[,:]?\s*/i,
    /^(According to|Based on) .{1,50}'s (video|channel)[,:]?\s*/i,
    /^The video (states|mentions|describes|indicates|shows|explains) that\s*/i,
    /^In the video[,:]?\s*/i,
    /^As (seen|shown|mentioned|described|explained) in the video[,:]?\s*/i,

    // More aggressive cleanup for any "According to the X" pattern
    /^(According to|Based on) the [^,]{1,60}[,:]?\s*/i,
  ];

  let cleaned = textWithoutEmoji;
  for (const pattern of patternsToRemove) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Capitalize first letter if needed
  if (cleaned && cleaned[0] && /[a-z]/.test(cleaned[0])) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // Re-add emoji prefix if it was present
  return emojiPrefix ? `${emojiPrefix}${cleaned}` : cleaned;
}

export default function PlannerQuizViewerPage() {
  const [data, setData] = useState<PlannerQuizData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    try {
      const storedData = sessionStorage.getItem("planner-quiz-data");
      if (storedData) {
        const parsed = JSON.parse(storedData);
        // Ensure all questions have string IDs and clean up question text
        if (parsed.questions && Array.isArray(parsed.questions)) {
          parsed.questions = parsed.questions.map((q: any, index: number) => ({
            ...q,
            id: String(q.id ?? index + 1),
            // Clean up question text - remove metadata references
            question: cleanQuestionText(q.question || ""),
            // Ensure correctOptionId is a string
            correctOptionId: String(q.correctOptionId ?? "a"),
            options: Array.isArray(q.options)
              ? q.options.map((opt: any, optIndex: number) => ({
                  ...opt,
                  id: String(opt.id ?? String.fromCharCode(97 + optIndex)), // fallback to 'a', 'b', 'c', etc.
                }))
              : [],
          }));
        }
        console.log("Quiz data loaded:", parsed.questions?.length, "questions");
        setData(parsed);
      } else {
        setError("No quiz data found. Please generate a quiz first.");
      }
    } catch (err) {
      console.error("Failed to load quiz data:", err);
      setError("Failed to load quiz data.");
    }
  }, []);

  // Debug: Log when answers change
  useEffect(() => {
    if (data) {
      console.log("Answers updated:", {
        answeredCount: Object.keys(answers).length,
        totalQuestions: data.questions.length,
        answers: answers,
        questionIds: data.questions.map(q => q.id),
      });
    }
  }, [answers, data]);

  const handleSave = async () => {
    if (!data || isSaving || isSaved) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/study-ai/save-planner-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          generationType: "quiz",
          outputData: {
            title: data.title,
            questions: data.questions,
          },
          subject: data.subject,
          topics: data.topics,
        }),
      });

      if (response.ok) {
        setIsSaved(true);
        toast.success("Quiz saved! Find it in Study with AI → Saved section.");
      } else {
        const result = await response.json();
        toast.error(result.error || "Failed to save");
      }
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save quiz");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectAnswer = (questionId: string, optionId: string) => {
    if (showResults) return;
    console.log("Answer selected:", { questionId, optionId });
    setAnswers((prev) => {
      const newAnswers = { ...prev, [questionId]: optionId };
      console.log("Answers state:", Object.keys(newAnswers).length, "/", data?.questions?.length);
      return newAnswers;
    });
  };

  const handleSubmit = (forceSubmit = false) => {
    console.log("Submit clicked. Data:", !!data, "Answers:", Object.keys(answers).length, "Questions:", data?.questions?.length);
    if (!data) return;
    const unanswered = data.questions.filter((q) => !answers[q.id]);
    console.log("Unanswered questions:", unanswered.map(q => q.id));

    // Allow submission with unanswered questions (with confirmation)
    if (unanswered.length > 0 && !forceSubmit) {
      toast(
        `You have ${unanswered.length} unanswered question${unanswered.length > 1 ? 's' : ''}. Submit anyway?`,
        {
          action: {
            label: "Submit",
            onClick: () => handleSubmit(true),
          },
          duration: 5000,
        }
      );
      return;
    }
    setShowResults(true);
  };

  const handleReset = () => {
    setAnswers({});
    setShowResults(false);
  };

  const getScore = () => {
    if (!data) return { correct: 0, total: 0, percentage: 0 };
    const correct = data.questions.filter((q) => answers[q.id] === q.correctOptionId).length;
    return {
      correct,
      total: data.questions.length,
      percentage: Math.round((correct / data.questions.length) * 100),
    };
  };

  const getBackUrl = () => {
    if (data?.topicKey) {
      const params = new URLSearchParams({ tab: "planner", expand: data.topicKey });
      if (data.planId) params.set("planId", data.planId);
      params.set("notebook", "true");
      return `/study-ai?${params.toString()}`;
    }
    return "/study-ai?tab=planner";
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-white/60 mb-4">{error}</p>
          <Button asChild className="bg-purple-600 hover:bg-purple-700">
            <Link href={getBackUrl()}>Go Back</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  const score = getScore();

  return (
    <div className="min-h-screen bg-[#0a0a12] p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Back Button */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <Link
            href={getBackUrl()}
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Study Planner</span>
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-2xl"
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{data.title}</h1>
                <p className="text-sm text-white/60">{data.subject} - {data.topics?.join(", ")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {showResults && (
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Retry
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={isSaving || isSaved}
                className={cn(
                  "gap-2 border-white/20 text-white hover:bg-white/10",
                  isSaved && "text-yellow-400 border-yellow-400/50"
                )}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isSaved ? (
                  <BookmarkCheck className="w-4 h-4" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
                {isSaved ? "Saved" : "Save"}
              </Button>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-white/50 mb-1">
              <span>{Object.keys(answers).length} of {data.questions.length} answered</span>
              {showResults && (
                <span className="text-purple-400">Score: {score.percentage}%</span>
              )}
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className={cn(
                  "h-full",
                  showResults
                    ? score.percentage >= 70
                      ? "bg-green-500"
                      : score.percentage >= 50
                      ? "bg-yellow-500"
                      : "bg-red-500"
                    : "bg-purple-500"
                )}
                initial={{ width: 0 }}
                animate={{ width: `${(Object.keys(answers).length / data.questions.length) * 100}%` }}
              />
            </div>
          </div>
        </motion.div>

        {/* Results Banner */}
        {showResults && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "p-6 rounded-2xl text-center",
              score.percentage >= 70
                ? "bg-green-500/10 border border-green-500/30"
                : score.percentage >= 50
                ? "bg-yellow-500/10 border border-yellow-500/30"
                : "bg-red-500/10 border border-red-500/30"
            )}
          >
            <Trophy
              className={cn(
                "w-12 h-12 mx-auto mb-3",
                score.percentage >= 70
                  ? "text-green-400"
                  : score.percentage >= 50
                  ? "text-yellow-400"
                  : "text-red-400"
              )}
            />
            <h2 className="text-2xl font-bold text-white mb-1">
              {score.correct} / {score.total} Correct
            </h2>
            <p className="text-white/60">
              {score.percentage >= 70
                ? "Great job! You've mastered this topic."
                : score.percentage >= 50
                ? "Good effort! Review the wrong answers."
                : "Keep studying! Review the material and try again."}
            </p>
          </motion.div>
        )}

        {/* Questions */}
        <div className="space-y-4">
          {data.questions.map((question, qIndex) => {
            const selectedAnswer = answers[question.id];
            const isCorrect = selectedAnswer === question.correctOptionId;
            const showAnswer = showResults;

            return (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: qIndex * 0.05 }}
                className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-2xl"
              >
                <div className="flex items-start gap-3 mb-4">
                  <span className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 text-sm font-semibold">
                    {qIndex + 1}
                  </span>
                  <p className="text-white font-medium">{question.question}</p>
                </div>

                <div className="space-y-2 ml-11">
                  {question.options.map((option) => {
                    const isSelected = selectedAnswer === option.id;
                    const isCorrectOption = option.id === question.correctOptionId;

                    return (
                      <button
                        key={option.id}
                        onClick={() => handleSelectAnswer(question.id, option.id)}
                        disabled={showResults}
                        className={cn(
                          "w-full p-3 rounded-xl text-left transition-all flex items-center gap-3",
                          showAnswer && isCorrectOption
                            ? "bg-green-500/20 border border-green-500/30 text-green-400"
                            : showAnswer && isSelected && !isCorrect
                            ? "bg-red-500/20 border border-red-500/30 text-red-400"
                            : isSelected
                            ? "bg-purple-500/20 border border-purple-500/30 text-white"
                            : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
                        )}
                      >
                        <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs shrink-0">
                          {option.id.toUpperCase()}
                        </span>
                        <span className="flex-1">{option.text}</span>
                        {showAnswer && isCorrectOption && (
                          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                        )}
                        {showAnswer && isSelected && !isCorrect && (
                          <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation */}
                {showAnswer && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-4 ml-11 space-y-2"
                  >
                    {/* Main explanation */}
                    {question.explanation && (
                      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <p className="text-sm text-blue-300">
                          <span className="font-medium">Explanation:</span> {question.explanation}
                        </p>
                      </div>
                    )}

                    {/* Per-option explanations */}
                    <div className="space-y-1.5">
                      {question.options.map((option) => {
                        const isCorrectOption = option.id === question.correctOptionId;
                        const isSelectedOption = selectedAnswer === option.id;
                        const hasExplanation = option.explanation;

                        if (!hasExplanation) return null;

                        return (
                          <div
                            key={`exp-${option.id}`}
                            className={cn(
                              "p-2 rounded-lg text-xs",
                              isCorrectOption
                                ? "bg-green-500/10 border border-green-500/20"
                                : isSelectedOption
                                ? "bg-red-500/10 border border-red-500/20"
                                : "bg-white/5 border border-white/10"
                            )}
                          >
                            <span
                              className={cn(
                                "font-medium",
                                isCorrectOption
                                  ? "text-green-400"
                                  : isSelectedOption
                                  ? "text-red-400"
                                  : "text-white/60"
                              )}
                            >
                              {option.id.toUpperCase()}) {isCorrectOption ? "✓ Correct" : "✗ Incorrect"}:
                            </span>{" "}
                            <span className="text-white/70">{option.explanation}</span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Submit Button */}
        {!showResults && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              onClick={() => handleSubmit()}
              className="w-full py-6 text-lg bg-purple-600 hover:bg-purple-700"
              disabled={Object.keys(answers).length === 0}
            >
              Submit Quiz ({Object.keys(answers).length}/{data.questions.length})
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
