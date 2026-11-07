"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Target,
  Calendar,
  TrendingUp,
  Plus,
  Check,
  Crown,
  Lock,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { differenceInDays, format } from "date-fns";
import type { StudyGoal, GoalType } from "@/types/database.types";
import { XP_REWARDS } from "@/lib/xp";

interface StudyGoalsProps {
  goals: StudyGoal[];
  isPro: boolean;
  onCreateGoal?: (type: GoalType, targetMinutes: number) => Promise<boolean>;
  className?: string;
}

export function StudyGoals({
  goals,
  isPro,
  onCreateGoal,
  className,
}: StudyGoalsProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [goalType, setGoalType] = useState<GoalType>("weekly");
  const [targetHours, setTargetHours] = useState(10);

  const activeWeekly = goals.find(
    (g) => g.goal_type === "weekly" && g.status === "active"
  );
  const activeMonthly = goals.find(
    (g) => g.goal_type === "monthly" && g.status === "active"
  );

  const handleCreate = async () => {
    if (!onCreateGoal) return;

    setCreating(true);
    const success = await onCreateGoal(goalType, targetHours * 60);
    setCreating(false);

    if (success) {
      setOpen(false);
    }
  };

  // Recommended goals based on typical study patterns
  const recommendations = [
    { type: "weekly" as GoalType, hours: 7, label: "1h/day" },
    { type: "weekly" as GoalType, hours: 14, label: "2h/day" },
    { type: "monthly" as GoalType, hours: 40, label: "10h/week" },
  ];

  // Non-Pro state
  if (!isPro) {
    return (
      <div
        className={cn(
          "p-4 rounded-xl bg-white/5 border border-white/10",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
            <Target className="w-6 h-6 text-white/30" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-white/60">Study Goals</h3>
            <p className="text-sm text-white/40">
              Pro members can set weekly & monthly goals
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
    <div className={cn("space-y-4", className)}>
      {/* Active goals */}
      {(activeWeekly || activeMonthly) && (
        <div className="space-y-3">
          {activeWeekly && (
            <GoalProgress goal={activeWeekly} type="weekly" />
          )}
          {activeMonthly && (
            <GoalProgress goal={activeMonthly} type="monthly" />
          )}
        </div>
      )}

      {/* Create goal button */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full border-white/20 border-dashed"
          >
            <Plus className="w-4 h-4 mr-2" />
            {activeWeekly || activeMonthly ? "Add Goal" : "Set Study Goal"}
          </Button>
        </DialogTrigger>
        <DialogContent className="widget-glass sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Set Study Goal
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Goal type */}
            <div className="space-y-2">
              <Label>Goal Period</Label>
              <Select
                value={goalType}
                onValueChange={(v) => setGoalType(v as GoalType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly" disabled={!!activeWeekly}>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Weekly Goal
                      {activeWeekly && (
                        <span className="text-xs text-white/40">(active)</span>
                      )}
                    </div>
                  </SelectItem>
                  <SelectItem value="monthly" disabled={!!activeMonthly}>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Monthly Goal
                      {activeMonthly && (
                        <span className="text-xs text-white/40">(active)</span>
                      )}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Target hours */}
            <div className="space-y-2">
              <Label>Target Hours</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={goalType === "weekly" ? 50 : 200}
                  value={targetHours}
                  onChange={(e) => setTargetHours(parseInt(e.target.value) || 1)}
                  className="w-24"
                />
                <span className="text-white/60">hours</span>
              </div>
              <p className="text-xs text-white/40">
                {goalType === "weekly"
                  ? `≈ ${(targetHours / 7).toFixed(1)} hours per day`
                  : `≈ ${(targetHours / 4).toFixed(0)} hours per week`}
              </p>
            </div>

            {/* Quick recommendations */}
            <div className="space-y-2">
              <Label className="text-white/60">Suggestions</Label>
              <div className="flex flex-wrap gap-2">
                {recommendations
                  .filter((r) => r.type === goalType)
                  .map((rec) => (
                    <Button
                      key={`${rec.type}-${rec.hours}`}
                      variant="outline"
                      size="sm"
                      onClick={() => setTargetHours(rec.hours)}
                      className={cn(
                        "border-white/20",
                        targetHours === rec.hours && "border-primary bg-primary/10"
                      )}
                    >
                      {rec.hours}h ({rec.label})
                    </Button>
                  ))}
              </div>
            </div>

            {/* XP reward info */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="text-sm">
                <span className="text-primary font-medium">
                  +
                  {goalType === "weekly"
                    ? XP_REWARDS.GOAL_WEEKLY_COMPLETE
                    : XP_REWARDS.GOAL_MONTHLY_COMPLETE}{" "}
                  XP
                </span>
                <span className="text-white/60"> when you complete this goal</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                creating ||
                (goalType === "weekly" && !!activeWeekly) ||
                (goalType === "monthly" && !!activeMonthly)
              }
            >
              {creating ? "Creating..." : "Create Goal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Individual goal progress card
interface GoalProgressProps {
  goal: StudyGoal;
  type: GoalType;
  className?: string;
}

export function GoalProgress({ goal, type, className }: GoalProgressProps) {
  const progress = goal.progress_minutes;
  const target = goal.target_minutes;
  const percent = Math.min(100, Math.round((progress / target) * 100));
  const isComplete = goal.status === "completed";

  const daysRemaining = differenceInDays(new Date(goal.end_date), new Date());
  const hoursRemaining = Math.max(0, (target - progress) / 60);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-4 rounded-xl border",
        isComplete
          ? "bg-green-500/10 border-green-500/30"
          : "bg-white/5 border-white/10",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-400" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
          )}
          <div>
            <h4 className="font-medium text-white capitalize">
              {type} Goal
            </h4>
            <p className="text-xs text-white/50">
              {format(new Date(goal.start_date), "MMM d")} -{" "}
              {format(new Date(goal.end_date), "MMM d")}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{percent}%</div>
          {!isComplete && daysRemaining >= 0 && (
            <p className="text-xs text-white/50">
              {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} left
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={cn(
            "h-full rounded-full",
            isComplete
              ? "bg-green-500"
              : "bg-gradient-to-r from-primary to-accent"
          )}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/60">
          {Math.floor(progress / 60)}h {progress % 60}m /{" "}
          {Math.floor(target / 60)}h
        </span>
        {!isComplete && hoursRemaining > 0 && (
          <span className="text-white/40">
            {hoursRemaining.toFixed(1)}h to go
          </span>
        )}
        {isComplete && (
          <span className="text-green-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Goal completed!
          </span>
        )}
      </div>
    </motion.div>
  );
}

// Mini goal widget for dashboard
interface GoalWidgetProps {
  goals: StudyGoal[];
  className?: string;
}

export function GoalWidget({ goals, className }: GoalWidgetProps) {
  const activeGoal = goals.find((g) => g.status === "active");

  if (!activeGoal) {
    return null;
  }

  const percent = Math.min(
    100,
    Math.round((activeGoal.progress_minutes / activeGoal.target_minutes) * 100)
  );

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-2 rounded-lg bg-white/5",
        className
      )}
    >
      <div className="relative w-10 h-10">
        <svg className="w-10 h-10 -rotate-90">
          <circle
            cx="20"
            cy="20"
            r="16"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            className="text-white/10"
          />
          <motion.circle
            cx="20"
            cy="20"
            r="16"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            strokeDasharray={100}
            initial={{ strokeDashoffset: 100 }}
            animate={{ strokeDashoffset: 100 - percent }}
            className="text-primary"
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
          {percent}%
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white capitalize truncate">
          {activeGoal.goal_type} Goal
        </p>
        <p className="text-xs text-white/50">
          {Math.floor(activeGoal.progress_minutes / 60)}h /{" "}
          {Math.floor(activeGoal.target_minutes / 60)}h
        </p>
      </div>
    </div>
  );
}
