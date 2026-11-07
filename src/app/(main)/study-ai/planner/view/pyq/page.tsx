"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  GraduationCap,
  CheckCircle2,
  XCircle,
  Bookmark,
  BookmarkCheck,
  Loader2,
  Trophy,
  RotateCcw,
  Flame,
  FileText,
  Plus,
  Award,
  Bot,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PYQQuestion {
  id: string;
  question: string;
  options: { id: string; text: string; explanation?: string }[];
  correctOptionId: string;
  explanation?: string;
  examReference?: string; // e.g., "UPSC CSE 2023"
  highYield?: boolean;
  source?: "real" | "ai"; // NEW: indicates if question is from real PYQ database
  dbId?: string; // Database ID for "Generate More" exclusion
}

interface PlannerPYQData {
  title: string;
  questions: PYQQuestion[];
  subject: string;
  topics: string[];
  topicKey?: string;
  planId?: string;
  examType?: string; // NEW: needed for "Generate More"
  examDisplayName?: string; // e.g., "SPSC Under Secretary"
  notAvailable?: boolean;
  message?: string;
  realCount?: number; // NEW: count of real PYQs
  aiCount?: number; // NEW: count of AI-generated
  generationCount?: number; // NEW: how many times "Generate More" was clicked
}

// Clean up question text by removing metadata references
function cleanQuestionText(text: string): string {
  const emojiPrefixMatch = text.match(/^([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+\s*)/u);
  const emojiPrefix = emojiPrefixMatch ? emojiPrefixMatch[1] : "";
  let textWithoutEmoji = emojiPrefix ? text.slice(emojiPrefix.length) : text;

  const patternsToRemove = [
    /^(According to|Based on|As (mentioned|stated|described) in|Per|From|In) the (content|passage|text|metadata|source|material|'[^']+')[,:]?\s*/i,
    /^(According to|Based on) the '[^']+' (section|metadata)[,:]?\s*/i,
    /^The (content|passage|text) (states|mentions|describes|indicates) that\s*/i,
    /^(According to|Based on|As (mentioned|stated|described) in|Per|From|In) the .{1,50}(video|channel|youtube|description|transcript)[,:]?\s*/i,
    /^(According to|Based on) .{1,50}'s (video|channel)[,:]?\s*/i,
    /^The video (states|mentions|describes|indicates|shows|explains) that\s*/i,
    /^In the video[,:]?\s*/i,
    /^As (seen|shown|mentioned|described|explained) in the video[,:]?\s*/i,
    /^(According to|Based on) the [^,]{1,60}[,:]?\s*/i,
  ];

  let cleaned = textWithoutEmoji;
  for (const pattern of patternsToRemove) {
    cleaned = cleaned.replace(pattern, "");
  }

  if (cleaned && cleaned[0] && /[a-z]/.test(cleaned[0])) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return emojiPrefix ? `${emojiPrefix}${cleaned}` : cleaned;
}

const MAX_GENERATIONS = 5; // Allow 5 additional generations (40 more questions max)
const QUESTIONS_PER_PAGE = 8;

