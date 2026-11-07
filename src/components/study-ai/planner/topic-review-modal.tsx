"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  X,
  RotateCcw,
  Brain,
  Sparkles,
  Loader2,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

interface TopicReview {
  id: number;
  plan_id: string;
  week_number: number;
  day_number: number;
  subject: string;
  topics: string[];
  leitner_box: number;
  next_review_at: string;
  last_reviewed_at: string | null;
  review_count: number;
  is_active: boolean;
}

interface TopicReviewModalProps {
  review: TopicReview;
  isPro: boolean;
  onClose: () => void;
  onReviewComplete: () => void;
}

const LEITNER_INTERVALS: Record<number, number> = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
};

export function TopicReviewModal({
  review,
  isPro,
  onClose,
  onReviewComplete,
}: TopicReviewModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRating, setSelectedRating] = useState<string | null>(null);

  const handleRate = async (rating: "again" | "hard" | "easy") => {
    setSelectedRating(rating);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/study-ai/planner-revision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: review.id, rating }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit review");
      }

      const data = await response.json();

      toast.success(
        `Review completed! +${data.xpEarned} XP. Next review in ${data.daysUntilNext} day${data.daysUntilNext > 1 ? "s" : ""}.`
      );

      onReviewComplete();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to submit review");
      setSelectedRating(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate expected outcomes for each rating
  const getExpectedOutcome = (rating: "again" | "hard" | "easy") => {
    const currentBox = review.leitner_box;
    let newBox: number;
    let xp: number;

    switch (rating) {
      case "easy":
        newBox = Math.min(currentBox + 1, 5);
        xp = isPro ? 15 : 10;
        break;
      case "hard":
        newBox = currentBox;
        xp = isPro ? 12 : 8;
        break;
      case "again":
        newBox = 1;
        xp = isPro ? 8 : 5;
        break;
    }

    const daysUntilNext = LEITNER_INTERVALS[newBox];
    return { newBox, daysUntilNext, xp };
  };

  const ratingOptions = [
    {
      rating: "again" as const,
      label: "Again",
      description: "Need to study more",
      icon: RotateCcw,
      color: "text-red-400",
      bgColor: "bg-red-500/20",
      borderColor: "border-red-500/30",
      hoverBg: "hover:bg-red-500/30",
    },
    {
      rating: "hard" as const,
      label: "Hard",
      description: "Difficult but remembered",
      icon: Brain,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/20",
      borderColor: "border-yellow-500/30",
      hoverBg: "hover:bg-yellow-500/30",
    },
    {
      rating: "easy" as const,
      label: "Easy",
      description: "Remembered well",
      icon: Sparkles,
      color: "text-green-400",
      bgColor: "bg-green-500/20",
      borderColor: "border-green-500/30",
      hoverBg: "hover:bg-green-500/30",
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-md widget-glass rounded-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Topic Review</h2>
                <p className="text-sm text-white/60 mt-0.5">
                  Rate how well you remembered this topic
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Topic Info */}
          <div className="p-5 border-b border-white/10">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-white">{review.subject}</h3>
                <p className="text-sm text-white/60 mt-1">
                  {review.topics.join(", ")}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Box {review.leitner_box}/5
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Review #{review.review_count + 1}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Rating Options */}
          <div className="p-5 space-y-3">
            {ratingOptions.map((option) => {
              const outcome = getExpectedOutcome(option.rating);
              const Icon = option.icon;
              const isSelected = selectedRating === option.rating;

              return (
                <button
                  key={option.rating}
                  onClick={() => handleRate(option.rating)}
                  disabled={isSubmitting}
                  className={cn(
                    "w-full p-4 rounded-xl border transition-all text-left",
                    option.bgColor,
                    option.borderColor,
                    option.hoverBg,
                    isSelected && "ring-2 ring-primary",
                    isSubmitting && !isSelected && "opacity-50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isSelected && isSubmitting ? (
                        <Loader2 className={cn("w-5 h-5 animate-spin", option.color)} />
                      ) : (
                        <Icon className={cn("w-5 h-5", option.color)} />
                      )}
                      <div>
                        <p className={cn("font-medium", option.color)}>
                          {option.label}
                        </p>
                        <p className="text-xs text-white/60">{option.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-primary">
                        +{outcome.xp} XP
                      </p>
                      <p className="text-xs text-white/40">
                        Next in {outcome.daysUntilNext}d
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pro Badge */}
          {isPro && (
            <div className="px-5 pb-5">
              <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-yellow-400">Pro: 1.5x XP Bonus Active</span>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
