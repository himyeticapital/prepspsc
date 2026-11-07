"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  Presentation,
  Bookmark,
  BookmarkCheck,
  Loader2,
} from "lucide-react";
import { SlidesViewer } from "@/components/study-ai/viewers/slides-viewer";
import type { AnimatedSlide } from "@/types/study-ai.types";

interface PlannerSlidesData {
  title: string;
  slides: AnimatedSlide[];
  themeColor?: string;
  subject: string;
  topics: string[];
  topicKey?: string;
  planId?: string;
}

export default function PlannerSlidesViewerPage() {
  const [data, setData] = useState<PlannerSlidesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    try {
      const storedData = sessionStorage.getItem("planner-slides-data");
      if (storedData) {
        setData(JSON.parse(storedData));
      } else {
        setError("No slides data found. Please generate slides first.");
      }
    } catch (err) {
      console.error("Failed to load slides data:", err);
      setError("Failed to load slides data.");
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
          generationType: "slides",
          outputData: {
            title: data.title,
            slides: data.slides,
            themeColor: data.themeColor,
          },
          subject: data.subject,
          topics: data.topics,
        }),
      });

      if (response.ok) {
        setIsSaved(true);
        toast.success("Slides saved!");
      } else {
        const result = await response.json();
        toast.error(result.error || "Failed to save");
      }
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save slides");
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
          <Button asChild className="bg-cyan-600 hover:bg-cyan-700">
            <Link href={getBackUrl()}>Go Back</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!data || !data.slides?.length) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <div className="text-center">
          <Presentation className="w-12 h-12 text-white/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No slides</h3>
          <p className="text-white/50 mb-4">This generation doesn't have any slides.</p>
          <Button asChild className="bg-cyan-600 hover:bg-cyan-700">
            <Link href={getBackUrl()}>Go Back</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-4">
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
          className="bg-white/5 backdrop-blur-sm border border-white/10 p-4 rounded-2xl"
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-lg font-semibold text-white">{data.title}</h1>
              <p className="text-sm text-white/60">{data.subject} - {data.topics?.join(", ")}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || isSaved}
              className={cn(
                "gap-1 border-white/20 text-white hover:bg-white/10",
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

        {/* Slides Viewer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <SlidesViewer
            slides={data.slides}
            title={data.title}
            themeColor={data.themeColor}
          />
        </motion.div>

        {/* Keyboard shortcuts hint */}
        <p className="text-center text-white/30 text-xs">
          ← → Navigate &nbsp;·&nbsp; Space Next &nbsp;·&nbsp; N Notes &nbsp;·&nbsp; F Fullscreen
        </p>
      </div>
    </div>
  );
}
