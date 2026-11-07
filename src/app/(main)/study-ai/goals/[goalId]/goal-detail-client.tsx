"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useStudyAIStore } from "@/stores/study-ai-store";
import { ContentUploader } from "@/components/study-ai/content-uploader";
import { GeneratorSelector } from "@/components/study-ai/generator-selector";
import { UsageLimitBanner } from "@/components/study-ai/usage-limit";
import { GoalUploads } from "@/components/study-ai/goal/goal-uploads";
import { GoalMaterials } from "@/components/study-ai/goal/goal-materials";
import { UpgradeModal } from "@/components/tests/upgrade-modal";
import { GuidedLearningChat } from "@/components/study-ai/guided-learning";
import type { StudyAIGoalRow, StudyUploadRow, AIGenerationRow } from "@/types/database.types";
import {
  ArrowLeft,
  BookOpen,
  Upload,
  Sparkles,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Brain,
  Pencil,
  Trash2,
  GraduationCap,
} from "lucide-react";

interface GoalDetailClientProps {
  userId: string;
  goal: StudyAIGoalRow;
  uploads: StudyUploadRow[];
  generations: AIGenerationRow[];
  isPro: boolean;
  generationsByType: Record<string, number>;
}

const LEITNER_LABELS: Record<number, string> = {
  1: "New",
  2: "Learning",
  3: "Reviewing",
  4: "Familiar",
  5: "Mastered",
};

const LEITNER_COLORS: Record<number, string> = {
  1: "text-red-400 bg-red-500/20 border-red-500/30",
  2: "text-orange-400 bg-orange-500/20 border-orange-500/30",
  3: "text-yellow-400 bg-yellow-500/20 border-yellow-500/30",
  4: "text-blue-400 bg-blue-500/20 border-blue-500/30",
  5: "text-green-400 bg-green-500/20 border-green-500/30",
};

