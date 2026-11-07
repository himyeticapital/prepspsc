"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  Loader2,
  Sparkles,
} from "lucide-react";

interface KeyFact {
  label: string;
  value: string;
  icon?: string;
}

interface PlannerInfographicData {
  title: string;
  keyFacts?: KeyFact[];
  highlights?: string[];
  subject: string;
  topics: string[];
  topicKey?: string;
  planId?: string;
}

export default function PlannerInfographicViewerPage() {
  const [data, setData] = useState<PlannerInfographicData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    try {
      const storedData = sessionStorage.getItem("planner-infographic-data");
      if (storedData) {
        setData(JSON.parse(storedData));
      } else {
        setError("No infographic data found. Please generate an infographic first.");
      }
    } catch (err) {
      console.error("Failed to load infographic data:", err);
      setError("Failed to load infographic data.");
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
          generationType: "infographic",
          outputData: {
            title: data.title,
            keyFacts: data.keyFacts,
            highlights: data.highlights,
          },
          subject: data.subject,
          topics: data.topics,
        }),
      });

      if (response.ok) {
        setIsSaved(true);
        toast.success("Infographic saved! Find it in Study with AI → Saved section.");
      } else {
        const result = await response.json();
        toast.error(result.error || "Failed to save");
      }
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save infographic");
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
        <Loader2 className="w-8 h-8 animate-spin text-red-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
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
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-red-400" />
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

        {/* Key Facts Grid */}
        {data.keyFacts && data.keyFacts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-red-400" />
              Key Facts at a Glance
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.keyFacts.map((fact, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                  className="p-5 rounded-2xl bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20 hover:border-red-500/40 transition-all"
                >
                  <div className="text-3xl mb-3">{fact.icon || "📌"}</div>
                  <p className="text-sm text-white/50 mb-1">{fact.label}</p>
                  <p className="text-lg text-white font-semibold">{fact.value}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Highlights */}
        {data.highlights && data.highlights.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-2xl"
          >
            <h2 className="text-lg font-semibold text-white mb-4">Key Highlights</h2>
            <ul className="space-y-3">
              {data.highlights.map((highlight, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + index * 0.05 }}
                  className="flex items-start gap-3 p-3 rounded-lg bg-white/5"
                >
                  <span className="text-red-400 text-xl shrink-0">→</span>
                  <p className="text-white/80">{highlight}</p>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Visual Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-6 rounded-2xl bg-gradient-to-br from-red-500/5 via-purple-500/5 to-blue-500/5 border border-white/10 text-center"
        >
          <p className="text-white/60 text-sm">
            💡 Tip: Save this infographic for quick revision before exams
          </p>
        </motion.div>
      </div>
    </div>
  );
}
