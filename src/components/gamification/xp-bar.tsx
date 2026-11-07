"use client";

import { motion } from "framer-motion";
import { Sparkles, Crown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatXP,
  getLevelTitle,
  getLevelColor,
  PRO_XP_MULTIPLIER,
} from "@/lib/xp";

interface XPBarProps {
  xp: number;
  level: number;
  progressPercent: number;
  xpToNextLevel: number;
  isPro?: boolean;
  showMultiplier?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function XPBar({
  xp,
  level,
  progressPercent,
  xpToNextLevel,
  isPro = false,
  showMultiplier = true,
  size = "md",
  className,
}: XPBarProps) {
  const levelTitle = getLevelTitle(level);
  const levelColor = getLevelColor(level);

  const sizeClasses = {
    sm: {
      container: "py-2 px-3",
      level: "text-sm",
      bar: "h-1.5",
      text: "text-xs",
    },
    md: {
      container: "py-3 px-4",
      level: "text-base",
      bar: "h-2",
      text: "text-sm",
    },
    lg: {
      container: "py-4 px-5",
      level: "text-lg",
      bar: "h-3",
      text: "text-base",
    },
  };

  const s = sizeClasses[size];

  return (
    <div
      className={cn(
        "rounded-xl bg-white/5 border border-white/10",
        s.container,
        className
      )}
    >
      {/* Level & Title Row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center gap-1.5 font-bold",
              s.level,
              levelColor
            )}
          >
            <Sparkles className="w-4 h-4" />
            <span>Level {level}</span>
          </div>
          <span className={cn("text-white/50", s.text)}>{levelTitle}</span>
        </div>

        {/* Pro Multiplier Badge */}
        {isPro && showMultiplier && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/20 text-accent"
          >
            <Crown className="w-3 h-3" />
            <span className={cn("font-semibold", s.text)}>
              {PRO_XP_MULTIPLIER}x XP
            </span>
          </motion.div>
        )}
      </div>

      {/* Progress Bar */}
      <div className={cn("relative rounded-full bg-white/10 overflow-hidden", s.bar)}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/70 rounded-full"
        />
        {/* Shimmer effect */}
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "200%" }}
          transition={{
            repeat: Infinity,
            duration: 2,
            ease: "linear",
            repeatDelay: 3,
          }}
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        />
      </div>

      {/* XP Numbers */}
      <div className={cn("flex items-center justify-between mt-1.5", s.text)}>
        <div className="flex items-center gap-1 text-white/70">
          <TrendingUp className="w-3 h-3" />
          <span>{formatXP(xp)} XP</span>
        </div>
        <span className="text-white/50">{formatXP(xpToNextLevel)} to next level</span>
      </div>
    </div>
  );
}

// Compact inline XP display
interface XPBadgeProps {
  level: number;
  xp: number;
  isPro?: boolean;
  className?: string;
}

export function XPBadge({ level, xp, isPro = false, className }: XPBadgeProps) {
  const levelColor = getLevelColor(level);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5",
        className
      )}
    >
      <Sparkles className={cn("w-3.5 h-3.5", levelColor)} />
      <span className={cn("text-sm font-medium", levelColor)}>Lv.{level}</span>
      {isPro && (
        <Crown className="w-3 h-3 text-accent" />
      )}
    </div>
  );
}

// XP earned animation toast
interface XPGainToastProps {
  amount: number;
  reason: string;
  multiplier?: number;
  onComplete?: () => void;
}

export function XPGainToast({
  amount,
  reason,
  multiplier = 1,
  onComplete,
}: XPGainToastProps) {
  const reasonLabels: Record<string, string> = {
    study_session: "Study Session",
    test_complete: "Test Completed",
    test_pass: "Test Passed",
    test_perfect: "Perfect Score",
    test_improvement: "Improvement",
    streak_milestone: "Streak Milestone",
    achievement_unlock: "Achievement",
    goal_complete: "Goal Complete",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      onAnimationComplete={() => {
        setTimeout(() => onComplete?.(), 2000);
      }}
      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30"
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20">
        <Sparkles className="w-5 h-5 text-primary" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-primary">+{amount} XP</span>
          {multiplier > 1 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">
              {multiplier}x
            </span>
          )}
        </div>
        <p className="text-sm text-white/60">{reasonLabels[reason] || reason}</p>
      </div>
    </motion.div>
  );
}
