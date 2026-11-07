import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type {
  StudyAIGoalRow,
  StudyUploadRow,
  AIGenerationRow,
  RevisionItemRow,
  BlurtSessionRow,
  StudyAINotificationRow,
} from "@/types/database.types";
import type {
  StudyAIStats,
  GoalWithMaterials,
  StudyAIGenerationType,
  BlurtAnalysis,
  GenerationOutput,
  LEITNER_INTERVALS,
} from "@/types/study-ai.types";

interface StudyAIState {
  // Goals
  goals: StudyAIGoalRow[];
  currentGoal: GoalWithMaterials | null;

  // Uploads
  uploads: StudyUploadRow[];

  // Generations
  generations: AIGenerationRow[];
  savedGenerations: AIGenerationRow[];

  // Revision
  revisionItems: RevisionItemRow[];
  dueItems: RevisionItemRow[];
  goalsDueForRevision: StudyAIGoalRow[];

  // Blurt Sessions
  blurtSessions: BlurtSessionRow[];

  // Notifications
  notifications: StudyAINotificationRow[];
  unreadCount: number;

  // Daily limit tracking
  generationsToday: number;
  canGenerate: boolean;
  isPro: boolean;

  // Stats
  stats: StudyAIStats;

  // Loading states
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: (userId: string) => Promise<void>;
  refreshData: (userId: string) => Promise<void>;

  // Goal Actions
  createGoal: (userId: string, goalText: string) => Promise<StudyAIGoalRow | null>;
  getGoalWithMaterials: (goalId: number) => Promise<GoalWithMaterials | null>;
  archiveGoal: (goalId: number) => Promise<boolean>;
  deleteGoal: (goalId: number) => Promise<boolean>;
  markGoalAsRevised: (goalId: number, rating: "easy" | "hard" | "again") => Promise<boolean>;

  // Upload Actions
  addUpload: (
    userId: string,
    goalId: number,
    uploadType: "pdf" | "image" | "youtube" | "anki",
    fileUrl: string | null,
    fileName: string | null,
    extractedText: string | null,
    metadata?: Record<string, unknown>
  ) => Promise<StudyUploadRow | null>;
  deleteUpload: (uploadId: number) => Promise<boolean>;

  // Generation Actions
  checkGenerationLimit: (userId: string) => Promise<{ allowed: boolean; remaining: number }>;
  addGeneration: (
    userId: string,
    goalId: number,
    generationType: StudyAIGenerationType,
    outputData: GenerationOutput,
    title?: string
  ) => Promise<AIGenerationRow | null>;
  toggleSaveGeneration: (generationId: number) => Promise<boolean>;

  // Revision Actions
  getItemsDueForReview: (userId: string) => Promise<RevisionItemRow[]>;
  reviewItem: (itemId: number, rating: "easy" | "hard" | "again") => Promise<boolean>;

  // Blurt Actions
  createBlurtSession: (
    userId: string,
    goalId: number,
    mode: "digital" | "paper",
    userInput: string | null,
    paperImageUrl: string | null,
    topic?: string
  ) => Promise<BlurtSessionRow | null>;
  updateBlurtAnalysis: (
    sessionId: number,
    analysis: BlurtAnalysis,
    score: number,
    xpEarned: number
  ) => Promise<boolean>;

  // Notification Actions
  markNotificationRead: (notificationId: number) => Promise<boolean>;
  markAllNotificationsRead: (userId: string) => Promise<boolean>;

  // Stats Actions
  fetchStats: (userId: string) => Promise<StudyAIStats>;
}

