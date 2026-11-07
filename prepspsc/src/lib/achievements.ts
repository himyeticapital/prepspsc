/**
 * Achievements System Utilities
 * Handles achievement definitions, checking, and unlocking logic
 */

import type { Profile, Achievement, AchievementCategory } from "@/types/database.types";

// Achievement check context - data needed to evaluate achievements
export interface AchievementCheckContext {
  profile: Profile;
  testsCompleted?: number;
  testPassStreak?: number;
  hasPerfectScore?: boolean;
  currentHour?: number; // 0-23 for time-based achievements
  isWeekend?: boolean;
  studiedBothWeekendDays?: boolean;
}

// Achievement definition with check function
interface AchievementDefinition {
  slug: string;
  check: (ctx: AchievementCheckContext) => boolean;
  proOnly: boolean;
}

/**
 * Achievement definitions with unlock conditions
 * These match the database seed data
 */
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // Streak achievements
  {
    slug: "streak_3",
    check: (ctx) => ctx.profile.current_streak >= 3,
    proOnly: false,
  },
  {
    slug: "streak_7",
    check: (ctx) => ctx.profile.current_streak >= 7,
    proOnly: false,
  },
  {
    slug: "streak_14",
    check: (ctx) => ctx.profile.current_streak >= 14,
    proOnly: false,
  },
  {
    slug: "streak_30",
    check: (ctx) => ctx.profile.current_streak >= 30,
    proOnly: true,
  },
  {
    slug: "streak_100",
    check: (ctx) => ctx.profile.current_streak >= 100,
    proOnly: true,
  },

  // Study time achievements (total_minutes_all_time)
  {
    slug: "study_1h",
    check: (ctx) => ctx.profile.total_minutes_all_time >= 60,
    proOnly: false,
  },
  {
    slug: "study_10h",
    check: (ctx) => ctx.profile.total_minutes_all_time >= 600,
    proOnly: false,
  },
  {
    slug: "study_50h",
    check: (ctx) => ctx.profile.total_minutes_all_time >= 3000,
    proOnly: false,
  },
  {
    slug: "study_100h",
    check: (ctx) => ctx.profile.total_minutes_all_time >= 6000,
    proOnly: false,
  },
  {
    slug: "study_500h",
    check: (ctx) => ctx.profile.total_minutes_all_time >= 30000,
    proOnly: true,
  },

  // Test achievements
  {
    slug: "first_test",
    check: (ctx) => (ctx.testsCompleted ?? 0) >= 1,
    proOnly: false,
  },
  {
    slug: "tests_10",
    check: (ctx) => (ctx.testsCompleted ?? 0) >= 10,
    proOnly: false,
  },
  {
    slug: "tests_50",
    check: (ctx) => (ctx.testsCompleted ?? 0) >= 50,
    proOnly: false,
  },
  {
    slug: "perfect_score",
    check: (ctx) => ctx.hasPerfectScore === true,
    proOnly: false,
  },
  {
    slug: "pass_streak_5",
    check: (ctx) => (ctx.testPassStreak ?? 0) >= 5,
    proOnly: true,
  },

  // Special achievements
  {
    slug: "early_bird",
    check: (ctx) => ctx.currentHour !== undefined && ctx.currentHour < 6,
    proOnly: false,
  },
  {
    slug: "night_owl",
    check: (ctx) => ctx.currentHour !== undefined && ctx.currentHour >= 0 && ctx.currentHour < 4,
    proOnly: false,
  },
  {
    slug: "weekend_warrior",
    check: (ctx) => ctx.studiedBothWeekendDays === true,
    proOnly: false,
  },
  {
    slug: "pro_member",
    check: (ctx) => ctx.profile.is_pro_member === true,
    proOnly: true,
  },
];

/**
 * Get achievement definition by slug
 */
export function getAchievementDefinition(slug: string): AchievementDefinition | undefined {
  return ACHIEVEMENT_DEFINITIONS.find((a) => a.slug === slug);
}

/**
 * Check which achievements the user qualifies for
 * Returns slugs of achievements that should be unlocked
 */
