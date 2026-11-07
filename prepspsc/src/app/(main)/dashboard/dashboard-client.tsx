"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { StatsCard } from "@/components/dashboard/stats-card";
import { StudyChart } from "@/components/dashboard/study-chart";
import { StreakCard } from "@/components/dashboard/streak-card";
import { ActivityHeatmap } from "@/components/dashboard/activity-heatmap";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { TasksSection } from "@/components/dashboard/tasks-section";
import { PomodoroHistory } from "@/components/dashboard/pomodoro-history";
import { StudyAIStats } from "@/components/dashboard/study-ai-stats";
import { XPBar, XPBadge } from "@/components/gamification/xp-bar";
import { StreakShieldBadge, StreakShieldCard } from "@/components/gamification/streak-shield-card";
import { useGamificationStore } from "@/stores/gamification-store";
import { AchievementsShowcase } from "@/components/gamification/achievements-grid";
import { formatMinutes } from "@/lib/utils";
import { getProgressToNextLevel, getLevelTitle } from "@/lib/xp";
import { Clock, BookOpen, Target, TrendingUp, Crown, Trophy, Timer, RefreshCw, Code2 } from "lucide-react";
import { isBuilder } from "@/lib/builder";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { Profile, DailyStudyLog, Achievement } from "@/types/database.types";

interface DashboardClientProps {
  profile: Profile | null;
  studyLogs: DailyStudyLog[];
  weeklyChartData: { day: string; minutes: number }[];
  leaderboardUsers: Profile[];
  completedTests: number;
  userId: string;
  achievements?: Achievement[];
  unlockedAchievementIds?: number[];
  hasStudiedToday?: boolean;
}

