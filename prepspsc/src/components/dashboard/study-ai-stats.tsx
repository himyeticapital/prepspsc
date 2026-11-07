"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Brain,
  BookOpen,
  Bookmark,
  Flame,
  Clock,
  ChevronRight,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StudyAIStatsData {
  totalStudyGoals: number;
  materialsGenerated: number;
  itemsSaved: number;
  dueForReview: number;
  revisionStreak: number;
  lastActivityAt: string | null;
}

export function StudyAIStats() {
  const [stats, setStats] = useState<StudyAIStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/study-ai/stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch Study AI stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-40 bg-white/10 rounded" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const hasActivity = stats.totalStudyGoals > 0 || stats.materialsGenerated > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/70 flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          Study with AI
        </h3>
        <Link href="/study-ai">
          <Button variant="ghost" size="sm" className="text-white/60 hover:text-white gap-1 h-auto py-1 px-2">
            Open
            <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      {hasActivity ? (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard
              icon={<BookOpen className="w-4 h-4" />}
              label="Study Goals"
              value={stats.totalStudyGoals}
              color="text-blue-400"
            />
            <StatCard
              icon={<Sparkles className="w-4 h-4" />}
              label="Materials"
              value={stats.materialsGenerated}
              color="text-purple-400"
            />
            <StatCard
              icon={<Bookmark className="w-4 h-4" />}
              label="Saved"
              value={stats.itemsSaved}
              color="text-green-400"
            />
            <StatCard
              icon={<Flame className="w-4 h-4" />}
              label="Streak"
              value={`${stats.revisionStreak}d`}
              color="text-orange-400"
            />
          </div>

          {/* Due for Review Alert */}
          {stats.dueForReview > 0 && (
            <Link href="/study-ai/revision">
              <div
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl",
                  "bg-orange-500/10 border border-orange-500/30",
                  "hover:bg-orange-500/20 transition-colors cursor-pointer"
                )}
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-400" />
                  <span className="text-sm">
                    <span className="font-semibold text-orange-400">
                      {stats.dueForReview}
                    </span>{" "}
                    {stats.dueForReview === 1 ? "item" : "items"} due for review
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-orange-400" />
              </div>
            </Link>
          )}

          {/* Last Activity */}
          {stats.lastActivityAt && (
            <div className="mt-3 text-xs text-white/40 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last activity: {formatRelativeTime(stats.lastActivityAt)}
            </div>
          )}
        </>
      ) : (
        /* Empty State */
        <div className="text-center py-6 bg-white/5 rounded-xl">
          <Brain className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <p className="text-sm text-white/40">No study goals yet</p>
          <p className="text-xs text-white/30 mt-1">Create your first AI-powered study material</p>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div className="bg-white/5 rounded-xl p-3">
      <div className={cn("flex items-center gap-1.5 mb-1", color)}>
        {icon}
        <span className="text-xs text-white/60">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
