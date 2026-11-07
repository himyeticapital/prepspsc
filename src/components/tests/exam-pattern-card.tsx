"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ListChecks,
  Clock,
  MinusCircle,
  Loader2,
  Zap,
  Pencil,
  Database,
  Sparkles,
} from "lucide-react";

interface ExamPatternSection {
  subject: string;
  count: number;
}

export interface ExamPatternData {
  name: string;
  description: string;
  total_questions: number;
  duration_minutes: number;
  negative_marking: boolean;
  negative_mark_value: number;
  marks_per_question: number;
  sections: ExamPatternSection[];
}

interface ExamPatternCardProps {
  pattern: ExamPatternData;
  source: "spsc" | "ai";
  onGenerate: () => void;
  onModify: () => void;
  isGenerating: boolean;
}

export function ExamPatternCard({
  pattern,
  source,
  onGenerate,
  onModify,
  isGenerating,
}: ExamPatternCardProps) {
  // Merge duplicate subjects for display
  const mergedSections = pattern.sections.reduce<ExamPatternSection[]>(
    (acc, s) => {
      const existing = acc.find((a) => a.subject === s.subject);
      if (existing) {
        existing.count += s.count;
      } else {
        acc.push({ ...s });
      }
      return acc;
    },
    []
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4 w-full max-w-md"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-white leading-tight">
          {pattern.name}
        </h3>
        <span
          className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${
            source === "spsc"
              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
              : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
          }`}
        >
          {source === "spsc" ? (
            <span className="flex items-center gap-1">
              <Database className="w-2.5 h-2.5" />
              Real PYQs
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              AI Generated
            </span>
          )}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-white/40 mb-3 line-clamp-2">
        {pattern.description}
      </p>

      {/* Stats Row */}
      <div className="flex items-center gap-4 text-xs text-white/60 mb-3">
        <span className="flex items-center gap-1">
          <ListChecks className="w-3.5 h-3.5 text-cyan-400/70" />
          {pattern.total_questions} Qs
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-cyan-400/70" />
          {pattern.duration_minutes} min
        </span>
        {pattern.negative_marking && (
          <span className="flex items-center gap-1">
            <MinusCircle className="w-3.5 h-3.5 text-red-400/70" />
            -{pattern.negative_mark_value}
          </span>
        )}
      </div>

      {/* Section Pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {mergedSections.map((section, idx) => (
          <span
            key={idx}
            className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/50 border border-white/10"
          >
            {section.subject} ({section.count})
          </span>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30"
          variant="ghost"
          onClick={onGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              Generate Test
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-white/50 hover:text-white hover:bg-white/10"
          onClick={onModify}
          disabled={isGenerating}
        >
          <Pencil className="w-3.5 h-3.5 mr-1" />
          Modify
        </Button>
      </div>
    </motion.div>
  );
}
