"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useStudyAIStore } from "@/stores/study-ai-store";
import { StudyGoalInput } from "@/components/study-ai/study-goal-input";
import { GoalCard } from "@/components/study-ai/goal/goal-card";
import { UsageLimitBanner } from "@/components/study-ai/usage-limit";
import { UpgradeModal } from "@/components/tests/upgrade-modal";
import { StandaloneBlurtSection } from "@/components/study-ai/revision/standalone-blurt-section";
import type { StudyAIGoalRow, AIGenerationRow } from "@/types/database.types";
import {
  Brain,
  Search,
  Plus,
  BookOpen,
  FolderOpen,
  RefreshCw,
  Sparkles,
  Clock,
  Target,
  FileText,
  Map,
  ListChecks,
  HelpCircle,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  Eye,
  Loader2,
  Calendar,
  BookMarked,
} from "lucide-react";
import { StudyPlannerTab } from "@/components/study-ai/planner";
import { TopicReviewModal } from "@/components/study-ai/planner/topic-review-modal";
import { NotebookTab } from "@/components/study-ai/notebook/notebook-tab";

// Planner Topic Review type
interface PlannerTopicReview {
  id: number;
  user_id: string;
  plan_id: string;
  week_number: number;
  day_number: number;
  subject: string;
  topics: string[];
  leitner_box: number;
  next_review_at: string;
  last_reviewed_at: string | null;
  review_count: number;
  is_active: boolean;
  study_plans?: {
    id: string;
    title: string;
    exam_type: string;
  };
}

interface StudyAIClientProps {
  userId: string;
  isPro: boolean;
  generationsByType: Record<string, number>;
  goals: StudyAIGoalRow[];
  recentGenerations: AIGenerationRow[];
  savedGenerations: AIGenerationRow[];
  duePlannerTopics: PlannerTopicReview[];
}

type TabType = "new" | "notebook" | "revision" | "saved" | "planner";

