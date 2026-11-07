"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import type { CheckpointData } from "@/lib/guided-learning/types";

interface CheckpointCardProps {
  checkpoint: CheckpointData;
  onAnswer?: (answerId: string) => void;
  answered?: boolean;
  selectedAnswer?: string;
}

export function CheckpointCard({
  checkpoint,
  onAnswer,
  answered = false,
  selectedAnswer,
}: CheckpointCardProps) {
  const [localSelected, setLocalSelected] = useState<string | null>(
    selectedAnswer || null
  );
  const isAnswered = answered || !!selectedAnswer;
  const selected = selectedAnswer || localSelected;

  const handleSelect = (optionId: string) => {
    if (isAnswered) return;

    setLocalSelected(optionId);
    onAnswer?.(optionId);
  };

  return (
    <div className="rounded-xl bg-yellow-500/5 border border-yellow-500/20 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
          <HelpCircle className="w-3.5 h-3.5 text-yellow-400" />
        </div>
        <span className="text-sm font-medium text-yellow-400">Quick Check</span>
      </div>

      {/* Question */}
      <p className="text-white text-sm mb-4">{checkpoint.question}</p>

      {/* Options */}
      <div className="space-y-2">
        {checkpoint.options.map((option) => {
          const isSelected = selected === option.id;
          const isCorrect = option.id === checkpoint.correctAnswer;
          const showCorrect = isAnswered && isCorrect;
          const showWrong = isAnswered && isSelected && !isCorrect;

          return (
            <motion.button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              disabled={isAnswered}
              whileHover={!isAnswered ? { scale: 1.01 } : {}}
              whileTap={!isAnswered ? { scale: 0.99 } : {}}
              className={cn(
                "w-full p-3 rounded-lg text-left transition-all flex items-start gap-3",
                "border",
                !isAnswered && "hover:bg-white/5 cursor-pointer",
                isAnswered && "cursor-default",
                // Default state
                !isAnswered &&
                  !isSelected &&
                  "bg-white/5 border-white/10",
                // Selected but not yet answered
                !isAnswered &&
                  isSelected &&
                  "bg-primary/10 border-primary/40",
                // Correct answer revealed
                showCorrect && "bg-green-500/10 border-green-500/40",
                // Wrong answer revealed
                showWrong && "bg-red-500/10 border-red-500/40"
              )}
            >
              {/* Option ID */}
              <span
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                  !isAnswered && "bg-white/10 text-white/70",
                  showCorrect && "bg-green-500/20 text-green-400",
                  showWrong && "bg-red-500/20 text-red-400",
                  isAnswered &&
                    !showCorrect &&
                    !showWrong &&
                    "bg-white/5 text-white/50"
                )}
              >
                {option.id.toUpperCase()}
              </span>

              {/* Option Text */}
              <span
                className={cn(
                  "flex-1 text-sm",
                  !isAnswered && "text-white/80",
                  showCorrect && "text-green-300",
                  showWrong && "text-red-300",
                  isAnswered && !showCorrect && !showWrong && "text-white/50"
                )}
              >
                {option.text}
              </span>

              {/* Result Icon */}
              <AnimatePresence>
                {showCorrect && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex-shrink-0"
                  >
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </motion.div>
                )}
                {showWrong && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex-shrink-0"
                  >
                    <XCircle className="w-5 h-5 text-red-400" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>

      {/* Explanation (shown after answering) */}
      <AnimatePresence>
        {isAnswered && checkpoint.explanation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-white/10"
          >
            <div className="flex items-start gap-2">
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                  selected === checkpoint.correctAnswer
                    ? "bg-green-500/20"
                    : "bg-amber-500/20"
                )}
              >
                {selected === checkpoint.correctAnswer ? (
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                ) : (
                  <HelpCircle className="w-3 h-3 text-amber-400" />
                )}
              </div>
              <div>
                <p
                  className={cn(
                    "text-xs font-medium mb-1",
                    selected === checkpoint.correctAnswer
                      ? "text-green-400"
                      : "text-amber-400"
                  )}
                >
                  {selected === checkpoint.correctAnswer
                    ? "Correct!"
                    : "Not quite right"}
                </p>
                <p className="text-xs text-white/70 leading-relaxed">
                  {checkpoint.explanation}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
