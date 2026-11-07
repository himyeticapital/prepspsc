import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type {
  Achievement,
  UserAchievement,
  ProfileFrame,
  StudyGoal,
  XPTransaction,
  StudySession,
} from "@/types/database.types";
import {
  getLevelFromXP,
  getProgressToNextLevel,
  calculateStudySessionXP,
  calculateStreakMilestoneXP,
  XP_REWARDS,
} from "@/lib/xp";
import { checkAchievements, type AchievementCheckContext } from "@/lib/achievements";

interface GamificationState {
  // XP & Levels
  xp: number;
  level: number;
  xpProgress: {
    currentLevel: number;
    currentLevelXP: number;
    nextLevelXP: number;
    progressXP: number;
    progressPercent: number;
    xpToNextLevel: number;
  };

  // Achievements
  achievements: Achievement[];
  userAchievements: UserAchievement[];
  unlockedAchievementIds: number[];

  // Streak Shields
  streakShields: number;
  streakShieldsResetAt: string | null;

  // Profile Frames
  profileFrames: ProfileFrame[];
  currentFrame: string | null;

  // Study Goals
  activeGoals: StudyGoal[];

  // Session History
  recentSessions: StudySession[];

  // XP History
  xpHistory: XPTransaction[];

  // Loading states
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: (userId: string) => Promise<void>;
  refreshData: (userId: string) => Promise<void>;

  // XP Actions
  awardXP: (
    userId: string,
    amount: number,
    reason: string,
    referenceId?: string
  ) => Promise<number>;

  // Achievement Actions
  checkAndUnlockAchievements: (
    userId: string,
    context: Partial<AchievementCheckContext>
  ) => Promise<Achievement[]>;

  // Streak Shield Actions
  useStreakShield: (userId: string) => Promise<boolean>;

  // Profile Frame Actions
  setProfileFrame: (userId: string, frameSlug: string) => Promise<boolean>;

  // Study Goal Actions
  createStudyGoal: (
    userId: string,
    goalType: "weekly" | "monthly",
    targetMinutes: number
  ) => Promise<boolean>;
  updateGoalProgress: (userId: string, minutes: number) => Promise<void>;

  // Session Actions
  recordStudySession: (
    userId: string,
    durationSeconds: number,
    mode: "pomodoro" | "stopwatch" | "countdown",
    roomId?: number
  ) => Promise<{ xpEarned: number; newAchievements: Achievement[] }>;
}