export const useStudyAIStore = create<StudyAIState>((set, get) => ({
  // Initial state
  goals: [],
  currentGoal: null,
  uploads: [],
  generations: [],
  savedGenerations: [],
  revisionItems: [],
  dueItems: [],
  goalsDueForRevision: [],
  blurtSessions: [],
  notifications: [],
  unreadCount: 0,
  generationsToday: 0,
  canGenerate: true,
  isPro: false,
  stats: {
    totalStudyGoals: 0,
    materialsGenerated: 0,
    itemsSaved: 0,
    revisionStreak: 0,
    dueForReview: 0,
    lastActivityAt: null,
  },
  isLoading: true,
  isInitialized: false,

  initialize: async (userId: string) => {
    if (get().isInitialized) return;

    set({ isLoading: true });
    const supabase = createClient();

    try {
      // Fetch all data in parallel
      const [
        profileResult,
        goalsResult,
        generationsResult,
        notificationsResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("is_pro_member, study_ai_generations_today, study_ai_last_generation_date")
          .eq("id", userId)
          .single(),
        supabase
          .from("study_ai_goals")
          .select("*")
          .eq("user_id", userId)
          .eq("is_archived", false)
          .order("created_at", { ascending: false }),
        supabase
          .from("ai_generations")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("study_ai_notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const profile = profileResult.data;
      const isPro = profile?.is_pro_member ?? false;

      // Check if it's a new day
      const today = new Date().toISOString().split("T")[0];
      const lastGenDate = profile?.study_ai_last_generation_date;
      const isNewDay = !lastGenDate || lastGenDate !== today;
      const generationsToday = isNewDay ? 0 : (profile?.study_ai_generations_today ?? 0);

      // Get goals due for revision
      const now = new Date().toISOString();
      const goalsDueForRevision = (goalsResult.data || []).filter(
        (goal) => goal.next_revision_at && goal.next_revision_at <= now
      );

      // Get saved generations
      const savedGenerations = (generationsResult.data || []).filter((g) => g.is_saved);

      // Get unread notifications count
      const unreadCount = (notificationsResult.data || []).filter((n) => !n.is_read).length;

      set({
        goals: goalsResult.data || [],
        generations: generationsResult.data || [],
        savedGenerations,
        goalsDueForRevision,
        notifications: notificationsResult.data || [],
        unreadCount,
        generationsToday,
        canGenerate: isPro || generationsToday < 1,
        isPro,
        stats: {
          totalStudyGoals: (goalsResult.data || []).length,
          materialsGenerated: (generationsResult.data || []).length,
          itemsSaved: savedGenerations.length,
          revisionStreak: 0, // Calculate separately if needed
          dueForReview: goalsDueForRevision.length,
          lastActivityAt: goalsResult.data?.[0]?.created_at || null,
        },
        isLoading: false,
        isInitialized: true,
      });
    } catch (error) {
      console.error("Error initializing Study AI store:", error);
      set({ isLoading: false, isInitialized: true });
    }
  },

  refreshData: async (userId: string) => {
    set({ isInitialized: false });
    await get().initialize(userId);
  },

  createGoal: async (userId, goalText) => {
    const supabase = createClient();

    // Calculate first revision date (1 day from now)
    const nextRevisionAt = new Date();
    nextRevisionAt.setDate(nextRevisionAt.getDate() + 1);

    const { data, error } = await supabase
      .from("study_ai_goals")
      .insert({
        user_id: userId,
        goal_text: goalText,
        next_revision_at: nextRevisionAt.toISOString(),
        leitner_box: 1,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("Error creating study goal:", error);
      return null;
    }

    set({ goals: [data, ...get().goals] });
    return data;
  },

  getGoalWithMaterials: async (goalId) => {
    const supabase = createClient();

    const [goalResult, uploadsResult, generationsResult] = await Promise.all([
      supabase.from("study_ai_goals").select("*").eq("id", goalId).single(),
      supabase.from("study_uploads").select("*").eq("goal_id", goalId).order("created_at"),
      supabase.from("ai_generations").select("*").eq("goal_id", goalId).order("created_at", { ascending: false }),
    ]);

    if (!goalResult.data) return null;

    const goalWithMaterials: GoalWithMaterials = {
      ...goalResult.data,
      uploads: uploadsResult.data || [],
      generations: generationsResult.data || [],
    };

    set({ currentGoal: goalWithMaterials });
    return goalWithMaterials;
  },

  archiveGoal: async (goalId) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("study_ai_goals")
      .update({ is_archived: true })
      .eq("id", goalId);

    if (error) return false;

    set({
      goals: get().goals.filter((g) => g.id !== goalId),
      currentGoal: get().currentGoal?.id === goalId ? null : get().currentGoal,
    });
    return true;
  },

  deleteGoal: async (goalId) => {
    const supabase = createClient();

    // Get generation IDs for this goal (revision_items reference generation_id, not goal_id)
    const { data: goalGenerations } = await supabase
      .from("ai_generations")
      .select("id")
      .eq("goal_id", goalId);

    const generationIds = goalGenerations?.map((g) => g.id) || [];

    // Delete related records (cascade)
    // NOTE: xp_transactions and profile.xp_points are intentionally preserved
    const deleteOps = [
      supabase.from("blurt_sessions").delete().eq("goal_id", goalId),
      supabase.from("study_uploads").delete().eq("goal_id", goalId),
      supabase.from("study_ai_notifications").delete().eq("goal_id", goalId),
    ];

    // Delete revision_items linked to this goal's generations
    if (generationIds.length > 0) {
      deleteOps.push(
        supabase.from("revision_items").delete().in("generation_id", generationIds)
      );
    }

    await Promise.all(deleteOps);

    // Delete generations after revision_items are removed
    await supabase.from("ai_generations").delete().eq("goal_id", goalId);

    // Delete the goal itself
    const { error } = await supabase
      .from("study_ai_goals")
      .delete()
      .eq("id", goalId);

    if (error) {
      console.error("Error deleting goal:", error);
      return false;
    }

    // Update local state
    const updatedGoals = get().goals.filter((g) => g.id !== goalId);
    const updatedGenerations = get().generations.filter((g) => g.goal_id !== goalId);
    set({
      goals: updatedGoals,
      goalsDueForRevision: updatedGoals.filter(
        (g) => g.next_revision_at && g.next_revision_at <= new Date().toISOString()
      ),
      generations: updatedGenerations,
      savedGenerations: updatedGenerations.filter((g) => g.is_saved),
      currentGoal: get().currentGoal?.id === goalId ? null : get().currentGoal,
    });
    return true;
  },

  markGoalAsRevised: async (goalId, rating) => {
    const supabase = createClient();
    const goal = get().goals.find((g) => g.id === goalId);
    if (!goal) return false;

    // Calculate new Leitner box
    let newBox = goal.leitner_box;
    if (rating === "easy") {
      newBox = Math.min(goal.leitner_box + 1, 5) as 1 | 2 | 3 | 4 | 5;
    } else if (rating === "again") {
      newBox = 1;
    }

    // Calculate next revision date based on Leitner intervals
    const intervals: Record<number, number> = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
    const nextRevisionAt = new Date();
    nextRevisionAt.setDate(nextRevisionAt.getDate() + intervals[newBox]);

    const { error } = await supabase
      .from("study_ai_goals")
      .update({
        leitner_box: newBox,
        revision_count: goal.revision_count + 1,
        last_revised_at: new Date().toISOString(),
        next_revision_at: nextRevisionAt.toISOString(),
      })
      .eq("id", goalId);

    if (error) return false;

    // Update local state
    const updatedGoals = get().goals.map((g) =>
      g.id === goalId
        ? {
            ...g,
            leitner_box: newBox,
            revision_count: g.revision_count + 1,
            last_revised_at: new Date().toISOString(),
            next_revision_at: nextRevisionAt.toISOString(),
          }
        : g
    );

    set({
      goals: updatedGoals,
      goalsDueForRevision: updatedGoals.filter(
        (g) => g.next_revision_at && g.next_revision_at <= new Date().toISOString()
      ),
    });

    return true;
  },

  addUpload: async (userId, goalId, uploadType, fileUrl, fileName, extractedText, metadata = {}) => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("study_uploads")
      .insert({
        user_id: userId,
        goal_id: goalId,
        upload_type: uploadType,
        file_url: fileUrl,
        file_name: fileName,
        extracted_text: extractedText,
        metadata,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("Error adding upload:", error);
      return null;
    }

    set({ uploads: [...get().uploads, data] });

    // Update current goal if viewing
    if (get().currentGoal?.id === goalId) {
      set({
        currentGoal: {
          ...get().currentGoal!,
          uploads: [...get().currentGoal!.uploads, data],
        },
      });
    }

    return data;
  },

  deleteUpload: async (uploadId) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("study_uploads")
      .delete()
      .eq("id", uploadId);

    if (error) {
      console.error("Error deleting upload:", error);
      return false;
    }

    set({ uploads: get().uploads.filter((u) => u.id !== uploadId) });

    // Update current goal if viewing
    const currentGoal = get().currentGoal;
    if (currentGoal) {
      set({
        currentGoal: {
          ...currentGoal,
          uploads: currentGoal.uploads.filter((u) => u.id !== uploadId),
        },
      });
    }

    return true;
  },

  checkGenerationLimit: async (userId) => {
    const { isPro, generationsToday } = get();

    if (isPro) {
      return { allowed: true, remaining: -1 }; // -1 means unlimited
    }

    const remaining = Math.max(0, 1 - generationsToday);
    return { allowed: remaining > 0, remaining };
  },

  addGeneration: async (userId, goalId, generationType, outputData, title) => {
    const supabase = createClient();
    const { isPro, generationsToday } = get();

    // Check limit for free users
    if (!isPro && generationsToday >= 1) {
      console.error("Daily generation limit reached");
      return null;
    }

    const { data, error } = await supabase
      .from("ai_generations")
      .insert({
        user_id: userId,
        goal_id: goalId,
        generation_type: generationType,
        output_data: outputData as unknown as Record<string, unknown>,
        title: title || `${generationType} - ${new Date().toLocaleDateString()}`,
        is_saved: false,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("Error adding generation:", error);
      return null;
    }

    // Increment generation count for free users
    if (!isPro) {
      const today = new Date().toISOString().split("T")[0];
      await supabase
        .from("profiles")
        .update({
          study_ai_generations_today: generationsToday + 1,
          study_ai_last_generation_date: today,
        })
        .eq("id", userId);

      set({
        generationsToday: generationsToday + 1,
        canGenerate: false,
      });
    }

    set({ generations: [data, ...get().generations] });

    // Update current goal if viewing
    if (get().currentGoal?.id === goalId) {
      set({
        currentGoal: {
          ...get().currentGoal!,
          generations: [data, ...get().currentGoal!.generations],
        },
      });
    }

    return data;
  },

  toggleSaveGeneration: async (generationId) => {
    const supabase = createClient();
    const generation = get().generations.find((g) => g.id === generationId);
    if (!generation) return false;

    const newSavedState = !generation.is_saved;

    const { error } = await supabase
      .from("ai_generations")
      .update({ is_saved: newSavedState })
      .eq("id", generationId);

    if (error) return false;

    // Update local state
    const updatedGenerations = get().generations.map((g) =>
      g.id === generationId ? { ...g, is_saved: newSavedState } : g
    );

    set({
      generations: updatedGenerations,
      savedGenerations: updatedGenerations.filter((g) => g.is_saved),
    });

    // Update current goal if viewing
    if (get().currentGoal) {
      const updatedGoalGenerations = get().currentGoal!.generations.map((g) =>
        g.id === generationId ? { ...g, is_saved: newSavedState } : g
      );
      set({
        currentGoal: {
          ...get().currentGoal!,
          generations: updatedGoalGenerations,
        },
      });
    }

    return true;
  },

  getItemsDueForReview: async (userId) => {
    const supabase = createClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("revision_items")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .lte("next_review_at", now)
      .order("next_review_at");

    if (error) {
      console.error("Error fetching due items:", error);
      return [];
    }

    set({ dueItems: data || [] });
    return data || [];
  },

  reviewItem: async (itemId, rating) => {
    const supabase = createClient();
    const item = get().revisionItems.find((i) => i.id === itemId) || get().dueItems.find((i) => i.id === itemId);
    if (!item) return false;

    // Calculate new Leitner box
    let newBox = item.leitner_box;
    if (rating === "easy") {
      newBox = Math.min(item.leitner_box + 1, 5);
    } else if (rating === "again") {
      newBox = 1;
    }

    // Calculate next review date
    const intervals: Record<number, number> = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + intervals[newBox]);

    const { error } = await supabase
      .from("revision_items")
      .update({
        leitner_box: newBox,
        review_count: item.review_count + 1,
        last_reviewed_at: new Date().toISOString(),
        next_review_at: nextReviewAt.toISOString(),
      })
      .eq("id", itemId);

    if (error) return false;

    // Remove from due items
    set({
      dueItems: get().dueItems.filter((i) => i.id !== itemId),
    });

    return true;
  },

  createBlurtSession: async (userId, goalId, mode, userInput, paperImageUrl, topic) => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("blurt_sessions")
      .insert({
        user_id: userId,
        goal_id: goalId,
        mode,
        user_input: userInput,
        paper_image_url: paperImageUrl,
        topic,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("Error creating blurt session:", error);
      return null;
    }

    set({ blurtSessions: [data, ...get().blurtSessions] });
    return data;
  },

  updateBlurtAnalysis: async (sessionId, analysis, score, xpEarned) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("blurt_sessions")
      .update({
        ai_analysis: analysis as unknown as Record<string, unknown>,
        score,
        xp_earned: xpEarned,
      })
      .eq("id", sessionId);

    if (error) return false;

    // Update local state
    const updatedSessions = get().blurtSessions.map((s) => {
      if (s.id === sessionId) {
        return { ...s, ai_analysis: analysis as unknown as typeof s.ai_analysis, score, xp_earned: xpEarned };
      }
      return s;
    });
    set({ blurtSessions: updatedSessions });

    return true;
  },

  markNotificationRead: async (notificationId) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("study_ai_notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) return false;

    const updatedNotifications = get().notifications.map((n) =>
      n.id === notificationId ? { ...n, is_read: true } : n
    );
    const unreadCount = updatedNotifications.filter((n) => !n.is_read).length;

    set({ notifications: updatedNotifications, unreadCount });
    return true;
  },

  markAllNotificationsRead: async (userId) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("study_ai_notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) return false;

    const updatedNotifications = get().notifications.map((n) => ({ ...n, is_read: true }));
    set({ notifications: updatedNotifications, unreadCount: 0 });
    return true;
  },

  fetchStats: async (userId) => {
    const supabase = createClient();

    const [goalsResult, generationsResult, blurtResult] = await Promise.all([
      supabase
        .from("study_ai_goals")
        .select("id, next_revision_at, created_at")
        .eq("user_id", userId)
        .eq("is_archived", false),
      supabase.from("ai_generations").select("id, is_saved, created_at").eq("user_id", userId),
      supabase
        .from("blurt_sessions")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    const goals = goalsResult.data || [];
    const generations = generationsResult.data || [];
    const now = new Date().toISOString();

    const stats: StudyAIStats = {
      totalStudyGoals: goals.length,
      materialsGenerated: generations.length,
      itemsSaved: generations.filter((g) => g.is_saved).length,
      revisionStreak: 0, // Calculate based on consecutive days
      dueForReview: goals.filter((g) => g.next_revision_at && g.next_revision_at <= now).length,
      lastActivityAt:
        generations[0]?.created_at ||
        goals[0]?.created_at ||
        blurtResult.data?.[0]?.created_at ||
        null,
    };

    set({ stats });
    return stats;
  },
}));
