"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Brain,
  Target,
  Trophy,
  ChevronRight,
  Sparkles,
  FileText,
  Image,
  Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StudyAIGoal } from "@/types/study-ai.types";

interface RevisionClientProps {
  dueGoals: (StudyAIGoal & { study_uploads?: { count: number }[]; ai_generations?: { count: number }[] })[];
  upcomingGoals: (StudyAIGoal & { study_uploads?: { count: number }[]; ai_generations?: { count: number }[] })[];
  recentSessions: any[];
}

export function RevisionClient({ dueGoals, upcomingGoals, recentSessions }: RevisionClientProps) {
  const getLeitnerBoxLabel = (box: number) => {
    const labels = ["New", "Learning", "Reviewing", "Familiar", "Mastered"];
    return labels[Math.min(box - 1, 4)] || "New";
  };

  const getLeitnerBoxColor = (box: number) => {
    const colors = [
      "bg-red-500/20 text-red-400 border-red-500/30",
      "bg-orange-500/20 text-orange-400 border-orange-500/30",
      "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      "bg-blue-500/20 text-blue-400 border-blue-500/30",
      "bg-green-500/20 text-green-400 border-green-500/30",
    ];
    return colors[Math.min(box - 1, 4)] || colors[0];
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const overdueDays = Math.abs(diffDays);
      if (overdueDays === 1) return "Overdue by 1 day";
      return `Overdue by ${overdueDays} days`;
    }
    if (diffDays === 0) return "Due today";
    if (diffDays === 1) return "Due tomorrow";
    if (diffDays < 7) return `Due in ${diffDays} days`;
    return date.toLocaleDateString();
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/study-ai?tab=revision">
              <Button variant="ghost" size="icon" className="text-white/70 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                Revision Hub
              </h1>
              <p className="text-sm text-white/60">Spaced repetition & active recall</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          {/* Due for Review */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Target className="w-5 h-5 text-orange-400" />
                Due for Review
                {dueGoals.length > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded-full">
                    {dueGoals.length}
                  </span>
                )}
              </h2>
            </div>

            {dueGoals.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-8 rounded-xl text-center"
              >
                <Sparkles className="w-12 h-12 text-primary mx-auto mb-3 opacity-60" />
                <h3 className="font-semibold mb-2">All caught up!</h3>
                <p className="text-white/60 text-sm">
                  No goals due for review right now. Keep up the great work!
                </p>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {dueGoals.map((goal, index) => (
                  <motion.div
                    key={goal.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link href={`/study-ai/goals/${goal.id}`}>
                      <div className="glass-card p-4 rounded-xl hover:border-primary/50 transition-all group cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                              {goal.goal_text}
                            </h3>
                            <div className="flex items-center gap-3 mt-2 text-sm">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-xs border",
                                getLeitnerBoxColor(goal.leitner_box || 1)
                              )}>
                                {getLeitnerBoxLabel(goal.leitner_box || 1)}
                              </span>
                              <span className="text-orange-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(goal.next_revision_at || new Date().toISOString())}
                              </span>
                              {goal.revision_count && goal.revision_count > 0 && (
                                <span className="text-white/50">
                                  Revised {goal.revision_count}x
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          {/* Upcoming Reviews */}
          {upcomingGoals.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-blue-400" />
                Upcoming Reviews
              </h2>

              <div className="space-y-2">
                {upcomingGoals.map((goal, index) => (
                  <motion.div
                    key={goal.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + index * 0.05 }}
                  >
                    <Link href={`/study-ai/goals/${goal.id}`}>
                      <div className="glass-card p-3 rounded-lg hover:border-white/20 transition-all group cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                              {goal.goal_text}
                            </h3>
                            <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-xs",
                                getLeitnerBoxColor(goal.leitner_box || 1)
                              )}>
                                Box {goal.leitner_box || 1}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(goal.next_revision_at || new Date().toISOString())}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Recent Blurting Sessions */}
          {recentSessions.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-yellow-400" />
                Recent Active Recall (Blurt Sessions)
              </h2>

              <div className="space-y-2">
                {recentSessions.map((session, index) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                    className="glass-card p-3 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium truncate">
                          {session.topic || (session.study_ai_goals as any)?.goal_text || "Blurting Session"}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                          <span className={cn("font-semibold", getScoreColor(session.score || 0))}>
                            {session.score}%
                          </span>
                          <span>•</span>
                          <span>+{session.xp_earned} XP</span>
                          <span>•</span>
                          <span>{new Date(session.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Empty state when no data at all */}
          {dueGoals.length === 0 && upcomingGoals.length === 0 && recentSessions.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <Brain className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No revision data yet</h3>
              <p className="text-white/60 text-sm mb-6">
                Create your first study goal to start building your revision schedule.
              </p>
              <Link href="/study-ai">
                <Button className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  Create Study Goal
                </Button>
              </Link>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
