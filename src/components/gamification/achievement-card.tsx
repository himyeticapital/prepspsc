"use client";

import { motion } from "framer-motion";
import {
  Flame,
  Crown,
  Clock,
  BookOpen,
  Trophy,
  Star,
  CheckCircle,
  Target,
  Award,
  Zap,
  Sunrise,
  Moon,
  Calendar,
  Lock,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Achievement } from "@/types/database.types";
import {
  formatRequirement,
  getAchievementProgress,
  type AchievementCheckContext,
} from "@/lib/achievements";
import { formatXP } from "@/lib/xp";

// Icon mapping
const iconComponents: Record<string, React.ElementType> = {
  flame: Flame,
  crown: Crown,
  clock: Clock,
  "book-open": BookOpen,
  trophy: Trophy,
  star: Star,
  "check-circle": CheckCircle,
  target: Target,
  award: Award,
  zap: Zap,
  sunrise: Sunrise,
  moon: Moon,
  calendar: Calendar,
};

// Category colors
const categoryColors: Record<string, string> = {
  streak: "from-orange-500 to-red-500",
  study_time: "from-blue-500 to-cyan-500",
  tests: "from-green-500 to-emerald-500",
  special: "from-purple-500 to-pink-500",
};

const categoryBgColors: Record<string, string> = {
  streak: "bg-orange-500/20",
  study_time: "bg-blue-500/20",
  tests: "bg-green-500/20",
  special: "bg-purple-500/20",
};

interface AchievementCardProps {
  achievement: Achievement;
  isUnlocked: boolean;
  isPro?: boolean;
  context?: Partial<AchievementCheckContext>;
  size?: "sm" | "md" | "lg";
  showProgress?: boolean;
  onClick?: () => void;
  className?: string;
}