export function GoalDetailClient({
  userId,
  goal: initialGoal,
  uploads: initialUploads,
  generations: initialGenerations,
  isPro,
  generationsByType,
}: GoalDetailClientProps) {
  const router = useRouter();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showGuidedLearning, setShowGuidedLearning] = useState(false);
  const [localUploads, setLocalUploads] = useState(initialUploads);
  const [localGenerations, setLocalGenerations] = useState(initialGenerations);
  const [localGenerationsByType, setLocalGenerationsByType] = useState(generationsByType);

  // Sync state when server data changes (e.g., after navigating back)
  useEffect(() => {
    setLocalUploads(initialUploads);
  }, [initialUploads]);

  useEffect(() => {
    setLocalGenerations(initialGenerations);
  }, [initialGenerations]);

  useEffect(() => {
    setLocalGenerationsByType(generationsByType);
  }, [generationsByType]);

  const { markGoalAsRevised, addUpload, addGeneration } = useStudyAIStore();

  const isDue = initialGoal.next_revision_at && new Date(initialGoal.next_revision_at) <= new Date();

  // DEV MODE: Bypass limit in development
  const isDev = process.env.NODE_ENV === "development";

  // Check if any generation type is still available
  const totalTypesUsed = Object.values(localGenerationsByType).filter(count => count >= 1).length;
  const canGenerate = isPro || totalTypesUsed < 5 || isDev;

  // Get combined text from all uploads for AI generation with source labels
  const combinedSourceText = localUploads
    .filter((u) => u.extracted_text)
    .map((u) => {
      const sourceType = u.upload_type.toUpperCase();
      const sourceName = u.file_name || "Unknown";
      return `=== SOURCE: ${sourceType} - ${sourceName} ===\n${u.extracted_text}`;
    })
    .join("\n\n---\n\n");

  const handleUploadComplete = (upload: StudyUploadRow) => {
    setLocalUploads((prev) => [...prev, upload]);
  };

  const handleDeleteUpload = async (uploadId: number): Promise<boolean> => {
    const { deleteUpload } = useStudyAIStore.getState();
    const success = await deleteUpload(uploadId);
    if (success) {
      setLocalUploads((prev) => prev.filter((u) => u.id !== uploadId));
    }
    return success;
  };

  const handleGenerationComplete = (generation: AIGenerationRow) => {
    setLocalGenerations((prev) => [generation, ...prev]);
    if (!isPro && generation.generation_type) {
      setLocalGenerationsByType((prev) => ({
        ...prev,
        [generation.generation_type]: (prev[generation.generation_type] || 0) + 1,
      }));
    }
    setShowGenerator(false);
  };

  const handleDeleteGeneration = (generationId: number) => {
    setLocalGenerations((prev) => prev.filter((g) => g.id !== generationId));
  };

  const [revisionRating, setRevisionRating] = useState<"easy" | "hard" | "again" | null>(null);

  const handleMarkRevised = async (rating: "easy" | "hard" | "again") => {
    setRevisionRating(rating);
    await markGoalAsRevised(initialGoal.id, rating);
  };

  return (
    <div className="space-y-6 overflow-x-hidden w-full max-w-full">
      {/* Back Button */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Link
          href="/study-ai?tab=goals"
          className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to My Goals</span>
        </Link>
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="widget-glass p-6 rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-purple-400" />
              </div>
              <div
                className={cn(
                  "px-3 py-1 rounded-full text-sm border",
                  LEITNER_COLORS[initialGoal.leitner_box]
                )}
              >
                {LEITNER_LABELS[initialGoal.leitner_box]}
              </div>
              {isDue && (
                <div className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 text-sm flex items-center gap-1 border border-orange-500/30">
                  <AlertCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Due for Revision</span>
                  <span className="sm:hidden">Due</span>
                </div>
              )}
            </div>

            <h1 className="text-xl md:text-2xl font-bold text-white mb-2">
              {initialGoal.goal_text}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-white/50">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span suppressHydrationWarning>
                  Created {formatDistanceToNow(new Date(initialGoal.created_at), { addSuffix: true })}
                </span>
              </div>
              {initialGoal.revision_count > 0 && (
                <div className="flex items-center gap-1">
                  <RefreshCw className="w-4 h-4" />
                  <span>{initialGoal.revision_count} revisions</span>
                </div>
              )}
              {initialGoal.next_revision_at && !isDue && (
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span suppressHydrationWarning>
                    Next revision{" "}
                    {formatDistanceToNow(new Date(initialGoal.next_revision_at), { addSuffix: true })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Revision Actions (when due) */}
        {isDue && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <p className="text-sm text-white/60">
                {revisionRating
                  ? "Revision recorded! Continue studying or go back."
                  : "How well did you remember this material?"}
              </p>
              <Link href={`/study-ai/goals/${initialGoal.id}/blurt`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                >
                  <Pencil className="w-4 h-4 mr-1" />
                  Blurt (Active Recall)
                </Button>
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => handleMarkRevised("again")}
                variant="outline"
                size="sm"
                className={cn(
                  "border-red-500/30 text-red-400 hover:bg-red-500/10",
                  revisionRating === "again" && "bg-red-500/20 ring-1 ring-red-500/50"
                )}
              >
                Again (Reset)
                {revisionRating === "again" && <CheckCircle className="w-3 h-3 ml-1" />}
              </Button>
              <Button
                onClick={() => handleMarkRevised("hard")}
                variant="outline"
                size="sm"
                className={cn(
                  "border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10",
                  revisionRating === "hard" && "bg-yellow-500/20 ring-1 ring-yellow-500/50"
                )}
              >
                Hard (Same)
                {revisionRating === "hard" && <CheckCircle className="w-3 h-3 ml-1" />}
              </Button>
              <Button
                onClick={() => handleMarkRevised("easy")}
                variant="outline"
                size="sm"
                className={cn(
                  "border-green-500/30 text-green-400 hover:bg-green-500/10",
                  revisionRating === "easy" && "bg-green-500/20 ring-1 ring-green-500/50"
                )}
              >
                Easy (+1 Level)
                {revisionRating === "easy" && <CheckCircle className="w-3 h-3 ml-1" />}
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Usage Limit */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <UsageLimitBanner
          generationsByType={localGenerationsByType}
          isPro={isPro}
          onUpgradeClick={() => setUpgradeModalOpen(true)}
        />
      </motion.div>

      {/* Guided Learning Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        {!showGuidedLearning ? (
          <button
            onClick={() => setShowGuidedLearning(true)}
            className="w-full p-4 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 hover:from-cyan-500/15 hover:to-purple-500/15 transition-all text-left widget-glass"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-medium text-white">AI Tutor - Guided Learning</h3>
                <p className="text-sm text-white/50">Socratic tutoring - no direct answers, just guided discovery</p>
              </div>
              <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0" />
            </div>
          </button>
        ) : (
          <div className="widget-glass rounded-2xl overflow-hidden">
            <GuidedLearningChat
              goalId={initialGoal.id}
              userId={userId}
              isPro={isPro}
              onSessionComplete={() => {
                setShowGuidedLearning(false);
                router.refresh();
              }}
              onClose={() => setShowGuidedLearning(false)}
              maxHeight="500px"
            />
          </div>
        )}
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6 w-full max-w-full overflow-hidden">
        {/* Left Column - Uploads */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-1 space-y-4"
        >
          <div className="widget-glass p-4 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">Content</h2>
              </div>
              <span className="text-xs text-white/40">{localUploads.length} files</span>
            </div>

            <ContentUploader
              userId={userId}
              goalId={initialGoal.id}
              onUploadComplete={handleUploadComplete}
            />

            {/* PDF size limits info */}
            <p className="text-[10px] text-white/40 mt-2 px-1">
              PDF limit: ~15 pages (or use screenshots for larger docs)
            </p>

            {localUploads.length > 0 && (
              <div className="mt-4">
                <GoalUploads uploads={localUploads} onDelete={handleDeleteUpload} />
              </div>
            )}
          </div>
        </motion.div>

        {/* Right Column - Generated Materials */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 space-y-4"
        >
          {/* Generate Button or Generator */}
          {!showGenerator ? (
            <div className="widget-glass p-4 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  <h2 className="text-lg font-semibold text-white">Study Materials</h2>
                </div>
                <Button
                  onClick={() => {
                    if (!canGenerate) {
                      setUpgradeModalOpen(true);
                      return;
                    }
                    if (localUploads.length === 0) {
                      return;
                    }
                    setShowGenerator(true);
                  }}
                  disabled={localUploads.length === 0}
                  className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Materials
                </Button>
              </div>
              {localUploads.length === 0 && (
                <p className="mt-3 text-sm text-white/50">
                  Upload some content first to generate study materials.
                </p>
              )}
            </div>
          ) : (
            <div className="widget-glass p-4 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  <h2 className="text-lg font-semibold text-white">Choose Material Type</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowGenerator(false)}
                  className="w-full sm:w-auto text-white/60 hover:text-white"
                >
                  Cancel
                </Button>
              </div>
              <GeneratorSelector
                userId={userId}
                goalId={initialGoal.id}
                sourceContent={combinedSourceText}
                isPro={isPro}
                onGenerationComplete={handleGenerationComplete}
                onCancel={() => setShowGenerator(false)}
              />
            </div>
          )}

          {/* Materials List */}
          {localGenerations.length > 0 ? (
            <GoalMaterials
              generations={localGenerations}
              goalId={initialGoal.id}
              onDelete={handleDeleteGeneration}
              sourceContent={combinedSourceText}
              onBetterGenerated={(generation) => setLocalGenerations((prev) => [generation, ...prev])}
            />
          ) : (
            <div className="widget-glass p-12 rounded-2xl text-center">
              <Sparkles className="w-12 h-12 text-white/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                No materials yet
              </h3>
              <p className="text-white/50">
                Upload content and generate your first study material
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen} />
    </div>
  );
}
