"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Flame, Clock, BookOpen, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface BuddyComparisonProps {
  userId: string;
  buddyId: string;
  onClose: () => void;
}

interface UserStats {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  xp_points: number;
  xp_level: number;
  current_streak: number;
  total_minutes_all_time: number;
  testsDone: number;
}

function formatStudyTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

function ComparisonBar({
  label,
  icon,
  leftValue,
  rightValue,
  leftLabel,
  rightLabel,
}: {
  label: string;
  icon: React.ReactNode;
  leftValue: number;
  rightValue: number;
  leftLabel: string;
  rightLabel: string;
}) {
  const maxVal = Math.max(leftValue, rightValue, 1);
  const leftPct = (leftValue / maxVal) * 100;
  const rightPct = (rightValue / maxVal) * 100;
  const leftAhead = leftValue > rightValue;
  const rightAhead = rightValue > leftValue;
  const tied = leftValue === rightValue;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {/* Left value */}
        <span
          className={cn(
            "text-xs font-semibold w-10 text-right tabular-nums",
            leftAhead ? "text-emerald-400" : tied ? "text-zinc-300" : "text-zinc-500"
          )}
        >
          {leftLabel}
        </span>

        {/* Bars */}
        <div className="flex-1 flex items-center gap-1">
          {/* Left bar (grows right-to-left) */}
          <div className="flex-1 flex justify-end">
            <div
              className={cn(
                "h-2.5 rounded-full transition-all duration-500",
                leftAhead
                  ? "bg-gradient-to-l from-emerald-500 to-emerald-600"
                  : tied
                    ? "bg-zinc-500"
                    : "bg-zinc-600"
              )}
              style={{ width: `${leftPct}%` }}
            />
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-white/20 shrink-0" />

          {/* Right bar (grows left-to-right) */}
          <div className="flex-1">
            <div
              className={cn(
                "h-2.5 rounded-full transition-all duration-500",
                rightAhead
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
                  : tied
                    ? "bg-zinc-500"
                    : "bg-zinc-600"
              )}
              style={{ width: `${rightPct}%` }}
            />
          </div>
        </div>

        {/* Right value */}
        <span
          className={cn(
            "text-xs font-semibold w-10 tabular-nums",
            rightAhead ? "text-emerald-400" : tied ? "text-zinc-300" : "text-zinc-500"
          )}
        >
          {rightLabel}
        </span>
      </div>
    </div>
  );
}

export function BuddyComparison({ userId, buddyId, onClose }: BuddyComparisonProps) {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [buddyStats, setBuddyStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      setIsLoading(true);
      setError(null);

      try {
        const supabase = createClient();

        // Fetch both profiles in parallel
        const [userRes, buddyRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url, xp_points, xp_level, current_streak, total_minutes_all_time")
            .eq("id", userId)
            .single(),
          supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url, xp_points, xp_level, current_streak, total_minutes_all_time")
            .eq("id", buddyId)
            .single(),
        ]);

        if (userRes.error) throw userRes.error;
        if (buddyRes.error) throw buddyRes.error;

        // Fetch test counts in parallel
        const [userTests, buddyTests] = await Promise.all([
          supabase
            .from("test_attempts")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("status", "completed"),
          supabase
            .from("test_attempts")
            .select("id", { count: "exact", head: true })
            .eq("user_id", buddyId)
            .eq("status", "completed"),
        ]);

        setUserStats({
          ...userRes.data,
          testsDone: userTests.count || 0,
        });
        setBuddyStats({
          ...buddyRes.data,
          testsDone: buddyTests.count || 0,
        });
      } catch (err) {
        console.error("Failed to fetch comparison stats:", err);
        setError("Failed to load stats");
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, [userId, buddyId]);

  return (
    <div className="bg-zinc-800/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 mx-4 my-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Stats Comparison
        </h4>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-white transition-colors p-0.5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
        </div>
      ) : error ? (
        <div className="text-center py-6">
          <p className="text-zinc-500 text-xs">{error}</p>
        </div>
      ) : userStats && buddyStats ? (
        <div className="space-y-4">
          {/* Avatars + Names */}
          <div className="flex items-center justify-between px-2">
            {/* User (left) */}
            <div className="flex flex-col items-center gap-1.5">
              {userStats.avatar_url ? (
                <img
                  src={userStats.avatar_url}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/30"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary ring-2 ring-emerald-500/30">
                  {(userStats.full_name || "?")[0].toUpperCase()}
                </div>
              )}
              <span className="text-[11px] font-medium text-zinc-300 max-w-[80px] truncate">
                You
              </span>
            </div>

            <span className="text-zinc-600 text-xs font-medium">VS</span>

            {/* Buddy (right) */}
            <div className="flex flex-col items-center gap-1.5">
              {buddyStats.avatar_url ? (
                <img
                  src={buddyStats.avatar_url}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-500/30"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary ring-2 ring-purple-500/30">
                  {(buddyStats.full_name || "?")[0].toUpperCase()}
                </div>
              )}
              <span className="text-[11px] font-medium text-zinc-300 max-w-[80px] truncate">
                {buddyStats.full_name || buddyStats.username || "Buddy"}
              </span>
            </div>
          </div>

          {/* Comparison Bars */}
          <div className="space-y-3 pt-1">
            <ComparisonBar
              label="XP Level"
              icon={<Star className="w-3 h-3" />}
              leftValue={userStats.xp_level}
              rightValue={buddyStats.xp_level}
              leftLabel={`Lv.${userStats.xp_level}`}
              rightLabel={`Lv.${buddyStats.xp_level}`}
            />
            <ComparisonBar
              label="Streak"
              icon={<Flame className="w-3 h-3" />}
              leftValue={userStats.current_streak}
              rightValue={buddyStats.current_streak}
              leftLabel={`${userStats.current_streak}d`}
              rightLabel={`${buddyStats.current_streak}d`}
            />
            <ComparisonBar
              label="Study Time"
              icon={<Clock className="w-3 h-3" />}
              leftValue={userStats.total_minutes_all_time}
              rightValue={buddyStats.total_minutes_all_time}
              leftLabel={formatStudyTime(userStats.total_minutes_all_time)}
              rightLabel={formatStudyTime(buddyStats.total_minutes_all_time)}
            />
            <ComparisonBar
              label="Tests Done"
              icon={<BookOpen className="w-3 h-3" />}
              leftValue={userStats.testsDone}
              rightValue={buddyStats.testsDone}
              leftLabel={`${userStats.testsDone}`}
              rightLabel={`${buddyStats.testsDone}`}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
