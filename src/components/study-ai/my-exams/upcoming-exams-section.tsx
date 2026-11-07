"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Sparkles,
  CalendarClock,
  Play,
  ChevronRight,
} from "lucide-react";

interface Microtheme {
  subject: string;
  topics: string[];
  subtopics: string[];
  pyqFrequency: number;
  importance: "high" | "medium" | "low";
}

interface AdminExam {
  value: string;
  label: string;
  description?: string;
  microthemes: Microtheme[];
  isSeparator?: boolean;
  disabled?: boolean;
}

interface UpcomingExamsSectionProps {
  onSelectExam?: (examSlug: string) => void;
}

export function UpcomingExamsSection({ onSelectExam }: UpcomingExamsSectionProps) {
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExams = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/study-ai/exams");
      if (!res.ok) throw new Error("Failed to fetch exams");
      const data = await res.json();

      // Filter to only get admin exams (not separators, not user exams, not custom)
      const adminExams = (data.exams || []).filter(
        (exam: AdminExam) =>
          !exam.isSeparator &&
          !exam.disabled &&
          exam.value !== "custom" &&
          !exam.value.startsWith("user:") &&
          !exam.value.startsWith("separator")
      );
      setExams(adminExams);
    } catch (error) {
      console.error("Error fetching exams:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const handleSelectExam = (examSlug: string) => {
    if (onSelectExam) {
      onSelectExam(examSlug);
    }
  };

  // Don't render if no admin exams
  if (!loading && exams.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Upcoming Exams</h3>
          {exams.length > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-400">
              {exams.length}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-white/50">
        Pre-configured exams with syllabus and high-yield topics. Click to create a study plan.
      </p>

      {/* Exams Grid */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-8"
          >
            <Loader2 className="w-6 h-6 animate-spin text-white/40" />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {exams.map((exam, index) => {
              const microthemeCount = exam.microthemes?.length || 0;
              const highPriorityCount = exam.microthemes?.filter(
                (m) => m.importance === "high"
              ).length || 0;

              return (
                <motion.div
                  key={exam.value}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleSelectExam(exam.value)}
                  className={cn(
                    "group relative p-4 rounded-xl border transition-all cursor-pointer",
                    "bg-gradient-to-br from-emerald-500/5 to-teal-500/5",
                    "border-emerald-500/20 hover:border-emerald-500/40",
                    "hover:bg-gradient-to-br hover:from-emerald-500/10 hover:to-teal-500/10"
                  )}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-500/20">
                        <CalendarClock className="w-4 h-4 text-emerald-400" />
                      </div>
                      {microthemeCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <Sparkles className="w-3 h-3" />
                          Ready
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-emerald-400 transition-colors" />
                  </div>

                  {/* Exam Name */}
                  <h4 className="font-medium text-white mb-1 group-hover:text-emerald-400 transition-colors">
                    {exam.label}
                  </h4>

                  {/* Description */}
                  {exam.description && (
                    <p className="text-xs text-white/50 mb-3 line-clamp-2">
                      {exam.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-xs text-white/40">
                    {microthemeCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        {microthemeCount} subjects
                      </span>
                    )}
                    {highPriorityCount > 0 && (
                      <span className="text-red-400/80">
                        {highPriorityCount} high priority
                      </span>
                    )}
                  </div>

                  {/* Hover Action Hint */}
                  <div className="absolute inset-x-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-center gap-1 text-xs text-emerald-400">
                      <Play className="w-3 h-3" />
                      Click to create plan
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
