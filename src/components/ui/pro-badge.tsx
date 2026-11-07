"use client";

import { Crown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProBadgeProps {
  isProMember: boolean;
  trialEndsAt?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  xs: "w-3 h-3",
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

/**
 * Determines if a user is on a free trial (vs paid pro).
 * Trial = is_pro_member + trial_ends_at in the future.
 */
function isOnTrial(trialEndsAt?: string | null): boolean {
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt) > new Date();
}

/**
 * Shows Crown for paid pro users, Sparkles + "NEW" for trial users.
 * Returns null if user is not pro.
 */
export function ProBadge({ isProMember, trialEndsAt, size = "sm", className }: ProBadgeProps) {
  if (!isProMember) return null;

  // Expired trial → no badge (not a paid pro)
  if (trialEndsAt && !isOnTrial(trialEndsAt)) return null;

  const iconSize = sizeMap[size];

  if (isOnTrial(trialEndsAt)) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 text-emerald-400",
          className
        )}
        title="New member — free trial"
      >
        <Sparkles className={iconSize} />
      </span>
    );
  }

  return <Crown className={cn(iconSize, "text-accent", className)} />;
}

/**
 * Circular badge overlay for avatars — shows crown or sparkles.
 */
export function ProBadgeOverlay({ isProMember, trialEndsAt }: Pick<ProBadgeProps, "isProMember" | "trialEndsAt">) {
  if (!isProMember) return null;

  // Expired trial → no badge
  if (trialEndsAt && !isOnTrial(trialEndsAt)) return null;

  if (isOnTrial(trialEndsAt)) {
    return (
      <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
    );
  }

  return (
    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 flex items-center justify-center shadow-lg">
      <Crown className="w-4 h-4 text-white" />
    </div>
  );
}
