/**
 * XP System Utilities
 * Handles XP calculation, levels, and rewards for the gamification system
 */

// XP rewards configuration
export const XP_REWARDS = {
  // Study session rewards (per minute)
  STUDY_SESSION_PER_MINUTE: 1,

  // Test rewards
  TEST_COMPLETE: 50,
  TEST_PASS: 25,           // Bonus for passing
  TEST_PERFECT_SCORE: 100, // Bonus for 100% score
  TEST_IMPROVEMENT: 10,    // Bonus per % improvement from previous attempt

  // Streak milestones
  STREAK_MILESTONE_7: 200,
  STREAK_MILESTONE_14: 300,
  STREAK_MILESTONE_30: 500,
  STREAK_MILESTONE_100: 1000,

  // Achievement unlock
  ACHIEVEMENT_UNLOCK: 100,

  // Study goals
  GOAL_WEEKLY_COMPLETE: 150,
  GOAL_MONTHLY_COMPLETE: 500,
} as const;

// Pro member XP multiplier
export const PRO_XP_MULTIPLIER = 1.5;

/**
 * Level thresholds using a square root curve
 * Level N requires: (N-1)² * 100 XP
 * This means:
 * Level 1: 0 XP
 * Level 2: 100 XP
 * Level 3: 400 XP
 * Level 4: 900 XP
 * Level 5: 1,600 XP
 * Level 10: 8,100 XP
 * Level 20: 36,100 XP
 * Level 50: 240,100 XP
 */
export function getXPRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.pow(level - 1, 2) * 100;
}

/**
 * Calculate current level from total XP
 */
