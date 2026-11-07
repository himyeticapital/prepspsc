"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  FileText,
  Calendar,
  CheckCircle,
  Bookmark,
  BookmarkCheck,
  Loader2,
  GraduationCap,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PlannerSummaryData {
  title: string;
  keyPoints?: string[];
  keyDates?: { date: string; event: string }[];
  keyConcepts?: { concept: string; explanation: string }[];
  examFacts?: string[];
  conclusion?: string;
  subject: string;
  topics: string[];
  topicKey?: string;
  planId?: string;
}

export default function PlannerSummaryViewerPage() {
  const [data, setData] = useState<PlannerSummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    try {
      const storedData = sessionStorage.getItem("planner-summary-data");
      if (storedData) {
        setData(JSON.parse(storedData));
      } else {
        setError("No summary data found. Please generate a summary first.");
      }
    } catch (err) {
      console.error("Failed to load summary data:", err);
      setError("Failed to load summary data.");
    }
  }, []);

  const handleSave = async () => {
    if (!data || isSaving || isSaved) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/study-ai/save-planner-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          generationType: "summary",
          outputData: {
            title: data.title,
            keyPoints: data.keyPoints,
            keyDates: data.keyDates,
            keyConcepts: data.keyConcepts,
            examFacts: data.examFacts,
            conclusion: data.conclusion,
          },
          subject: data.subject,
          topics: data.topics,
        }),
      });

      if (response.ok) {
        setIsSaved(true);
        toast.success("Summary saved! Find it in Study with AI → Saved section.");
      } else {
        const result = await response.json();
        toast.error(result.error || "Failed to save");
      }
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save summary");
    } finally {
      setIsSaving(false);
    }
  };

  const getBackUrl = () => {
    if (data?.topicKey) {
      const params = new URLSearchParams({ tab: "planner", expand: data.topicKey });
      if (data.planId) params.set("planId", data.planId);
      params.set("notebook", "true");
      return `/study-ai?${params.toString()}`;
    }
    return "/study-ai?tab=planner";
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-white/60 mb-4">{error}</p>
          <Button asChild className="bg-purple-600 hover:bg-purple-700">
            <Link href={getBackUrl()}>Go Back</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Back Button */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <Link
            href={getBackUrl()}
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Study Planner</span>
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-2xl"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{data.title}</h1>
                <p className="text-sm text-white/60">{data.subject} - {data.topics?.join(", ")}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || isSaved}
              className={cn(
                "gap-2 border-white/20 text-white hover:bg-white/10",
                isSaved && "text-yellow-400 border-yellow-400/50"
              )}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isSaved ? (
                <BookmarkCheck className="w-4 h-4" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
              {isSaved ? "Saved" : "Save"}
            </Button>
          </div>
        </motion.div>

        {/* Key Points */}
        {data.keyPoints && data.keyPoints.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-2xl"
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
            className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-2xl"
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

        {/* Key Concepts */}
        {data.keyConcepts && data.keyConcepts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-2xl"
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

        {/* Exam Facts */}
        {data.examFacts && data.examFacts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-2xl"
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
      </div>
    </div>
  );
}
