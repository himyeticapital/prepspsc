"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, ShieldAlert, ShieldCheck, Crown, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDistanceToNow, startOfMonth, addMonths } from "date-fns";

interface StreakShieldCardProps {
  shields: number;
  maxShields?: number;
  resetAt: string | null;
  isPro: boolean;
  currentStreak: number;
  isStreakAtRisk?: boolean;
  onUseShield?: () => Promise<boolean>;
  className?: string;
}

export function StreakShieldCard({
  shields,
  maxShields = 3,
  resetAt,
  isPro,
  currentStreak,
  isStreakAtRisk = false,
  onUseShield,
  className,
}: StreakShieldCardProps) {
  const [isUsing, setIsUsing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Calculate next reset date (1st of next month)
  const nextReset = resetAt
    ? addMonths(startOfMonth(new Date(resetAt)), 1)
    : addMonths(startOfMonth(new Date()), 1);

  const handleUseShield = async () => {
    if (!onUseShield || shields <= 0) return;

    setIsUsing(true);
    const success = await onUseShield();
    setIsUsing(false);

    if (success) {
      setDialogOpen(false);
    }
  };

  // Non-Pro state
  if (!isPro) {
    return (
      <div
        className={cn(
          "p-4 rounded-xl glass-card",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-white/40" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-white/80">Streak Shields</h3>
            <p className="text-sm text-white/60">
              Pro members get 3 shields per month
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-accent/30 text-accent hover:bg-accent/10"
            asChild
          >
            <a href="/pricing">
              <Crown className="w-4 h-4 mr-1" />
              Upgrade
            </a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "p-4 rounded-xl glass-card",
        isStreakAtRisk && "border-orange-500/50",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="font-medium text-white">Streak Shields</h3>
        </div>
        <div className="flex items-center gap-1 text-sm text-white/60">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Resets {formatDistanceToNow(nextReset, { addSuffix: true })}</span>
        </div>
      </div>

      {/* Shield indicators */}
      <div className="flex items-center gap-2 mb-4">
        {Array.from({ length: maxShields }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
              i < shields
                ? "bg-gradient-to-br from-primary/30 to-accent/30 border border-primary/50"
                : "bg-white/5 border border-white/10"
            )}
          >
            {i < shields ? (
              <ShieldCheck className="w-5 h-5 text-primary" />
            ) : (
              <Shield className="w-5 h-5 text-white/20" />
            )}
          </motion.div>
        ))}
        <span className="ml-2 text-lg font-semibold text-white">
          {shields}/{maxShields}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-white/70 mb-4">
        Use a shield to protect your streak if you miss a day of studying.
        {shields === 0 && " You have no shields remaining this month."}
      </p>

      {/* Streak at risk warning */}
      {isStreakAtRisk && currentStreak > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 mb-4"
        >
          <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-orange-300">
              Your {currentStreak}-day streak is at risk!
            </p>
            <p className="text-xs text-orange-300/70">
              Study today or use a shield to save it
            </p>
          </div>
        </motion.div>
      )}

      {/* Use Shield Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant={isStreakAtRisk ? "default" : "outline"}
            className={cn(
              "w-full",
              isStreakAtRisk
                ? "bg-orange-500 hover:bg-orange-600"
                : "border-white/20"
            )}
            disabled={shields <= 0 || !isStreakAtRisk}
          >
            <ShieldAlert className="w-4 h-4 mr-2" />
            {isStreakAtRisk
              ? "Use Shield to Save Streak"
              : shields > 0
              ? "Shield Available"
              : "No Shields Available"}
          </Button>
        </DialogTrigger>
        <DialogContent className="widget-glass">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Use Streak Shield?
            </DialogTitle>
            <DialogDescription className="text-white/60">
              This will protect your {currentStreak}-day streak from being lost.
              You have {shields} shield{shields !== 1 ? "s" : ""} remaining this
              month.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">
                  {currentStreak}
                </div>
                <div className="text-sm text-white/50">Day Streak</div>
              </div>
              <div className="text-2xl text-white/30">→</div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">
                  {currentStreak}
                </div>
                <div className="text-sm text-green-400/70">Protected</div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isUsing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUseShield}
              disabled={isUsing}
              className="bg-primary hover:bg-primary/90"
            >
              {isUsing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Using...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Use Shield
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Mini shield indicator for dashboard
interface StreakShieldBadgeProps {
  shields: number;
  maxShields?: number;
  isPro: boolean;
  className?: string;
}

export function StreakShieldBadge({
  shields,
  maxShields = 3,
  isPro,
  className,
}: StreakShieldBadgeProps) {
  if (!isPro) {
    return null;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10",
        className
      )}
      title={`${shields} streak shields remaining`}
    >
      <Shield className="w-4 h-4 text-primary" />
      <span className="text-sm font-medium text-primary">{shields}/{maxShields}</span>
    </div>
  );
}
