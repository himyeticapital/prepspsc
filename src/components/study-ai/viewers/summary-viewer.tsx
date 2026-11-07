"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { AIGenerationRow } from "@/types/database.types";
import type { SummaryOutput } from "@/types/study-ai.types";
import {
  ArrowLeft,
  FileText,
  Calendar,
  Lightbulb,
  CheckCircle,
  Bookmark,
  BookmarkCheck,
  Loader2,
  GraduationCap,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SummaryViewerProps {
  generation: AIGenerationRow;
  goalText: string;
}

export function SummaryViewer({ generation, goalText }: SummaryViewerProps) {
  const searchParams = useSearchParams();
  const fromSaved = searchParams.get("from") === "saved";
  const data = generation.output_data as unknown as SummaryOutput;
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

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Back Button */}
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

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="widget-glass p-6 rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{data.title || "Summary"}</h1>
              <p className="text-sm text-white/60">{goalText}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              "h-10 w-10 rounded-xl transition-all",
              isSaved
                ? "text-yellow-400 bg-yellow-500/20 hover:bg-yellow-500/30"
                : "text-white/40 hover:text-white hover:bg-white/10"
            )}
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isSaved ? (
              <BookmarkCheck className="w-5 h-5" />
            ) : (
              <Bookmark className="w-5 h-5" />
            )}
          </Button>
        </div>
      </motion.div>

      {/* Key Points */}
      {data.keyPoints && data.keyPoints.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="widget-glass p-6 rounded-2xl"
        >
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold text-white">Key Points</h2>
          </div>
          <ul className="space-y-3">
            {data.keyPoints.map((point, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                className="flex items-start gap-3"
              >
                <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {index + 1}
                </span>
                <p className="text-white/80">{point}</p>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Key Dates */}
      {data.keyDates && data.keyDates.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="widget-glass p-6 rounded-2xl"
        >
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Key Dates & Events</h2>
          </div>
          <div className="space-y-3">
            {data.keyDates.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.05 }}
                className="flex items-start gap-4 p-3 rounded-lg bg-white/5"
              >
                <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm font-medium shrink-0">
                  {item.date}
                </span>
                <p className="text-white/80">{item.event}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Key Concepts (New Enhanced Format) */}
      {data.keyConcepts && data.keyConcepts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="widget-glass p-6 rounded-2xl"
        >
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Key Concepts Explained</h2>
          </div>
          <div className="space-y-4">
            {data.keyConcepts.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.05 }}
                className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20"
              >
                <h3 className="font-semibold text-purple-300 mb-2">{item.concept}</h3>
                <p className="text-white/80">{item.explanation}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Main Ideas (Legacy Format Support) */}
      {data.mainIdeas && data.mainIdeas.length > 0 && !data.keyConcepts && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="widget-glass p-6 rounded-2xl"
        >
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-semibold text-white">Main Ideas</h2>
          </div>
          <div className="space-y-4">
            {data.mainIdeas.map((idea, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.05 }}
                className="p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20"
              >
                <p className="text-white/90">{idea}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Exam Facts (Important for Competitive Exams) */}
      {data.examFacts && data.examFacts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="widget-glass p-6 rounded-2xl"
        >
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Important for Exams</h2>
          </div>
          <ul className="space-y-2">
            {data.examFacts.map((fact, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + index * 0.03 }}
                className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
              >
                <Star className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-white/90">{fact}</p>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Conclusion */}
      {data.conclusion && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="widget-glass p-6 rounded-2xl border border-green-500/20"
        >
          <h2 className="text-lg font-semibold text-white mb-3">Conclusion</h2>
          <p className="text-white/80 leading-relaxed">{data.conclusion}</p>
        </motion.div>
      )}
    </div>
  );
}