export default function PlannerPYQViewerPage() {
  const [data, setData] = useState<PlannerPYQData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [generationCount, setGenerationCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage]);

  useEffect(() => {
    try {
      const storedData = sessionStorage.getItem("planner-pyq-data");
      if (storedData) {
        const parsed = JSON.parse(storedData);
        if (parsed.questions && Array.isArray(parsed.questions)) {
          parsed.questions = parsed.questions.map((q: any, index: number) => ({
            ...q,
            id: String(q.id ?? index + 1),
            question: cleanQuestionText(q.question || ""),
            correctOptionId: String(q.correctOptionId ?? "a"),
            options: Array.isArray(q.options)
              ? q.options.map((opt: any, optIndex: number) => ({
                  ...opt,
                  id: String(opt.id ?? String.fromCharCode(97 + optIndex)),
                }))
              : [],
          }));
        }
        setData(parsed);
        // Restore generation count from sessionStorage
        if (parsed.generationCount) {
          setGenerationCount(parsed.generationCount);
        }
      } else {
        setError("No PYQ data found. Please generate PYQs first.");
      }
    } catch (err) {
      console.error("Failed to load PYQ data:", err);
      setError("Failed to load PYQ data.");
    }
  }, []);

  const handleSave = async () => {
    if (!data || isSaving || isSaved) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/study-ai/save-planner-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          generationType: "pyq",
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
        toast.success("PYQs saved! Find them in Study with AI → Saved section.");
      } else {
        const result = await response.json();
        toast.error(result.error || "Failed to save");
      }
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save PYQs");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateMore = async () => {
    if (!data || isGeneratingMore || generationCount >= MAX_GENERATIONS) return;

    setIsGeneratingMore(true);
    try {
      const supabase = createClient();

      // Get existing question IDs to exclude duplicates
      const excludeIds = data.questions
        .filter(q => q.dbId)
        .map(q => q.dbId as string);

      // Call edge function using supabase client (handles auth automatically)
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "generate-topic-content",
        {
          body: {
            subject: data.subject,
            topics: data.topics,
            examType: data.examType || "upsc",
            examDisplayName: data.examDisplayName || undefined,
            generationType: "pyq",
            questionOffset: data.questions.length,
            excludeQuestionIds: excludeIds,
          },
        }
      );

      if (fnError) {
        throw new Error(fnError.message || "Failed to generate more questions");
      }

      const newQuestions = (result?.content?.questions || []).map((q: any, i: number) => ({
        ...q,
        id: String(data.questions.length + i + 1),
        question: cleanQuestionText(q.question || ""),
      }));

      if (newQuestions.length === 0) {
        toast.info("No more questions available for this topic");
        return;
      }

      // Update data with new questions
      const updatedData: PlannerPYQData = {
        ...data,
        questions: [...data.questions, ...newQuestions],
        generationCount: generationCount + 1,
        realCount: (data.realCount || 0) + (result?.content?.realCount || 0),
        aiCount: (data.aiCount || 0) + (result?.content?.aiCount || 0),
      };

      setData(updatedData);
      setGenerationCount(prev => prev + 1);

      // Navigate to the new page with the freshly added questions
      const newPage = Math.ceil(updatedData.questions.length / QUESTIONS_PER_PAGE) - 1;
      setCurrentPage(newPage);

      // Persist to sessionStorage
      sessionStorage.setItem("planner-pyq-data", JSON.stringify(updatedData));

      toast.success(`Added ${newQuestions.length} more questions! Showing page ${newPage + 1}.`);
    } catch (err: any) {
      console.error("Generate more error:", err);
      toast.error(err.message || "Failed to generate more questions");
    } finally {
      setIsGeneratingMore(false);
    }
  };

  const handleSelectAnswer = (questionId: string, optionId: string) => {
    if (showResults) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleSubmit = (forceSubmit = false) => {
    if (!data) return;
    const unanswered = data.questions.filter((q) => !answers[q.id]);

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

  const getHighYieldCount = () => {
    if (!data) return 0;
    return data.questions.filter(q => q.highYield).length;
  };

  const getRealCount = () => {
    if (!data) return 0;
    return data.questions.filter(q => q.source === "real").length;
  };

  const getAICount = () => {
    if (!data) return 0;
    return data.questions.filter(q => q.source === "ai" || !q.source).length;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-white/60 mb-4">{error}</p>
          <Button asChild className="bg-orange-600 hover:bg-orange-700">
            <Link href={getBackUrl()}>Go Back</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
      </div>
    );
  }

  // Handle case when PYQs are not available for this topic
  if (data.notAvailable || !data.questions || data.questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a12] p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <Link
              href={getBackUrl()}
              className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Study Planner</span>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 backdrop-blur-sm border border-white/10 p-8 rounded-2xl text-center"
          >
            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">PYQs Not Available</h2>
            <p className="text-white/60 mb-6 max-w-md mx-auto">
              {data.message || "Previous year questions are not available for this topic. This topic may not be commonly tested in UPSC examinations, or it falls under skill-based/practical areas."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10">
                <Link href={getBackUrl()}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Planner
                </Link>
              </Button>
              <Button asChild className="bg-orange-600 hover:bg-orange-700">
                <Link href="/study-ai?tab=planner">Try Another Topic</Link>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl"
          >
            <p className="text-sm text-blue-300">
              <span className="font-medium">Tip:</span> For topics like mental conditioning, relaxation techniques, or practical skills, try using the <strong>Quiz</strong> or <strong>Flashcards</strong> options instead for better learning outcomes.
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  const score = getScore();
  const highYieldCount = getHighYieldCount();
  const realCount = getRealCount();
  const aiCount = getAICount();

  // Pagination
  const totalPages = Math.ceil(data.questions.length / QUESTIONS_PER_PAGE);
  const paginatedQuestions = data.questions.slice(
    currentPage * QUESTIONS_PER_PAGE,
    (currentPage + 1) * QUESTIONS_PER_PAGE
  );
  const pageStartIndex = currentPage * QUESTIONS_PER_PAGE;

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
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{data.title}</h1>
                <p className="text-sm text-white/60">{data.subject} - {data.topics?.join(", ")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Real/AI Count Summary */}
              {(realCount > 0 || aiCount > 0) && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 text-white/70 text-xs">
                  {realCount > 0 && (
                    <span className="flex items-center gap-1 text-amber-400">
                      <Award className="w-3 h-3" />
                      {realCount} Real
                    </span>
                  )}
                  {realCount > 0 && aiCount > 0 && <span className="text-white/30">+</span>}
                  {aiCount > 0 && (
                    <span className="flex items-center gap-1 text-blue-400">
                      <Bot className="w-3 h-3" />
                      {aiCount} AI
                    </span>
                  )}
                </div>
              )}
              {highYieldCount > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs">
                  <Flame className="w-3 h-3" />
                  <span>{highYieldCount} High Yield</span>
                </div>
              )}
              {showResults && (
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Retry
                </Button>
              )}
              {/* Generate More Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateMore}
                disabled={isGeneratingMore || generationCount >= MAX_GENERATIONS || showResults}
                className={cn(
                  "gap-2 border-white/20 text-white hover:bg-white/10",
                  generationCount >= MAX_GENERATIONS && "opacity-50"
                )}
              >
                {isGeneratingMore ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {isGeneratingMore ? "Generating..." : `More (${generationCount}/${MAX_GENERATIONS})`}
              </Button>
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
                <span className="text-orange-400">Score: {score.percentage}%</span>
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
                    : "bg-orange-500"
                )}
                initial={{ width: 0 }}
                animate={{ width: `${(Object.keys(answers).length / data.questions.length) * 100}%` }}
              />
            </div>
          </div>
        </motion.div>

        {/* PYQ Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl"
        >
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-orange-300 font-medium">Previous Year Questions</p>
              <p className="text-xs text-white/60 mt-1">
                These questions are based on actual exam patterns from UPSC Civil Services, State PSC, CDS, and other competitive examinations.
                Questions marked with 🔥 are high-yield topics frequently asked in exams. Check the exam reference tag on each question.
              </p>
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
                ? "Excellent! You're well-prepared for UPSC."
                : score.percentage >= 50
                ? "Good progress! Review the explanations carefully."
                : "Keep practicing! Focus on the high-yield topics."}
            </p>
          </motion.div>
        )}

        {/* Page indicator */}
        {totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-2 text-sm text-white/60"
          >
            <span>Page {currentPage + 1} of {totalPages}</span>
            <span className="text-white/30">|</span>
            <span>Questions {pageStartIndex + 1}-{Math.min(pageStartIndex + QUESTIONS_PER_PAGE, data.questions.length)} of {data.questions.length}</span>
          </motion.div>
        )}

        {/* Questions */}
        <div className="space-y-4">
          {paginatedQuestions.map((question, qIndex) => {
            const globalIndex = pageStartIndex + qIndex;
            const selectedAnswer = answers[question.id];
            const isCorrect = selectedAnswer === question.correctOptionId;
            const showAnswer = showResults;

            return (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: qIndex * 0.05 }}
                className={cn(
                  "bg-white/5 backdrop-blur-sm border p-6 rounded-2xl",
                  question.highYield
                    ? "border-amber-500/30"
                    : "border-white/10"
                )}
              >
                {/* Question Header with Badges */}
                <div className="flex items-start gap-3 mb-4">
                  <span className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0 text-sm font-semibold">
                    {globalIndex + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {/* Real/AI Source Badge */}
                      {question.source === "real" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/30 to-yellow-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30">
                          <Award className="w-3 h-3" />
                          REAL
                        </span>
                      ) : question.source === "ai" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                          <Bot className="w-3 h-3" />
                          AI
                        </span>
                      ) : null}
                      {question.highYield && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
                          <Flame className="w-3 h-3" />
                          High Yield
                        </span>
                      )}
                      {question.examReference && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                          <GraduationCap className="w-3 h-3" />
                          {question.examReference}
                        </span>
                      )}
                    </div>
                    <p className="text-white font-medium">{question.question}</p>
                  </div>
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
                            ? "bg-orange-500/20 border border-orange-500/30 text-white"
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

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-2"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="gap-1 border-white/20 text-white hover:bg-white/10"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                    currentPage === i
                      ? "bg-orange-500 text-white"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
              disabled={currentPage === totalPages - 1}
              className="gap-1 border-white/20 text-white hover:bg-white/10"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </motion.div>
        )}

        {/* Submit Button */}
        {!showResults && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              onClick={() => handleSubmit()}
              className="w-full py-6 text-lg bg-orange-600 hover:bg-orange-700"
              disabled={Object.keys(answers).length === 0}
            >
              Submit PYQ Practice ({Object.keys(answers).length}/{data.questions.length})
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