export function getLevelFromXP(xp: number): number {
  if (xp <= 0) return 1;
  // Inverse of getXPRequiredForLevel: level = floor(sqrt(xp/100)) + 1
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

/**
 * Get XP progress towards next level
 */
export function getProgressToNextLevel(xp: number): {
  currentLevel: number;
  currentLevelXP: number;
  nextLevelXP: number;
  progressXP: number;
  progressPercent: number;
  xpToNextLevel: number;
} {
  const currentLevel = getLevelFromXP(xp);
  const currentLevelXP = getXPRequiredForLevel(currentLevel);
  const nextLevelXP = getXPRequiredForLevel(currentLevel + 1);
  const progressXP = xp - currentLevelXP;
  const xpNeededForLevel = nextLevelXP - currentLevelXP;
  const progressPercent = Math.min(100, Math.round((progressXP / xpNeededForLevel) * 100));

  return {
    currentLevel,
    currentLevelXP,
    nextLevelXP,
    progressXP,
    progressPercent,
    xpToNextLevel: nextLevelXP - xp,
  };
}

/**
 * Calculate XP with Pro multiplier
 */
export function calculateXPWithMultiplier(baseXP: number, isPro: boolean): number {
  const multiplier = isPro ? PRO_XP_MULTIPLIER : 1;
  return Math.floor(baseXP * multiplier);
}

/**
 * Calculate XP earned from a study session
 */
export function calculateStudySessionXP(
  durationMinutes: number,
  isPro: boolean
): { baseXP: number; finalXP: number; multiplier: number } {
  const baseXP = Math.floor(durationMinutes * XP_REWARDS.STUDY_SESSION_PER_MINUTE);
  const multiplier = isPro ? PRO_XP_MULTIPLIER : 1;
  const finalXP = Math.floor(baseXP * multiplier);

  return { baseXP, finalXP, multiplier };
}

/**
 * Calculate XP earned from test completion
 */
export function calculateTestXP(
  score: number,
  totalMarks: number,
  passingMarks: number,
  previousBestScore: number | null,
  isPro: boolean
): {
  baseXP: number;
  finalXP: number;
  multiplier: number;
  breakdown: {
    completion: number;
    pass: number;
    perfect: number;
    improvement: number;
  };
} {
  const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;
  const passed = score >= passingMarks;
  const isPerfect = percentage === 100;

  let baseXP = XP_REWARDS.TEST_COMPLETE;
  const breakdown = {
    completion: XP_REWARDS.TEST_COMPLETE,
    pass: 0,
    perfect: 0,
    improvement: 0,
  };

  // Pass bonus
  if (passed) {
    breakdown.pass = XP_REWARDS.TEST_PASS;
    baseXP += XP_REWARDS.TEST_PASS;
  }

  // Perfect score bonus
  if (isPerfect) {
    breakdown.perfect = XP_REWARDS.TEST_PERFECT_SCORE;
    baseXP += XP_REWARDS.TEST_PERFECT_SCORE;
  }

  // Improvement bonus
  if (previousBestScore !== null && score > previousBestScore) {
    const improvement = Math.floor((score - previousBestScore) / totalMarks * 100);
    breakdown.improvement = improvement * XP_REWARDS.TEST_IMPROVEMENT;
    baseXP += breakdown.improvement;
  }

  const multiplier = isPro ? PRO_XP_MULTIPLIER : 1;
  const finalXP = Math.floor(baseXP * multiplier);

  return { baseXP, finalXP, multiplier, breakdown };
}

/**
 * Calculate XP earned from streak milestone
 */
export function calculateStreakMilestoneXP(
  streak: number,
  isPro: boolean
): { baseXP: number; finalXP: number; milestone: number | null } {
  let baseXP = 0;
  let milestone: number | null = null;

  // Only award for exact milestones
  if (streak === 7) {
    baseXP = XP_REWARDS.STREAK_MILESTONE_7;
    milestone = 7;
  } else if (streak === 14) {
    baseXP = XP_REWARDS.STREAK_MILESTONE_14;
    milestone = 14;
  } else if (streak === 30) {
    baseXP = XP_REWARDS.STREAK_MILESTONE_30;
    milestone = 30;
  } else if (streak === 100) {
    baseXP = XP_REWARDS.STREAK_MILESTONE_100;
    milestone = 100;
  }

  const finalXP = calculateXPWithMultiplier(baseXP, isPro);

  return { baseXP, finalXP, milestone };
}

/**
 * Get level title/rank based on level
 */
export function getLevelTitle(level: number): string {
  if (level >= 100) return "Grandmaster";
  if (level >= 75) return "Master Scholar";
  if (level >= 50) return "Expert";
  if (level >= 40) return "Virtuoso";
  if (level >= 30) return "Specialist";
  if (level >= 25) return "Adept";
  if (level >= 20) return "Scholar";
  if (level >= 15) return "Apprentice";
  if (level >= 10) return "Student";
  if (level >= 5) return "Learner";
  return "Novice";
}

/**
 * Get level color for UI
 */
export function getLevelColor(level: number): string {
  if (level >= 100) return "text-yellow-400";
  if (level >= 75) return "text-purple-400";
  if (level >= 50) return "text-cyan-400";
  if (level >= 30) return "text-blue-400";
  if (level >= 15) return "text-green-400";
  return "text-white/70";
}

/**
 * Format XP number for display
 */
export function formatXP(xp: number): string {
  if (xp >= 1000000) {
    return `${(xp / 1000000).toFixed(1)}M`;
  }
  if (xp >= 1000) {
    return `${(xp / 1000).toFixed(1)}K`;
  }
  return xp.toString();
}

/**
 * XP reasons for transaction logging
 */
export const XP_REASONS = {
  STUDY_SESSION: "study_session",
  TEST_COMPLETE: "test_complete",
  TEST_PASS: "test_pass",
  TEST_PERFECT: "test_perfect",
  TEST_IMPROVEMENT: "test_improvement",
  STREAK_MILESTONE: "streak_milestone",
  ACHIEVEMENT_UNLOCK: "achievement_unlock",
  GOAL_COMPLETE: "goal_complete",
} as const;

export type XPReason = (typeof XP_REASONS)[keyof typeof XP_REASONS];
