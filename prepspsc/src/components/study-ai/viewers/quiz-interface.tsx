"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AIGenerationRow } from "@/types/database.types";
import type { QuizOutput, QuizQuestion } from "@/types/study-ai.types";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  HelpCircle,
  CheckCircle,
  XCircle,
  Trophy,
  Bookmark,
  BookmarkCheck,
  Loader2,
} from "lucide-react";

interface QuizViewerProps {
  generation: AIGenerationRow;
  goalText: string;
}

interface QuizState {
  answers: Record<string, string>;
  submitted: boolean;
}

export function QuizViewer({ generation, goalText }: QuizViewerProps) {
  const searchParams = useSearchParams();
  const fromSaved = searchParams.get("from") === "saved";
  const data = generation.output_data as unknown as QuizOutput;
  const questions = data.questions || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [state, setState] = useState<QuizState>({
    answers: {},
    submitted: false,
  });
  const reviewRef = useRef<HTMLDivElement>(null);
  const [isSaved, setIsSaved] = useState(generation.is_saved);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/study-ai/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId: generation.id,
          isSaved: !isSaved,
        }),
      });
      if (response.ok) {
        setIsSaved(!isSaved);
      }
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const currentQuestion = questions[currentIndex];
  const selectedAnswer = state.answers[currentQuestion?.id];
  const isCorrect = selectedAnswer === currentQuestion?.correctOptionId;
  const progress = ((currentIndex + 1) / questions.length) * 100;

  // Calculate score
  const correctCount = questions.filter(
    (q) => state.answers[q.id] === q.correctOptionId
  ).length;
  const score = Math.round((correctCount / questions.length) * 100);

  const handleSelectAnswer = (optionId: string) => {
    if (state.submitted) return;
    setState((prev) => ({
      ...prev,
      answers: { ...prev.answers, [currentQuestion.id]: optionId },
    }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSubmit = () => {
    setState((prev) => ({ ...prev, submitted: true }));
  };

  const handleReset = () => {
    setState({ answers: {}, submitted: false });
    setCurrentIndex(0);
  };

  const answeredCount = Object.keys(state.answers).length;

  if (!questions.length) {
    return (
      <div className="widget-glass p-12 rounded-2xl text-center">
        <HelpCircle className="w-12 h-12 text-white/30 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No questions</h3>
        <p className="text-white/50">This quiz doesn't have any questions.</p>
      </div>
    );
  }

  // Results screen
  if (state.submitted) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Link
            href={fromSaved ? "/study-ai?tab=saved" : `/study-ai/goals/${generation.goal_id}`}
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">{fromSaved ? "Back to Saved" : "Back to Goal"}</span>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="widget-glass p-8 rounded-2xl text-center"
        >
          <Trophy className={cn(
            "w-16 h-16 mx-auto mb-4",
            score >= 80 ? "text-yellow-400" : score >= 60 ? "text-blue-400" : "text-white/40"
          )} />
          <h2 className="text-2xl font-bold text-white mb-2">Quiz Complete!</h2>
          <p className="text-4xl font-bold text-white mb-2">{score}%</p>
          <p className="text-white/60">
            You got {correctCount} out of {questions.length} correct
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={handleReset} variant="outline">
              <RotateCcw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button onClick={() => reviewRef.current?.scrollIntoView({ behavior: "smooth" })} className="bg-purple-600 hover:bg-purple-700">
              Review Answers
            </Button>
          </div>
        </motion.div>

        {/* Question Review */}
        <div ref={reviewRef} className="space-y-4">
          {questions.map((q, index) => {
            const userAnswer = state.answers[q.id];
            const isQCorrect = userAnswer === q.correctOptionId;

            return (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "widget-glass p-4 rounded-xl border",
                  isQCorrect ? "border-green-500/30" : "border-red-500/30"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    isQCorrect ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  )}>
                    {isQCorrect ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white font-medium mb-2">
                      {index + 1}. {q.question}
                    </p>
                    {!isQCorrect && userAnswer && (
                      <p className="text-xs text-red-400 mb-1">
                        Your answer: {q.options.find(o => o.id === userAnswer)?.text}
                      </p>
                    )}
                    <p className="text-xs text-green-400 mb-2">
                      Correct: {q.options.find(o => o.id === q.correctOptionId)?.text}
                    </p>
                    <p className="text-xs text-white/50">{q.explanation}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Back Button */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Link
          href={`/study-ai/goals/${generation.goal_id}`}
          className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Goal</span>
        </Link>
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="widget-glass p-4 rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">{data.title || "Quiz"}</h1>
            <p className="text-sm text-white/60">{goalText}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className={cn(isSaved && "text-yellow-400")}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : isSaved ? (
                <BookmarkCheck className="w-4 h-4 mr-1" />
              ) : (
                <Bookmark className="w-4 h-4 mr-1" />
              )}
              {isSaved ? "Saved" : "Save"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>Question {currentIndex + 1} of {questions.length}</span>
            <span>{answeredCount} answered</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </motion.div>

      {/* Question */}
      <motion.div
        key={currentIndex}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="widget-glass p-6 rounded-2xl"
      >
        <p className="text-lg text-white font-medium mb-6">
          {currentIndex + 1}. {currentQuestion.question}
        </p>

        <div className="space-y-3">
          {currentQuestion.options.map((option) => (
            <button
              key={option.id}
              onClick={() => handleSelectAnswer(option.id)}
              className={cn(
                "w-full p-4 rounded-xl text-left transition-all border",
                selectedAnswer === option.id
                  ? "bg-purple-500/20 border-purple-500/50 text-white"
                  : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
              )}
            >
              <span className="font-medium mr-2">{option.id.toUpperCase()}.</span>
              {option.text}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center justify-between"
      >
        <Button
          variant="ghost"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="text-white/60 hover:text-white"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          Previous
        </Button>

        {currentIndex === questions.length - 1 ? (
          <Button
            onClick={handleSubmit}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            Submit Quiz {answeredCount < questions.length && `(${answeredCount}/${questions.length})`}
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Next
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        )}
      </motion.div>

      {/* Question Navigation */}
      <div className="flex justify-center gap-2 flex-wrap">
        {questions.map((q, index) => (
          <button
            key={q.id}
            onClick={() => setCurrentIndex(index)}
            className={cn(
              "w-8 h-8 rounded-lg text-sm font-medium transition-all",
              index === currentIndex
                ? "bg-purple-500 text-white"
                : state.answers[q.id]
                ? "bg-purple-500/30 text-purple-300"
                : "bg-white/10 text-white/50 hover:bg-white/20"
            )}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