export function checkAchievements(
  ctx: AchievementCheckContext,
  unlockedSlugs: string[]
): string[] {
  const newlyUnlocked: string[] = [];
  const isPro = ctx.profile.is_pro_member;

  for (const def of ACHIEVEMENT_DEFINITIONS) {
    // Skip if already unlocked
    if (unlockedSlugs.includes(def.slug)) continue;

    // Skip Pro-only achievements for non-Pro users
    if (def.proOnly && !isPro) continue;

    // Check if achievement condition is met
    if (def.check(ctx)) {
      newlyUnlocked.push(def.slug);
    }
  }

  return newlyUnlocked;
}

/**
 * Get achievements filtered by category
 */
export function filterAchievementsByCategory(
  achievements: Achievement[],
  category: AchievementCategory
): Achievement[] {
  return achievements.filter((a) => a.category === category);
}

/**
 * Get achievement progress for partially completed achievements
 */
export function getAchievementProgress(
  achievement: Achievement,
  ctx: AchievementCheckContext
): { current: number; target: number; percent: number } | null {
  const requirementValue = achievement.requirement_value;
  if (requirementValue === null) return null;

  let current = 0;

  switch (achievement.category) {
    case "streak":
      current = ctx.profile.current_streak;
      break;
    case "study_time":
      current = ctx.profile.total_minutes_all_time;
      break;
    case "tests":
      if (achievement.slug.startsWith("tests_")) {
        current = ctx.testsCompleted ?? 0;
      } else if (achievement.slug === "pass_streak_5") {
        current = ctx.testPassStreak ?? 0;
      }
      break;
    default:
      return null;
  }

  const percent = Math.min(100, Math.round((current / requirementValue) * 100));

  return { current, target: requirementValue, percent };
}

/**
 * Sort achievements by unlock status and sort_order
 */
export function sortAchievements(
  achievements: Achievement[],
  unlockedIds: number[]
): Achievement[] {
  return [...achievements].sort((a, b) => {
    const aUnlocked = unlockedIds.includes(a.id);
    const bUnlocked = unlockedIds.includes(b.id);

    // Unlocked achievements first
    if (aUnlocked !== bUnlocked) {
      return aUnlocked ? -1 : 1;
    }

    // Then by sort_order
    return a.sort_order - b.sort_order;
  });
}

/**
 * Get icon component name for achievement icon
 * Maps icon slug to lucide-react icon name
 */
export function getAchievementIconName(icon: string): string {
  const iconMap: Record<string, string> = {
    flame: "Flame",
    crown: "Crown",
    clock: "Clock",
    "book-open": "BookOpen",
    trophy: "Trophy",
    star: "Star",
    "check-circle": "CheckCircle",
    target: "Target",
    award: "Award",
    zap: "Zap",
    sunrise: "Sunrise",
    moon: "Moon",
    calendar: "Calendar",
  };

  return iconMap[icon] || "Award";
}

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: AchievementCategory): string {
  const names: Record<AchievementCategory, string> = {
    streak: "Streaks",
    study_time: "Study Time",
    tests: "Tests",
    special: "Special",
  };
  return names[category];
}

/**
 * Get category icon name
 */
export function getCategoryIconName(category: AchievementCategory): string {
  const icons: Record<AchievementCategory, string> = {
    streak: "Flame",
    study_time: "Clock",
    tests: "FileCheck",
    special: "Sparkles",
  };
  return icons[category];
}

/**
 * Format achievement requirement for display
 */
export function formatRequirement(achievement: Achievement): string {
  const value = achievement.requirement_value;
  if (value === null) return "";

  switch (achievement.category) {
    case "streak":
      return `${value} day${value !== 1 ? "s" : ""}`;
    case "study_time":
      if (value >= 60) {
        const hours = Math.floor(value / 60);
        return `${hours} hour${hours !== 1 ? "s" : ""}`;
      }
      return `${value} minute${value !== 1 ? "s" : ""}`;
    case "tests":
      if (achievement.slug === "perfect_score") {
        return "100%";
      }
      return `${value} test${value !== 1 ? "s" : ""}`;
    default:
      return value.toString();
  }
}

/**
 * Check if an achievement is locked for the user
 */
export function isAchievementLocked(
  achievement: Achievement,
  isPro: boolean,
  unlockedIds: number[]
): { locked: boolean; reason?: string } {
  // Already unlocked
  if (unlockedIds.includes(achievement.id)) {
    return { locked: false };
  }

  // Pro-only and user is not Pro
  if (achievement.is_pro_only && !isPro) {
    return { locked: true, reason: "Pro members only" };
  }

  // Not yet earned
  return { locked: true, reason: "Not yet earned" };
}