export function StudyAIClient({
  userId,
  isPro,
  generationsByType,
  goals: initialGoals,
  recentGenerations,
  savedGenerations: initialSavedGenerations,
  duePlannerTopics: initialDuePlannerTopics,
}: StudyAIClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabType) || "planner";
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const {
    goals,
    goalsDueForRevision,
    savedGenerations,
    isPro: storeIsPro,
    isInitialized,
    initialize,
    createGoal,
    deleteGoal,
  } = useStudyAIStore();

  const [localSavedGenerations, setLocalSavedGenerations] = useState<AIGenerationRow[]>(initialSavedGenerations);
  const [unsavingIds, setUnsavingIds] = useState<Set<number>>(new Set());
  const [localDuePlannerTopics, setLocalDuePlannerTopics] = useState<PlannerTopicReview[]>(initialDuePlannerTopics);
  const [selectedPlannerReview, setSelectedPlannerReview] = useState<PlannerTopicReview | null>(null);

  // Sync tab with URL query parameter
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl && ["new", "notebook", "revision", "saved", "planner"].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl as TabType);
    } else if (tabFromUrl === "goals") {
      // Redirect old "goals" tab to "new" (merged)
      setActiveTab("new");
    }
  }, [searchParams]);

  // Initialize store
  useEffect(() => {
    if (!isInitialized) {
      initialize(userId);
    }
  }, [userId, isInitialized, initialize]);

  // Sync saved generations from server props when navigating to this page
  useEffect(() => {
    setLocalSavedGenerations(initialSavedGenerations);
  }, [initialSavedGenerations]);

  // Sync planner topics from server props
  useEffect(() => {
    setLocalDuePlannerTopics(initialDuePlannerTopics);
  }, [initialDuePlannerTopics]);

  // Handle planner topic review completion
  const handlePlannerReviewComplete = () => {
    if (selectedPlannerReview) {
      setLocalDuePlannerTopics((prev) =>
        prev.filter((t) => t.id !== selectedPlannerReview.id)
      );
    }
    setSelectedPlannerReview(null);
  };

  const handleUnsave = async (generationId: number) => {
    setUnsavingIds((prev) => new Set(prev).add(generationId));
    try {
      const response = await fetch("/api/study-ai/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId,
          isSaved: false,
        }),
      });

      if (response.ok) {
        setLocalSavedGenerations((prev) => prev.filter((g) => g.id !== generationId));
      }
    } catch (error) {
      console.error("Failed to unsave:", error);
    } finally {
      setUnsavingIds((prev) => {
        const next = new Set(prev);
        next.delete(generationId);
        return next;
      });
    }
  };

  // Use store data if initialized, otherwise use server data
  const displayGoals = isInitialized ? goals : initialGoals;
  const displayIsPro = isInitialized ? storeIsPro : isPro;
  const displayGenerationsByType = generationsByType; // Always use server data for accuracy

  // Filter goals based on search
  const filteredGoals = displayGoals.filter((goal) =>
    goal.goal_text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get goals due for revision (from store or calculate from server data)
  const dueGoals = isInitialized
    ? goalsDueForRevision
    : initialGoals.filter(
        (g) => g.next_revision_at && new Date(g.next_revision_at) <= new Date()
      );

  const handleCreateGoal = async (goalText: string) => {
    setIsCreating(true);
    const newGoal = await createGoal(userId, goalText);
    setIsCreating(false);

    if (newGoal) {
      // Navigate to the goal page to upload content
      router.push(`/study-ai/goals/${newGoal.id}`);
    }
  };

  // Total revision count includes both goals and planner topics
  const totalRevisionDue = dueGoals.length + localDuePlannerTopics.length;

  const tabs = [
    { id: "planner" as TabType, label: "Study Planner", icon: Calendar },
    { id: "new" as TabType, label: "My Goals", icon: FolderOpen, count: displayGoals.length },
    { id: "notebook" as TabType, label: "Notebook", icon: BookMarked },
    { id: "revision" as TabType, label: "Revision", icon: RefreshCw, count: totalRevisionDue },
    { id: "saved" as TabType, label: "Saved", icon: Bookmark, count: localSavedGenerations.length },
  ];

  return (
    <div className="space-y-6 overflow-x-hidden w-full max-w-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="widget-glass p-6 rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">
                Study with AI
              </h1>
              <p className="text-white/60 text-sm">
                Create AI-powered study materials from any content
              </p>
            </div>
          </div>

          {/* Pro Badge */}
          {displayIsPro && (
            <div className="px-3 py-1 rounded-full bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border border-orange-500/30">
              <span className="text-sm font-medium text-orange-400 flex items-center gap-1">
                <Sparkles className="w-4 h-4" />
                Pro
              </span>
            </div>
          )}
        </div>

        {/* Usage Limit Banner */}
        <div className="mt-4">
          <UsageLimitBanner
            generationsByType={displayGenerationsByType}
            isPro={displayIsPro}
            onUpgradeClick={() => setUpgradeModalOpen(true)}
          />
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="widget-glass p-2 rounded-2xl"
      >
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all whitespace-nowrap flex-shrink-0",
                "sm:flex-1",
                activeTab === tab.id
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs",
                    activeTab === tab.id
                      ? "bg-primary/20 text-primary"
                      : "bg-white/10 text-white/60"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Tab Content */}
      {activeTab === "new" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          {/* Goal Input */}
          <div className="widget-glass p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Plus className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-white">Create a Study Goal</h2>
            </div>
            <p className="text-white/60 text-sm mb-6">
              Enter what you want to learn, then upload your study materials (PDFs, images, YouTube URLs)
              to generate AI-powered study content.
            </p>
            <StudyGoalInput onSubmit={handleCreateGoal} isLoading={isCreating} />
          </div>

          {/* Search */}
          {displayGoals.length > 0 && (
            <div className="widget-glass p-4 rounded-2xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  placeholder="Search your study goals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
              </div>
            </div>
          )}

          {/* Goals List */}
          {filteredGoals.length === 0 && displayGoals.length === 0 ? (
            <div className="widget-glass p-8 rounded-2xl text-center">
              <BookOpen className="w-10 h-10 text-white/30 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white mb-1">
                No study goals yet
              </h3>
              <p className="text-white/50 text-sm">
                Create your first study goal above to get started
              </p>
            </div>
          ) : filteredGoals.length === 0 ? (
            <div className="widget-glass p-8 rounded-2xl text-center">
              <Search className="w-10 h-10 text-white/30 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white mb-1">
                No goals found
              </h3>
              <p className="text-white/50 text-sm">
                Try adjusting your search
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGoals.map((goal, index) => (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <GoalCard goal={goal} onDelete={deleteGoal} />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {activeTab === "notebook" && (
        <NotebookTab />
      )}

      {activeTab === "revision" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          {totalRevisionDue === 0 ? (
            <div className="widget-glass p-12 rounded-2xl text-center">
              <Clock className="w-12 h-12 text-white/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                All caught up!
              </h3>
              <p className="text-white/50">
                No items are due for revision right now. Check back later!
              </p>
            </div>
          ) : (
            <>
              <div className="widget-glass p-4 rounded-2xl">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  <span className="text-white/80 text-sm">
                    <span className="font-semibold text-orange-400">{totalRevisionDue}</span>{" "}
                    {totalRevisionDue === 1 ? "item" : "items"} due for revision
                    {dueGoals.length > 0 && localDuePlannerTopics.length > 0 && (
                      <span className="text-white/50">
                        {" "}({dueGoals.length} {dueGoals.length === 1 ? "goal" : "goals"}, {localDuePlannerTopics.length} {localDuePlannerTopics.length === 1 ? "topic" : "topics"})
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Goals Section */}
              {dueGoals.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-white/60 flex items-center gap-2">
                    <Target className="w-4 h-4 text-purple-400" />
                    Study Goals
                  </h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dueGoals.map((goal, index) => (
                      <motion.div
                        key={goal.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * index }}
                      >
                        <GoalCard goal={goal} showRevisionBadge onDelete={deleteGoal} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Planner Topics Section */}
              {localDuePlannerTopics.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-white/60 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    Study Planner Topics
                  </h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {localDuePlannerTopics.map((review, index) => {
                      const LEITNER_LABELS: Record<number, string> = {
                        1: "New",
                        2: "Learning",
                        3: "Reviewing",
                        4: "Familiar",
                        5: "Mastered",
                      };
                      const LEITNER_COLORS: Record<number, string> = {
                        1: "text-red-400 bg-red-500/20",
                        2: "text-orange-400 bg-orange-500/20",
                        3: "text-yellow-400 bg-yellow-500/20",
                        4: "text-blue-400 bg-blue-500/20",
                        5: "text-green-400 bg-green-500/20",
                      };
                      return (
                        <motion.div
                          key={review.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 * (dueGoals.length + index) }}
                        >
                          <button
                            onClick={() => setSelectedPlannerReview(review)}
                            className="w-full text-left relative widget-glass p-4 rounded-xl border border-orange-500/30 hover:bg-white/10 transition-all cursor-pointer group"
                          >
                            {/* Header */}
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                  <Calendar className="w-4 h-4 text-emerald-400" />
                                </div>
                                <div className={cn("px-2 py-0.5 rounded-full text-xs", LEITNER_COLORS[review.leitner_box])}>
                                  {LEITNER_LABELS[review.leitner_box]}
                                </div>
                              </div>
                              <div className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Due
                              </div>
                            </div>

                            {/* Subject */}
                            <h3 className="text-white font-medium mb-2 line-clamp-2 group-hover:text-emerald-400 transition-colors">
                              {review.subject}
                            </h3>

                            {/* Topics */}
                            <p className="text-sm text-white/50 line-clamp-1 mb-2">
                              {review.topics.join(", ")}
                            </p>

                            {/* Stats */}
                            <div className="flex items-center gap-4 text-xs text-white/50">
                              {review.review_count > 0 && (
                                <div className="flex items-center gap-1">
                                  <RefreshCw className="w-3 h-3" />
                                  <span>{review.review_count} revisions</span>
                                </div>
                              )}
                            </div>

                            {/* Next Revision */}
                            <div className="mt-3 pt-3 border-t border-white/10">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-white/40">Next revision</span>
                                <span className="text-orange-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Due now
                                </span>
                              </div>
                            </div>
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Standalone Active Recall */}
          <StandaloneBlurtSection
            goals={displayGoals}
            isPro={displayIsPro}
            userId={userId}
          />

          {/* Link to full Revision Hub */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Link
              href="/study-ai/revision"
              className="block p-4 rounded-2xl text-center border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 hover:border-purple-500/50 transition-all duration-300"
            >
              <span className="text-sm font-medium text-purple-400">
                View Revision Hub — upcoming reviews & blurt sessions →
              </span>
            </Link>
          </motion.div>
        </motion.div>
      )}

      {activeTab === "saved" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          {localSavedGenerations.length === 0 ? (
            <div className="widget-glass p-12 rounded-2xl text-center">
              <Bookmark className="w-12 h-12 text-white/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                No saved materials yet
              </h3>
              <p className="text-white/50 mb-4">
                Save your favorite study materials by clicking the bookmark icon
              </p>
              <Button
                onClick={() => setActiveTab("new")}
                className="bg-primary hover:bg-primary/90"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Browse Goals
              </Button>
            </div>
          ) : (
            <>
              <div className="widget-glass p-4 rounded-2xl">
                <div className="flex items-center gap-2">
                  <BookmarkCheck className="w-4 h-4 text-yellow-400" />
                  <span className="text-white/80 text-sm">
                    <span className="font-semibold text-yellow-400">{localSavedGenerations.length}</span>{" "}
                    saved {localSavedGenerations.length === 1 ? "material" : "materials"}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                {localSavedGenerations.map((gen, index) => {
                  const typeConfig: Record<string, { icon: typeof FileText; color: string; bg: string; label: string }> = {
                    summary: { icon: FileText, color: "text-green-400", bg: "bg-green-500/20", label: "Summary" },
                    mindmap: { icon: Map, color: "text-blue-400", bg: "bg-blue-500/20", label: "Mind Map" },
                    flashcards: { icon: ListChecks, color: "text-yellow-400", bg: "bg-yellow-500/20", label: "Flashcards" },
                    quiz: { icon: HelpCircle, color: "text-purple-400", bg: "bg-purple-500/20", label: "Quiz" },
                    infographic: { icon: BarChart3, color: "text-red-400", bg: "bg-red-500/20", label: "Infographic" },
                  };
                  const config = typeConfig[gen.generation_type] || typeConfig.summary;
                  const Icon = config.icon;

                  return (
                    <motion.div
                      key={gen.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                      className="widget-glass p-4 rounded-xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", config.bg)}>
                          <Icon className={cn("w-5 h-5", config.color)} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">
                            {gen.title || `${config.label}`}
                          </p>
                          <p className="text-white/40 text-sm">{config.label}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnsave(gen.id)}
                          disabled={unsavingIds.has(gen.id)}
                          className="h-9 w-9 p-0 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                        >
                          {unsavingIds.has(gen.id) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <BookmarkCheck className="w-4 h-4" />
                          )}
                        </Button>
                        <Link href={`/study-ai/view/${gen.generation_type}/${gen.id}?from=saved`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 text-white/40 hover:text-white hover:bg-white/10"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </motion.div>
      )}

      {activeTab === "planner" && (
        <StudyPlannerTab userId={userId} isPro={displayIsPro} />
      )}

      {/* Upgrade Modal */}
      <UpgradeModal open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen} />

      {/* Topic Review Modal */}
      {selectedPlannerReview && (
        <TopicReviewModal
          review={selectedPlannerReview}
          isPro={displayIsPro}
          onClose={() => setSelectedPlannerReview(null)}
          onReviewComplete={handlePlannerReviewComplete}
        />
      )}
    </div>
  );
}