export function AchievementCard({
  achievement,
  isUnlocked,
  isPro = false,
  context,
  size = "md",
  showProgress = true,
  onClick,
  className,
}: AchievementCardProps) {
  const Icon = iconComponents[achievement.icon] || Award;
  const isLocked = !isUnlocked && (achievement.is_pro_only && !isPro);
  const gradientColor = categoryColors[achievement.category] || categoryColors.special;
  const bgColor = categoryBgColors[achievement.category] || categoryBgColors.special;

  // Calculate progress if context provided
  const progress = context?.profile
    ? getAchievementProgress(achievement, context as AchievementCheckContext)
    : null;

  const sizeClasses = {
    sm: {
      container: "p-3",
      icon: "w-8 h-8",
      iconSize: "w-4 h-4",
      title: "text-sm",
      desc: "text-xs",
    },
    md: {
      container: "p-4",
      icon: "w-12 h-12",
      iconSize: "w-6 h-6",
      title: "text-base",
      desc: "text-sm",
    },
    lg: {
      container: "p-5",
      icon: "w-16 h-16",
      iconSize: "w-8 h-8",
      title: "text-lg",
      desc: "text-base",
    },
  };

  const s = sizeClasses[size];

  return (
    <motion.div
      whileHover={!isLocked ? { scale: 1.02 } : undefined}
      whileTap={!isLocked && onClick ? { scale: 0.98 } : undefined}
      onClick={!isLocked ? onClick : undefined}
      className={cn(
        "relative rounded-xl border transition-all duration-200 backdrop-blur-xl",
        isUnlocked
          ? "bg-zinc-900/50 border-white/20 hover:border-white/30"
          : isLocked
          ? "bg-zinc-900/30 border-white/5 opacity-50"
          : "bg-zinc-900/40 border-white/10 hover:border-white/20",
        onClick && !isLocked && "cursor-pointer",
        s.container,
        className
      )}
    >
      {/* Pro-only badge */}
      {achievement.is_pro_only && (
        <div className="absolute top-2 right-2">
          <Crown className="w-4 h-4 text-accent" />
        </div>
      )}

      {/* Locked overlay */}
      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/30 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-1">
            <Lock className="w-5 h-5 text-white/40" />
            <span className="text-xs text-white/40">Pro Only</span>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            "flex-shrink-0 rounded-xl flex items-center justify-center",
            isUnlocked ? `bg-gradient-to-br ${gradientColor}` : bgColor,
            s.icon
          )}
        >
          <Icon
            className={cn(
              isUnlocked ? "text-white" : "text-white/50",
              s.iconSize
            )}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className={cn(
                "font-semibold truncate",
                isUnlocked ? "text-white" : "text-white/60",
                s.title
              )}
            >
              {achievement.name}
            </h3>
            {isUnlocked && (
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
            )}
          </div>

          <p
            className={cn(
              "mt-0.5 line-clamp-2",
              isUnlocked ? "text-white/60" : "text-white/40",
              s.desc
            )}
          >
            {achievement.description}
          </p>

          {/* Progress bar for partially complete */}
          {showProgress && progress && !isUnlocked && !isLocked && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-white/50">
                  {progress.current} / {progress.target}
                </span>
                <span className="text-white/40">{progress.percent}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.percent}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={cn("h-full rounded-full bg-gradient-to-r", gradientColor)}
                />
              </div>
            </div>
          )}

          {/* XP reward */}
          {achievement.xp_reward > 0 && (
            <div className="flex items-center gap-1 mt-2">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className={cn("text-primary", s.desc)}>
                +{formatXP(achievement.xp_reward)} XP
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Mini achievement badge for showcasing
interface AchievementBadgeProps {
  achievement: Achievement;
  isUnlocked: boolean;
  className?: string;
}

export function AchievementBadge({
  achievement,
  isUnlocked,
  className,
}: AchievementBadgeProps) {
  const Icon = iconComponents[achievement.icon] || Award;
  const gradientColor = categoryColors[achievement.category] || categoryColors.special;

  return (
    <motion.div
      whileHover={{ scale: 1.1 }}
      className={cn(
        "relative w-10 h-10 rounded-lg flex items-center justify-center",
        isUnlocked ? `bg-gradient-to-br ${gradientColor}` : "bg-white/10",
        className
      )}
      title={achievement.name}
    >
      <Icon
        className={cn(
          "w-5 h-5",
          isUnlocked ? "text-white" : "text-white/30"
        )}
      />
      {!isUnlocked && (
        <Lock className="absolute -bottom-0.5 -right-0.5 w-3 h-3 text-white/50" />
      )}
    </motion.div>
  );
}

// Achievement unlock animation
interface AchievementUnlockToastProps {
  achievement: Achievement;
  onComplete?: () => void;
}

export function AchievementUnlockToast({
  achievement,
  onComplete,
}: AchievementUnlockToastProps) {
  const Icon = iconComponents[achievement.icon] || Award;
  const gradientColor = categoryColors[achievement.category] || categoryColors.special;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -20 }}
      onAnimationComplete={() => {
        setTimeout(() => onComplete?.(), 3000);
      }}
      className="flex items-center gap-4 px-5 py-4 rounded-xl bg-gradient-to-r from-white/10 to-white/5 border border-white/20"
    >
      <motion.div
        initial={{ rotate: -180, scale: 0 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: "spring", bounce: 0.5 }}
        className={cn(
          "w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br",
          gradientColor
        )}
      >
        <Icon className="w-7 h-7 text-white" />
      </motion.div>

      <div>
        <p className="text-xs text-accent font-medium uppercase tracking-wider">
          Achievement Unlocked!
        </p>
        <h3 className="text-lg font-bold text-white">{achievement.name}</h3>
        <div className="flex items-center gap-1 mt-0.5">
          <Sparkles className="w-3 h-3 text-primary" />
          <span className="text-sm text-primary">+{achievement.xp_reward} XP</span>
        </div>
      </div>
    </motion.div>
  );
}
