"use client";

import { motion } from "framer-motion";
import { Trophy, Sparkles, Medal, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile, Achievement, UserAchievement } from "@/types/database.types";
import { XPBar } from "@/components/gamification/xp-bar";
import { AchievementsGrid } from "@/components/gamification/achievements-grid";
import { getProgressToNextLevel, getLevelTitle, formatXP } from "@/lib/xp";

interface AchievementsClientProps {
  profile: Profile | null;
  achievements: Achievement[];
  userAchievements: (UserAchievement & { achievement: Achievement })[];
  testsCompleted: number;
}

export function AchievementsClient({
  profile,
  achievements,
  userAchievements,
  testsCompleted,
}: AchievementsClientProps) {
  const unlockedIds = userAchievements.map((ua) => ua.achievement_id);
  const isPro = profile?.is_pro_member ?? false;

  const xp = profile?.xp_points ?? 0;
  const level = profile?.xp_level ?? 1;
  const xpProgress = getProgressToNextLevel(xp);

  // Stats
  const totalAchievements = achievements.length;
  const unlockedCount = unlockedIds.length;
  const totalXPFromAchievements = userAchievements.reduce(
    (acc, ua) => acc + (ua.achievement?.xp_reward ?? 0),
    0
  );

  // Get rarest achievements (Pro-only or high requirement)
  const rareAchievements = achievements
    .filter(
      (a) =>
        (a.is_pro_only || (a.requirement_value && a.requirement_value >= 30)) &&
        unlockedIds.includes(a.id)
    )
    .slice(0, 3);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 mb-4">
          <Trophy className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium text-primary">Achievements</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Your Progress</h1>
        <p className="text-white/60">
          Track your learning journey and unlock achievements
        </p>
      </motion.div>

      {/* XP & Level Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10"
      >
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Level badge */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                <span className="text-3xl font-bold text-white">{level}</span>
              </div>
              {isPro && (
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                  <Crown className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {getLevelTitle(level)}
              </h2>
              <p className="text-sm text-white/60">Level {level}</p>
            </div>
          </div>

          {/* XP Progress */}
          <div className="flex-1">
            <XPBar
              xp={xp}
              level={level}
              progressPercent={xpProgress.progressPercent}
              xpToNextLevel={xpProgress.xpToNextLevel}
              isPro={isPro}
              size="lg"
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{formatXP(xp)}</div>
            <div className="text-xs text-white/50">Total XP</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{unlockedCount}</div>
            <div className="text-xs text-white/50">Achievements</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {formatXP(totalXPFromAchievements)}
            </div>
            <div className="text-xs text-white/50">XP from Achievements</div>
          </div>
        </div>
      </motion.div>

      {/* Rare achievements showcase */}
      {rareAchievements.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-5 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20"
        >
          <div className="flex items-center gap-2 mb-4">
            <Medal className="w-5 h-5 text-yellow-400" />
            <h3 className="font-semibold text-white">Rare Achievements</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {rareAchievements.map((achievement) => (
              <div
                key={achievement.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10"
              >
                <Sparkles className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-medium text-white">
                  {achievement.name}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* All Achievements */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-xl font-bold text-white mb-4">All Achievements</h2>
        <AchievementsGrid
          achievements={achievements}
          unlockedIds={unlockedIds}
          profile={profile}
          isPro={isPro}
          showFilters={true}
          columns={2}
        />
      </motion.div>

      {/* Pro upsell for non-Pro users */}
      {!isPro && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-6 rounded-xl bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/20"
        >
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex-shrink-0">
              <Crown className="w-12 h-12 text-accent" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-lg font-bold text-white">
                Unlock Pro-Only Achievements
              </h3>
              <p className="text-sm text-white/60 mt-1">
                Pro members get access to exclusive achievements, 1.5x XP
                multiplier, streak shields, and more!
              </p>
            </div>
            <a
              href="/pricing"
              className="px-6 py-3 rounded-lg bg-accent text-white font-semibold hover:bg-accent/90 transition-colors"
            >
              Upgrade to Pro
            </a>
          </div>
        </motion.div>
      )}
    </div>
  );
}
