"use client";

import { motion } from "framer-motion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Bookmark,
  BookmarkCheck,
  Flag,
  FileText,
  CheckCircle2,
} from "lucide-react";
import type { Question, QuestionOption } from "@/types/database.types";

interface FullPaperViewProps {
  questions: Question[];
  answers: Record<number, string>;
  bookmarkedQuestions: Set<number>;
  markedForReview: Set<number>;
  onSetAnswer: (questionId: number, answer: string) => void;
  onToggleBookmark: (questionId: number) => void;
  onToggleMarkForReview: (questionId: number) => void;
  onJumpToQuestion: (index: number) => void;
  fileUrls?: Record<number, string>;
}

export function FullPaperView({
  questions,
  answers,
  bookmarkedQuestions,
  markedForReview,
  onSetAnswer,
  onToggleBookmark,
  onToggleMarkForReview,
  onJumpToQuestion,
  fileUrls = {},
}: FullPaperViewProps) {
  return (
    <div className="space-y-6 pb-20 sm:pb-8">
      {/* Header */}
      <div className="sticky top-20 z-30 bg-background/95 backdrop-blur-sm py-2 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Full Paper View</h2>
          <Badge variant="secondary">
            {questions.length} {questions.length === 1 ? "Question" : "Questions"}
          </Badge>
        </div>
      </div>

      {/* All Questions */}
      <div className="space-y-6">
        {questions.map((question, index) => {
          // Safely parse options, filtering out any invalid entries
          const rawOptions = question.type === "mcq" ? question.options : null;
          const options: QuestionOption[] = Array.isArray(rawOptions)
            ? (rawOptions as unknown[]).filter(
                (opt): opt is QuestionOption =>
                  opt !== null && typeof opt === "object" && "id" in opt && "text" in opt && typeof (opt as QuestionOption).id === "string" && typeof (opt as QuestionOption).text === "string"
              )
            : [];
          const isAnswered = !!answers[question.id];
          const isMarkedForReview = markedForReview.has(question.id);
          const isBookmarked = bookmarkedQuestions.has(question.id);

          return (
            <motion.div
              key={question.id}
              id={`question-${question.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                "glass-card p-4 sm:p-6 relative",
                isMarkedForReview && "ring-2 ring-yellow-500/50",
                isBookmarked && !isMarkedForReview && "ring-2 ring-accent/50"
              )}
            >
              {/* Question Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => onJumpToQuestion(index)}
                    className="flex items-center gap-2 hover:text-primary transition-colors"
                  >
                    <span className="w-8 h-8 flex items-center justify-center bg-primary/10 text-primary rounded-full font-semibold text-sm">
                      {index + 1}
                    </span>
                  </button>
                  <Badge variant="secondary" className="text-xs">
                    {question.type === "mcq" ? "MCQ" : "Essay"}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {question.marks} {question.marks === 1 ? "mark" : "marks"}
                  </Badge>
                  {isAnswered && (
                    <Badge className="text-xs bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Answered
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggleMarkForReview(question.id)}
                    className={cn(
                      isMarkedForReview && "text-yellow-500"
                    )}
                  >
                    <Flag className={cn(
                      "w-4 h-4",
                      isMarkedForReview && "fill-yellow-500"
                    )} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggleBookmark(question.id)}
                  >
                    {isBookmarked ? (
                      <BookmarkCheck className="w-4 h-4 text-accent" />
                    ) : (
                      <Bookmark className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Question Content */}
              <div className="text-base mb-4 leading-relaxed">
                {question.content}
              </div>

              {/* MCQ Options */}
              {question.type === "mcq" && (
                <RadioGroup
                  value={answers[question.id] || ""}
                  onValueChange={(value) => onSetAnswer(question.id, value)}
                  className="space-y-2"
                >
                  {options.map((option) => (
                    <div
                      key={option.id}
                      className={cn(
                        "flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors",
                        answers[question.id] === option.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => onSetAnswer(question.id, option.id)}
                    >
                      <RadioGroupItem value={option.id} id={`${question.id}-${option.id}`} />
                      <Label
                        htmlFor={`${question.id}-${option.id}`}
                        className="flex-1 cursor-pointer text-sm"
                      >
                        <span className="font-medium mr-2">{option.id?.toUpperCase?.() || ""}.</span>
                        {option.text || ""}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {/* Conventional Question Info */}
              {question.type === "conventional" && (
                <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="w-4 h-4" />
                    <span>Essay/Written Answer Required</span>
                  </div>
                  {question.word_limit && (
                    <p className="text-sm text-muted-foreground">
                      Word limit: <span className="font-medium">{question.word_limit} words</span>
                    </p>
                  )}
                  {fileUrls[question.id] ? (
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Answer file uploaded</span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Click question number to go to upload section
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