export const useGamificationStore = create<GamificationState>((set, get) => ({
  // Initial state
  xp: 0,
  level: 1,
  xpProgress: {
    currentLevel: 1,
    currentLevelXP: 0,
    nextLevelXP: 100,
    progressXP: 0,
    progressPercent: 0,
    xpToNextLevel: 100,
  },
  achievements: [],
  userAchievements: [],
  unlockedAchievementIds: [],
  streakShields: 0,
  streakShieldsResetAt: null,
  profileFrames: [],
  currentFrame: null,
  activeGoals: [],
  recentSessions: [],
  xpHistory: [],
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
        achievementsResult,
        userAchievementsResult,
        framesResult,
        goalsResult,
        sessionsResult,
        xpHistoryResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("xp_points, xp_level, streak_shields_remaining, streak_shields_reset_at, profile_frame, is_pro_member")
          .eq("id", userId)
          .single(),
        supabase.from("achievements").select("*").order("sort_order"),
        supabase.from("user_achievements").select("*").eq("user_id", userId),
        supabase.from("profile_frames").select("*").order("sort_order"),
        supabase
          .from("study_goals")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "active"),
        supabase
          .from("study_sessions")
          .select("*")
          .eq("user_id", userId)
          .order("ended_at", { ascending: false })
          .limit(50),
        supabase
          .from("xp_transactions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const profile = profileResult.data;
      const xp = profile?.xp_points ?? 0;
      const level = profile?.xp_level ?? getLevelFromXP(xp);

      // Monthly shield reset for Pro members
      let shields = profile?.streak_shields_remaining ?? 0;
      let shieldsResetAt = profile?.streak_shields_reset_at ?? null;

      if (profile?.is_pro_member) {
        const now = new Date();
        let needsReset = false;

        if (!shieldsResetAt) {
          // First time Pro user - initialize shields
          needsReset = true;
        } else {
          const resetDate = new Date(shieldsResetAt);
          // If reset was in a previous month, reset shields to 3
          if (
            resetDate.getMonth() !== now.getMonth() ||
            resetDate.getFullYear() !== now.getFullYear()
          ) {
            needsReset = true;
          }
        }

        if (needsReset) {
          shields = 3;
          shieldsResetAt = now.toISOString();
          // Persist reset to database
          await supabase
            .from("profiles")
            .update({
              streak_shields_remaining: 3,
              streak_shields_reset_at: shieldsResetAt,
            })
            .eq("id", userId);
        }
      }

      set({
        xp,
        level,
        xpProgress: getProgressToNextLevel(xp),
        achievements: achievementsResult.data || [],
        userAchievements: userAchievementsResult.data || [],
        unlockedAchievementIds: (userAchievementsResult.data || []).map(
          (ua) => ua.achievement_id
        ),
        streakShields: shields,
        streakShieldsResetAt: shieldsResetAt,
        profileFrames: framesResult.data || [],
        currentFrame: profile?.profile_frame ?? null,
        activeGoals: goalsResult.data || [],
        recentSessions: sessionsResult.data || [],
        xpHistory: xpHistoryResult.data || [],
        isLoading: false,
        isInitialized: true,
      });
    } catch (error) {
      console.error("Error initializing gamification store:", error);
      set({ isLoading: false, isInitialized: true });
    }
  },

  refreshData: async (userId: string) => {
    set({ isInitialized: false });
    await get().initialize(userId);
  },

  awardXP: async (userId, amount, reason, referenceId) => {
    const supabase = createClient();

    // Get user's Pro status for multiplier
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro_member, xp_points")
      .eq("id", userId)
      .single();

    const isPro = profile?.is_pro_member ?? false;
    const multiplier = isPro ? 1.5 : 1;
    const finalAmount = Math.floor(amount * multiplier);

    // Insert XP transaction
    await supabase.from("xp_transactions").insert({
      user_id: userId,
      amount: finalAmount,
      reason,
      multiplier,
      reference_id: referenceId,
    });

    // Update profile XP
    const newXP = (profile?.xp_points ?? 0) + finalAmount;
    const newLevel = getLevelFromXP(newXP);

    await supabase
      .from("profiles")
      .update({
        xp_points: newXP,
        xp_level: newLevel,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    // Update local state
    set({
      xp: newXP,
      level: newLevel,
      xpProgress: getProgressToNextLevel(newXP),
    });

    return finalAmount;
  },

  checkAndUnlockAchievements: async (userId, partialContext) => {
    const supabase = createClient();
    const { achievements, unlockedAchievementIds } = get();

    // Fetch full profile for context
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!profile) return [];

    // Fetch test stats if needed
    let testsCompleted = partialContext.testsCompleted;
    if (testsCompleted === undefined) {
      const { count } = await supabase
        .from("test_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "completed");
      testsCompleted = count ?? 0;
    }

    const context: AchievementCheckContext = {
      profile,
      testsCompleted,
      testPassStreak: partialContext.testPassStreak,
      hasPerfectScore: partialContext.hasPerfectScore,
      currentHour: partialContext.currentHour ?? new Date().getHours(),
      isWeekend: partialContext.isWeekend,
      studiedBothWeekendDays: partialContext.studiedBothWeekendDays,
    };

    // Get slugs of already unlocked achievements
    const unlockedSlugs = achievements
      .filter((a) => unlockedAchievementIds.includes(a.id))
      .map((a) => a.slug);

    // Check for new achievements
    const newlyUnlockedSlugs = checkAchievements(context, unlockedSlugs);

    if (newlyUnlockedSlugs.length === 0) return [];

    // Get achievement records for newly unlocked
    const newlyUnlocked = achievements.filter((a) =>
      newlyUnlockedSlugs.includes(a.slug)
    );

    // Insert user_achievements records
    const inserts = newlyUnlocked.map((a) => ({
      user_id: userId,
      achievement_id: a.id,
    }));

    await supabase.from("user_achievements").insert(inserts);

    // Award XP for each achievement
    for (const achievement of newlyUnlocked) {
      if (achievement.xp_reward > 0) {
        await get().awardXP(
          userId,
          achievement.xp_reward,
          "achievement_unlock",
          achievement.slug
        );
      }
    }

    // Award streak milestone XP (separate from achievement XP)
    const streak = profile.current_streak;
    const { finalXP: milestoneXP, milestone } = calculateStreakMilestoneXP(
      streak,
      profile.is_pro_member
    );

    if (milestone && milestoneXP > 0) {
      // Check if this milestone was already awarded
      const { data: existingMilestone } = await supabase
        .from("xp_transactions")
        .select("id")
        .eq("user_id", userId)
        .eq("reason", "streak_milestone")
        .eq("reference_id", `streak_${milestone}`)
        .maybeSingle();

      if (!existingMilestone) {
        // Award milestone XP directly (not through awardXP to avoid double multiplier)
        await supabase.from("xp_transactions").insert({
          user_id: userId,
          amount: milestoneXP,
          reason: "streak_milestone",
          multiplier: profile.is_pro_member ? 1.5 : 1,
          reference_id: `streak_${milestone}`,
        });

        // Update profile XP
        const currentXP = profile.xp_points || 0;
        const newXP = currentXP + milestoneXP;
        const newLevel = getLevelFromXP(newXP);

        await supabase
          .from("profiles")
          .update({ xp_points: newXP, xp_level: newLevel })
          .eq("id", userId);

        // Update local state
        set({
          xp: newXP,
          level: newLevel,
          xpProgress: getProgressToNextLevel(newXP),
        });

        console.log(`Awarded ${milestoneXP} XP for ${milestone}-day streak milestone`);
      }
    }

    // Update local state
    set({
      unlockedAchievementIds: [
        ...unlockedAchievementIds,
        ...newlyUnlocked.map((a) => a.id),
      ],
      userAchievements: [
        ...get().userAchievements,
        ...inserts.map((i, idx) => ({
          id: Date.now() + idx,
          user_id: userId,
          achievement_id: i.achievement_id,
          unlocked_at: new Date().toISOString(),
        })),
      ],
    });

    return newlyUnlocked;
  },

  useStreakShield: async (userId) => {
    const { streakShields } = get();
    if (streakShields <= 0) return false;

    const supabase = createClient();

    // Check if user is Pro
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro_member, current_streak")
      .eq("id", userId)
      .single();

    if (!profile?.is_pro_member) return false;

    // Get yesterday's date (the missed day that would break the streak)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const today = new Date().toISOString().split("T")[0];

    // Insert a study log entry for YESTERDAY (0 minutes) to fill the gap
    // This ensures calculate_streak sees a continuous sequence of days
    const { data: existingYesterdayLog } = await supabase
      .from("daily_study_logs")
      .select("id")
      .eq("user_id", userId)
      .eq("study_date", yesterdayStr)
      .maybeSingle();

    if (!existingYesterdayLog) {
      await supabase.from("daily_study_logs").insert({
        user_id: userId,
        study_date: yesterdayStr,
        minutes_studied: 0,
      });
    }

    // Also ensure today has an entry (even if 0) so streak continues
    const { data: existingTodayLog } = await supabase
      .from("daily_study_logs")
      .select("id")
      .eq("user_id", userId)
      .eq("study_date", today)
      .maybeSingle();

    if (!existingTodayLog) {
      await supabase.from("daily_study_logs").insert({
        user_id: userId,
        study_date: today,
        minutes_studied: 0,
      });
    }

    // Decrement shield count
    const { error } = await supabase
      .from("profiles")
      .update({
        streak_shields_remaining: streakShields - 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) return false;

    // Recalculate streak to confirm it's preserved
    await supabase.rpc("calculate_streak", { p_user_id: userId });

    set({ streakShields: streakShields - 1 });
    return true;
  },

  setProfileFrame: async (userId, frameSlug) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("profiles")
      .update({
        profile_frame: frameSlug,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) return false;

    set({ currentFrame: frameSlug });
    return true;
  },

  createStudyGoal: async (userId, goalType, targetMinutes) => {
    const supabase = createClient();

    // Calculate start and end dates
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (goalType === "weekly") {
      // Start from Monday of current week
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate = new Date(now);
      startDate.setDate(now.getDate() - daysToMonday);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Start from 1st of current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const { data, error } = await supabase
      .from("study_goals")
      .insert({
        user_id: userId,
        goal_type: goalType,
        target_minutes: targetMinutes,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        progress_minutes: 0,
        status: "active",
      })
      .select()
      .single();

    if (error || !data) return false;

    set({ activeGoals: [...get().activeGoals, data] });
    return true;
  },

  updateGoalProgress: async (userId, minutes) => {
    const supabase = createClient();
    const { activeGoals } = get();

    for (const goal of activeGoals) {
      const newProgress = goal.progress_minutes + minutes;
      const isCompleted = newProgress >= goal.target_minutes;

      await supabase
        .from("study_goals")
        .update({
          progress_minutes: newProgress,
          status: isCompleted ? "completed" : "active",
        })
        .eq("id", goal.id);

      // Award XP for goal completion
      if (isCompleted && goal.status === "active") {
        const xpReward =
          goal.goal_type === "weekly"
            ? XP_REWARDS.GOAL_WEEKLY_COMPLETE
            : XP_REWARDS.GOAL_MONTHLY_COMPLETE;

        await get().awardXP(userId, xpReward, "goal_complete", goal.id.toString());
      }
    }

    // Refresh goals
    const { data: updatedGoals } = await supabase
      .from("study_goals")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active");

    set({ activeGoals: updatedGoals || [] });
  },

  recordStudySession: async (userId, durationSeconds, mode, roomId) => {
    const supabase = createClient();
    const durationMinutes = Math.floor(durationSeconds / 60);

    // Get user's Pro status
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro_member")
      .eq("id", userId)
      .single();

    const isPro = profile?.is_pro_member ?? false;

    // Calculate XP
    const { finalXP } = calculateStudySessionXP(durationMinutes, isPro);

    // Record session
    const sessionData = {
      user_id: userId,
      room_id: roomId ?? null,
      duration_seconds: durationSeconds,
      mode,
      xp_earned: finalXP,
      started_at: new Date(Date.now() - durationSeconds * 1000).toISOString(),
      ended_at: new Date().toISOString(),
    };

    await supabase.from("study_sessions").insert(sessionData);

    // Award XP
    await get().awardXP(userId, durationMinutes, "study_session");

    // Update goal progress
    await get().updateGoalProgress(userId, durationMinutes);

    // Update profile total_minutes_all_time
    const { error: rpcError } = await supabase.rpc("increment_study_time", {
      user_id: userId,
      minutes: durationMinutes,
    });

    // Fallback if RPC doesn't exist
    if (rpcError) {
      await supabase
        .from("profiles")
        .update({
          total_minutes_all_time: (profile as any)?.total_minutes_all_time + durationMinutes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    }

    // Check for new achievements
    const newAchievements = await get().checkAndUnlockAchievements(userId, {
      currentHour: new Date().getHours(),
    });

    // Update recent sessions
    const { data: sessions } = await supabase
      .from("study_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("ended_at", { ascending: false })
      .limit(50);

    set({ recentSessions: sessions || [] });

    return { xpEarned: finalXP, newAchievements };
  },
}));
