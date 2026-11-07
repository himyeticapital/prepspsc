"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Lightbulb,
  FileText,
  Image,
} from "lucide-react";
import type { Question, QuestionOption, UserAnswer, MCQFeedback, ConventionalFeedback } from "@/types/database.types";

interface ReviewModeProps {
  questions: Question[];
  userAnswers: UserAnswer[];
  mode: "wrong" | "all"; // Review only wrong answers or all
  onClose: () => void;
}

interface ReviewQuestion {
  question: Question;
  userAnswer: UserAnswer;
}

export function ReviewMode({ questions, userAnswers, mode, onClose }: ReviewModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Filter questions based on mode
  const reviewQuestions: ReviewQuestion[] = questions
    .map((question) => {
      const userAnswer = userAnswers.find((ua) => ua.question_id === question.id);
      return userAnswer ? { question, userAnswer } : null;
    })
    .filter((item): item is ReviewQuestion => {
      if (!item) return false;
      if (mode === "all") return true;
      // For "wrong" mode, include incorrect MCQs and low-scored conventional
      if (item.question.type === "mcq") {
        return item.userAnswer.is_correct === false;
      } else {
        // For conventional, consider it "wrong" if scored less than 50%
        const score = item.userAnswer.marks_obtained || 0;
        const maxScore = item.question.marks;
        return score < maxScore * 0.5;
      }
    });

  if (reviewQuestions.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Great Job!</h2>
        <p className="text-muted-foreground mb-6">
          {mode === "wrong"
            ? "You don't have any wrong answers to review."
            : "No answers to review."}
        </p>
        <Button onClick={onClose}>Close Review</Button>
      </div>
    );
  }

  const currentItem = reviewQuestions[currentIndex];
  const { question, userAnswer } = currentItem;
  const progress = ((currentIndex + 1) / reviewQuestions.length) * 100;

  // Parse options for MCQ
  const options: QuestionOption[] =
    question.type === "mcq"
      ? (question.options as QuestionOption[]) || []
      : [];

  // Get feedback
  const feedback = userAnswer.ai_feedback as MCQFeedback | ConventionalFeedback | null;

  // Get user's selected option text for MCQ
  const getUserOptionText = () => {
    if (question.type !== "mcq" || !userAnswer.user_answer) return null;
    const option = options.find((o) => o.id === userAnswer.user_answer);
    return option?.text || userAnswer.user_answer;
  };

  // Get correct option text for MCQ
  const getCorrectOptionText = () => {
    if (question.type !== "mcq" || !question.correct_answer) return null;
    const option = options.find((o) => o.id === question.correct_answer);
    return option?.text || question.correct_answer;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">
              {mode === "wrong" ? "Review Wrong Answers" : "Review All Answers"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Question {currentIndex + 1} of {reviewQuestions.length}
            </p>
          </div>
          <Button variant="outline" onClick={onClose}>
            Exit Review
          </Button>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="glass-card p-6 space-y-6"
        >
          {/* Question Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {question.type === "mcq" ? "MCQ" : "Essay"}
              </Badge>
              <Badge variant="outline">{question.marks} marks</Badge>
            </div>
            <Badge
              variant={userAnswer.is_correct ? "default" : "destructive"}
              className={cn(
                userAnswer.is_correct === true && "bg-green-500",
                userAnswer.is_correct === false && "bg-red-500"
              )}
            >
              {question.type === "mcq" ? (
                userAnswer.is_correct ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Correct
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3 mr-1" />
                    Incorrect
                  </>
                )
              ) : (
                <>
                  Score: {userAnswer.marks_obtained || 0}/{question.marks}
                </>
              )}
            </Badge>
          </div>

          {/* Question Content */}
          <div className="text-lg">{question.content}</div>

          {/* MCQ Review */}
          {question.type === "mcq" && (
            <div className="space-y-4">
              {/* Options */}
              <div className="space-y-2">
                {options.map((option) => {
                  const isUserAnswer = option.id === userAnswer.user_answer;
                  const isCorrect = option.id === question.correct_answer;

                  return (
                    <div
                      key={option.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border",
                        isCorrect && "border-green-500 bg-green-500/10",
                        isUserAnswer && !isCorrect && "border-red-500 bg-red-500/10",
                        !isUserAnswer && !isCorrect && "border-border"
                      )}
                    >
                      <span className="font-medium w-6">{option.id.toUpperCase()}.</span>
                      <span className="flex-1">{option.text}</span>
                      {isCorrect && (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      )}
                      {isUserAnswer && !isCorrect && (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Your Answer vs Correct */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-xs text-red-500 mb-1">Your Answer</p>
                  <p className="font-medium">
                    {userAnswer.user_answer ? (
                      <>
                        {userAnswer.user_answer.toUpperCase()}. {getUserOptionText()}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Not answered</span>
                    )}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <p className="text-xs text-green-500 mb-1">Correct Answer</p>
                  <p className="font-medium">
                    {question.correct_answer?.toUpperCase()}. {getCorrectOptionText()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Conventional Review */}
          {question.type === "conventional" && feedback && "score" in feedback && (
            <div className="space-y-4">
              {/* Score Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2 rounded-lg bg-secondary/50 text-center">
                  <p className="text-xs text-muted-foreground">Content</p>
                  <p className="font-semibold">{(feedback as ConventionalFeedback).contentScore || 0}</p>
                </div>
                <div className="p-2 rounded-lg bg-secondary/50 text-center">
                  <p className="text-xs text-muted-foreground">Structure</p>
                  <p className="font-semibold">{(feedback as ConventionalFeedback).structureScore || 0}</p>
                </div>
                <div className="p-2 rounded-lg bg-secondary/50 text-center">
                  <p className="text-xs text-muted-foreground">Presentation</p>
                  <p className="font-semibold">{(feedback as ConventionalFeedback).presentationScore || 0}</p>
                </div>
                <div className="p-2 rounded-lg bg-secondary/50 text-center">
                  <p className="text-xs text-muted-foreground">Language</p>
                  <p className="font-semibold">{(feedback as ConventionalFeedback).languageScore || 0}</p>
                </div>
              </div>

              {/* Uploaded Answer */}
              {userAnswer.answer_file_url && (
                <div className="p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Image className="w-4 h-4" />
                    <span>Your Submitted Answer</span>
                  </div>
                  <a
                    href={userAnswer.answer_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-sm"
                  >
                    View uploaded image
                  </a>
                </div>
              )}

              {/* Feedback */}
              <div className="p-4 rounded-lg bg-secondary/50">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4" />
                  <span className="font-medium">AI Feedback</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {(feedback as ConventionalFeedback).feedback}
                </p>
              </div>

              {/* Strengths & Improvements */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(feedback as ConventionalFeedback).strengths && (feedback as ConventionalFeedback).strengths.length > 0 && (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                    <p className="text-xs text-green-500 mb-2 font-medium">Strengths</p>
                    <ul className="text-sm space-y-1">
                      {(feedback as ConventionalFeedback).strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(feedback as ConventionalFeedback).improvements && (feedback as ConventionalFeedback).improvements.length > 0 && (
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <p className="text-xs text-yellow-500 mb-2 font-medium">Areas for Improvement</p>
                    <ul className="text-sm space-y-1">
                      {(feedback as ConventionalFeedback).improvements.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Lightbulb className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Explanation */}
          {(question.explanation || (feedback && "explanation" in feedback)) && (
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-primary" />
                <span className="font-medium text-primary">Explanation</span>
              </div>
              <p className="text-sm">
                {question.explanation || (feedback as MCQFeedback)?.explanation}
              </p>
              {feedback && "userChoiceExplanation" in feedback && (feedback as MCQFeedback).userChoiceExplanation && (
                <p className="text-sm text-muted-foreground mt-2">
                  <span className="font-medium">Why your choice was wrong: </span>
                  {(feedback as MCQFeedback).userChoiceExplanation}
                </p>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>

        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} / {reviewQuestions.length}
        </span>

        {currentIndex === reviewQuestions.length - 1 ? (
          <Button onClick={onClose}>
            Finish Review
          </Button>
        ) : (
          <Button
            onClick={() => setCurrentIndex((prev) => Math.min(reviewQuestions.length - 1, prev + 1))}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
