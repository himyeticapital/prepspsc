"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Clock, FileQuestion, Lock, Play, Crown, Sparkles, Trophy, BarChart3, Target, ListChecks, FileText, Layers, Bot } from "lucide-react";
import type { Test, ExamCategory, TestAnalytics } from "@/types/database.types";

interface TestCardProps {
  test: Test & { category?: ExamCategory | null };
  isPro: boolean;
  analytics?: TestAnalytics;
  onLockedClick: () => void;
}

export function TestCard({ test, isPro, analytics, onLockedClick }: TestCardProps) {
  const router = useRouter();
  const isLocked = test.is_premium && !isPro;

  const handleClick = () => {
    if (isLocked) {
      onLockedClick();
    } else {
      router.push(`/test/${test.id}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className={cn(
        "widget-glass p-5 cursor-pointer transition-all duration-300 rounded-xl",
        isLocked
          ? "border-orange-500/20 hover:border-orange-500/40"
          : "border-white/5 hover:border-primary/30"
      )}
      onClick={handleClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {test.is_premium ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30">
                <Crown className="w-3 h-3" />
                Premium
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs bg-primary/20 text-primary border border-primary/30">
                Free
              </span>
            )}
            {test.category && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/50">
                {test.category.name}
              </span>
            )}
            {/* Test Type Badge */}
            {(() => {
              const testType = (test as any).test_type || "mcq";
              if (testType === "mcq") {
                return (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <ListChecks className="w-3 h-3" />
                    MCQ
                  </span>
                );
              } else if (testType === "conventional") {
                return (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    <FileText className="w-3 h-3" />
                    Essay
                  </span>
                );
              } else if (testType === "mixed") {
                return (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30">
                    <Layers className="w-3 h-3" />
                    MCQ + Essay
                  </span>
                );
              }
              return null;
            })()}
            {/* AI Mock Badge */}
            {(test as any).source === "ai_mock" && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Bot className="w-3 h-3" />
                AI PYQ Mock
              </span>
            )}
            {/* Difficulty Badge - only show if not "none" */}
            {test.difficulty && test.difficulty !== "none" && (
              <span className={cn(
                "px-2 py-0.5 rounded-full text-xs border",
                test.difficulty === "easy"
                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                  : test.difficulty === "moderate"
                  ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                  : "bg-red-500/20 text-red-400 border-red-500/30"
              )}>
                {test.difficulty === "easy" ? "Easy" : test.difficulty === "moderate" ? "Moderate" : "Hard"}
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-white line-clamp-2">{test.title}</h3>
        </div>
        {isLocked && (
          <div className="p-2 rounded-lg bg-orange-500/10">
            <Lock className="w-4 h-4 text-orange-400" />
          </div>
        )}
      </div>

      {/* Description */}
      {test.description && (
        <p className="text-sm text-white/50 line-clamp-2 mb-3">
          {test.description}
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-white/40 mb-3">
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          <span>{test.duration_minutes} min</span>
        </div>
        {test.total_marks && (
          <div className="flex items-center gap-1">
            <FileQuestion className="w-3.5 h-3.5" />
            <span>{test.total_marks} marks</span>
          </div>
        )}
      </div>

      {/* Analytics (if attempted) */}
      {analytics && analytics.total_attempts > 0 && (
        <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 mb-3">
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1 text-white/60">
              <Target className="w-3 h-3" />
              <span>{analytics.total_attempts} attempts</span>
            </div>
            <div className="flex items-center gap-1 text-primary">
              <Trophy className="w-3 h-3" />
              <span>Best: {Math.round(analytics.best_score)}%</span>
            </div>
          </div>
          <Link
            href={`/test-analytics/${test.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <BarChart3 className="w-3 h-3" />
            Analytics
          </Link>
        </div>
      )}

      {/* Action Button */}
      <Button
        className={cn(
          "w-full",
          isLocked
            ? "bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30"
            : "bg-primary hover:bg-primary/90"
        )}
        variant={isLocked ? "ghost" : "default"}
      >
        {isLocked ? (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Unlock with Pro
          </>
        ) : (
          <>
            <Play className="w-4 h-4 mr-2" />
            Start Test
          </>
        )}
      </Button>
    </motion.div>
  );
}
