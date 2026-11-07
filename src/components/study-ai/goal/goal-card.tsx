"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { StudyAIGoalRow } from "@/types/database.types";
import {
  BookOpen,
  Clock,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  Trash2,
  Loader2,
} from "lucide-react";

interface GoalCardProps {
  goal: StudyAIGoalRow;
  showRevisionBadge?: boolean;
  onDelete?: (goalId: number) => Promise<boolean>;
  className?: string;
}

const LEITNER_LABELS: Record<number, string> = {
  1: "New",
  2: "Learning",
  3: "Reviewing",
  4: "Familiar",
  5: "Mastered",
};

const LEITNER_COLORS: Record<number, string> = {
  1: "text-red-400 bg-red-500/20",
  2: "text-orange-400 bg-orange-500/20",
  3: "text-yellow-400 bg-yellow-500/20",
  4: "text-blue-400 bg-blue-500/20",
  5: "text-green-400 bg-green-500/20",
};

export function GoalCard({ goal, showRevisionBadge = false, onDelete, className }: GoalCardProps) {
  const isDue = goal.next_revision_at && new Date(goal.next_revision_at) <= new Date();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirmDelete) {
      setConfirmDelete(true);
      // Auto-reset confirmation after 3 seconds
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }

    if (!onDelete) return;
    setIsDeleting(true);
    await onDelete(goal.id);
    setIsDeleting(false);
  };

  return (
    <Link href={`/study-ai/goals/${goal.id}`}>
      <div
        className={cn(
          "relative widget-glass p-4 rounded-xl hover:bg-white/10 transition-all cursor-pointer group",
          isDue && "border border-orange-500/30",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-purple-400" />
            </div>
            <div
              className={cn(
                "px-2 py-0.5 rounded-full text-xs",
                LEITNER_COLORS[goal.leitner_box]
              )}
            >
              {LEITNER_LABELS[goal.leitner_box]}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {showRevisionBadge && isDue && (
              <div className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Due
              </div>
            )}

            {onDelete && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  confirmDelete
                    ? "bg-red-500/20 text-red-400 opacity-100"
                    : "opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-white/40 hover:text-red-400"
                )}
                title={confirmDelete ? "Click again to confirm" : "Delete goal"}
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Goal Text */}
        <h3 className="text-white font-medium mb-2 line-clamp-2 group-hover:text-primary transition-colors">
          {goal.goal_text}
        </h3>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-white/50">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatDistanceToNow(new Date(goal.created_at), { addSuffix: true })}</span>
          </div>
          {goal.revision_count > 0 && (
            <div className="flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              <span>{goal.revision_count} revisions</span>
            </div>
          )}
        </div>

        {/* Next Revision */}
        {goal.next_revision_at && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40">Next revision</span>
              <span
                className={cn(
                  "flex items-center gap-1",
                  isDue ? "text-orange-400" : "text-white/60"
                )}
              >
                {isDue ? (
                  <>
                    <AlertCircle className="w-3 h-3" />
                    Due now
                  </>
                ) : (
                  formatDistanceToNow(new Date(goal.next_revision_at), { addSuffix: true })
                )}
              </span>
            </div>
          </div>
        )}

        {/* Arrow indicator */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronRight className="w-5 h-5 text-white/40" />
        </div>
      </div>
    </Link>
  );
}