export function DashboardClient({
  profile,
  studyLogs,
  weeklyChartData,
  leaderboardUsers,
  completedTests,
  userId,
  achievements = [],
  unlockedAchievementIds = [],
  hasStudiedToday = true,
}: DashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hasNewData, setHasNewData] = useState(false);
  const { streakShields, streakShieldsResetAt, useStreakShield, initialize } = useGamificationStore();

  // Check if this is a new user (from onboarding)
  const isNewUser = searchParams.get("welcome") === "new";

  // Initialize gamification store
  useEffect(() => {
    if (userId) {
      initialize(userId);
    }
  }, [userId, initialize]);

  // Listen for study time sync events to show refresh indicator
  useEffect(() => {
    const handleStudyTimeSync = () => {
      setHasNewData(true);
      // Auto-refresh after a short delay
      setTimeout(() => {
        router.refresh();
        setHasNewData(false);
      }, 500);
    };

    window.addEventListener("study-time-synced", handleStudyTimeSync);
    return () => {
      window.removeEventListener("study-time-synced", handleStudyTimeSync);
    };
  }, [router]);

  const totalMinutes = profile?.total_minutes_all_time || 0;
  const currentStreak = profile?.current_streak || 0;
  const maxStreak = profile?.max_streak || 0;

  // XP and Level data
  const xp = profile?.xp_points ?? 0;
  const level = profile?.xp_level ?? 1;
  const isPro = profile?.is_pro_member ?? false;
  const xpProgress = getProgressToNextLevel(xp);

  // Calculate this week's total
  const weeklyTotal = weeklyChartData.reduce((sum, d) => sum + d.minutes, 0);

  return (
    <div className="space-y-6">
      {/* Welcome Section with XP */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="widget-glass p-6 rounded-2xl"
      >
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Avatar className="w-12 h-12 rounded-xl">
              <AvatarImage src={profile?.avatar_url || ""} />
              <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 text-lg font-bold text-white">
                {profile?.full_name?.charAt(0)?.toUpperCase() || profile?.username?.charAt(0)?.toUpperCase() || "S"}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-white">
                  {isNewUser ? "Welcome," : "Welcome back,"}{" "}
                  <span className="text-primary">
                    {profile?.full_name?.split(" ")[0] || profile?.username || "Student"}
                  </span>
                </h1>
                {isPro && <Crown className="w-5 h-5 text-accent" />}
                {isBuilder(profile?.username) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-primary/20 to-cyan-500/20 border border-cyan-500/30 text-xs text-cyan-400 font-medium">
                    <Code2 className="w-3.5 h-3.5" />
                    Builder
                  </span>
                )}
              </div>
              <div className="text-white/60 text-sm flex items-center gap-2">
                <span>{getLevelTitle(level)}</span>
                <span className="text-white/30">•</span>
                <span className="text-primary">{xp.toLocaleString()} XP</span>
                {isPro && (
                  <>
                    <span className="text-white/30">•</span>
                    <StreakShieldBadge shields={streakShields} isPro={isPro} />
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="md:w-72">
            <XPBar
              xp={xp}
              level={level}
              progressPercent={xpProgress.progressPercent}
              xpToNextLevel={xpProgress.xpToNextLevel}
              isPro={isPro}
              size="sm"
            />
          </div>
        </div>
      </motion.div>

      {/* Refresh Indicator */}
      {hasNewData && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-primary/90 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg"
        >
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Updating stats...</span>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="widget-glass p-4 rounded-xl"
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-xs text-white/50">Total Study</span>
          </div>
          <p className="text-xl font-bold text-white">{formatMinutes(totalMinutes)}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="widget-glass p-4 rounded-xl"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-xs text-white/50">This Week</span>
          </div>
          <p className="text-xl font-bold text-white">{formatMinutes(weeklyTotal)}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="widget-glass p-4 rounded-xl"
        >
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-white/50">Tests Done</span>
          </div>
          <p className="text-xl font-bold text-white">{completedTests}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="widget-glass p-4 rounded-xl"
        >
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-white/50">Streak</span>
          </div>
          <p className="text-xl font-bold text-white">{currentStreak} days</p>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="widget-glass p-5 rounded-2xl"
        >
          <h3 className="text-sm font-medium text-white/70 mb-4">Weekly Progress</h3>
          <StudyChart data={weeklyChartData} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35 }}
          className="widget-glass p-5 rounded-2xl"
        >
          <h3 className="text-sm font-medium text-white/70 mb-4">Streak Stats</h3>
          <StreakCard currentStreak={currentStreak} maxStreak={maxStreak} />
        </motion.div>
      </div>

      {/* Streak Shield Card - for Pro users */}
      {isPro && currentStreak > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.37 }}
        >
          <StreakShieldCard
            shields={streakShields}
            maxShields={3}
            resetAt={streakShieldsResetAt}
            isPro={isPro}
            currentStreak={currentStreak}
            isStreakAtRisk={!hasStudiedToday && currentStreak > 0}
            onUseShield={async () => {
              const success = await useStreakShield(userId);
              if (success) {
                router.refresh();
              }
              return success;
            }}
          />
        </motion.div>
      )}

      {/* Tasks, Study AI, and Pomodoro Row */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Tasks Section */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <TasksSection />
        </motion.div>

        {/* Study AI Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42 }}
          className="widget-glass p-5 rounded-2xl"
        >
          <StudyAIStats />
        </motion.div>

        {/* Pomodoro History */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.45 }}
          className="widget-glass p-5 rounded-2xl"
        >
          <div className="flex items-center gap-2 mb-4">
            <Timer className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium text-white/70">Focus Timer</h3>
          </div>
          <PomodoroHistory />
        </motion.div>
      </div>

      {/* Activity Heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="widget-glass p-5 rounded-2xl"
      >
        <h3 className="text-sm font-medium text-white/70 mb-4">Study Activity</h3>
        <ActivityHeatmap logs={studyLogs} />
      </motion.div>

      {/* Achievements Section */}
      {achievements.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="widget-glass p-5 rounded-2xl"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <h3 className="text-sm font-medium text-white/70">
                {isPro ? "Pro Achievements" : "Achievements"}
              </h3>
              <span className="text-xs text-white/40">
                {unlockedAchievementIds.length}/{achievements.length}
              </span>
            </div>
            {!isPro && (
              <Link
                href="/pricing"
                className="text-xs text-accent hover:text-accent/80 flex items-center gap-1"
              >
                <Crown className="w-3 h-3" />
                Unlock Pro Achievements
              </Link>
            )}
          </div>
          <AchievementsShowcase
            achievements={achievements}
            unlockedIds={unlockedAchievementIds}
            maxDisplay={6}
          />
        </motion.div>
      )}

      {/* Leaderboard */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="widget-glass p-5 rounded-2xl"
      >
        <h3 className="text-sm font-medium text-white/70 mb-4">Top Learners</h3>
        <Leaderboard users={leaderboardUsers} currentUserId={userId} />
      </motion.div>
    </div>
  );
}
