"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Clock, FileCheck, Sparkles, Trophy, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Achievement, AchievementCategory, Profile } from "@/types/database.types";
import { AchievementCard } from "./achievement-card";
import { getCategoryDisplayName } from "@/lib/achievements";

// Category icons
const categoryIcons: Record<AchievementCategory, React.ElementType> = {
  streak: Flame,
  study_time: Clock,
  tests: FileCheck,
  special: Sparkles,
};

interface AchievementsGridProps {
  achievements: Achievement[];
  unlockedIds: number[];
  profile?: Profile | null;
  isPro?: boolean;
  showFilters?: boolean;
  columns?: 1 | 2 | 3;
  className?: string;
}

type FilterTab = "all" | "unlocked" | "locked" | AchievementCategory;

export function AchievementsGrid({
  achievements,
  unlockedIds,
  profile,
  isPro = false,
  showFilters = true,
  columns = 2,
  className,
}: AchievementsGridProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  // Filter achievements based on active tab
  const filteredAchievements = achievements.filter((achievement) => {
    const isUnlocked = unlockedIds.includes(achievement.id);

    switch (activeFilter) {
      case "unlocked":
        return isUnlocked;
      case "locked":
        return !isUnlocked;
      case "streak":
      case "study_time":
      case "tests":
      case "special":
        return achievement.category === activeFilter;
      default:
        return true;
    }
  });

  // Sort: unlocked first, then by sort_order
  const sortedAchievements = [...filteredAchievements].sort((a, b) => {
    const aUnlocked = unlockedIds.includes(a.id);
    const bUnlocked = unlockedIds.includes(b.id);

    if (aUnlocked !== bUnlocked) {
      return aUnlocked ? -1 : 1;
    }

    return a.sort_order - b.sort_order;
  });

  // Stats
  const totalCount = achievements.length;
  const unlockedCount = unlockedIds.length;
  const lockedCount = totalCount - unlockedCount;

  // Filter tabs
  const filterTabs: { key: FilterTab; label: string; icon?: React.ElementType; count?: number }[] = [
    { key: "all", label: "All", count: totalCount },
    { key: "unlocked", label: "Unlocked", icon: Trophy, count: unlockedCount },
    { key: "locked", label: "Locked", icon: Lock, count: lockedCount },
  ];

  const categoryTabs: { key: AchievementCategory; label: string; icon: React.ElementType }[] = [
    { key: "streak", label: "Streaks", icon: Flame },
    { key: "study_time", label: "Study Time", icon: Clock },
    { key: "tests", label: "Tests", icon: FileCheck },
    { key: "special", label: "Special", icon: Sparkles },
  ];

  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  };

  return (
    <div className={className}>
      {/* Filters */}
      {showFilters && (
        <div className="mb-6 space-y-3">
          {/* Status filters */}
          <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-zinc-900/50 backdrop-blur-xl border border-white/10">
            {filterTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    activeFilter === tab.key
                      ? "bg-primary text-white"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={cn(
                        "ml-1 px-1.5 py-0.5 rounded text-xs",
                        activeFilter === tab.key
                          ? "bg-white/20"
                          : "bg-white/10"
                      )}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-zinc-900/50 backdrop-blur-xl border border-white/10">
            {categoryTabs.map((tab) => {
              const Icon = tab.icon;
              const count = achievements.filter((a) => a.category === tab.key).length;
              return (
                <button
                  key={tab.key}
                  onClick={() =>
                    setActiveFilter(activeFilter === tab.key ? "all" : tab.key)
                  }
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    activeFilter === tab.key
                      ? "bg-white/20 text-white"
                      : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  <span className="text-xs text-white/40">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress summary */}
      <div className="mb-6 p-4 rounded-xl bg-zinc-900/50 backdrop-blur-xl border border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white/60">Progress</h3>
            <p className="text-2xl font-bold text-white">
              {unlockedCount} / {totalCount}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-white/60">Completion</p>
            <p className="text-2xl font-bold text-primary">
              {totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0}%
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{
              width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%`,
            }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
          />
        </div>
      </div>

      {/* Achievements grid */}
      <div className={cn("grid gap-4", gridCols[columns])}>
        <AnimatePresence mode="popLayout">
          {sortedAchievements.map((achievement, index) => (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.05 }}
            >
              <AchievementCard
                achievement={achievement}
                isUnlocked={unlockedIds.includes(achievement.id)}
                isPro={isPro}
                context={profile ? { profile } : undefined}
                size="md"
                showProgress={true}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty state */}
      {sortedAchievements.length === 0 && (
        <div className="text-center py-12">
          <Trophy className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/60">No achievements found</p>
          <p className="text-sm text-white/40 mt-1">
            {activeFilter === "unlocked"
              ? "Start studying to unlock achievements!"
              : activeFilter === "locked"
              ? "You've unlocked all achievements!"
              : "Try a different filter"}
          </p>
        </div>
      )}
    </div>
  );
}

// Compact achievements showcase for profile/dashboard
interface AchievementsShowcaseProps {
  achievements: Achievement[];
  unlockedIds: number[];
  maxDisplay?: number;
  className?: string;
}

export function AchievementsShowcase({
  achievements,
  unlockedIds,
  maxDisplay = 5,
  className,
}: AchievementsShowcaseProps) {
  // Get recently unlocked achievements
  const unlockedAchievements = achievements
    .filter((a) => unlockedIds.includes(a.id))
    .slice(0, maxDisplay);

  const remaining = unlockedIds.length - maxDisplay;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {unlockedAchievements.map((achievement) => {
        const Icon = categoryIcons[achievement.category] || Sparkles;
        return (
          <div
            key={achievement.id}
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center"
            title={achievement.name}
          >
            <Icon className="w-4 h-4 text-primary" />
          </div>
        );
      })}
      {remaining > 0 && (
        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
          <span className="text-xs text-white/60">+{remaining}</span>
        </div>
      )}
      {unlockedAchievements.length === 0 && (
        <span className="text-sm text-white/40">No achievements yet</span>
      )}
    </div>
  );
}
