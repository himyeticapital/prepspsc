"use client";

import { useState, useEffect, useMemo } from "react";
import { Clock, Flame, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

interface Stats {
  todayMinutes: number;
  weekMinutes: number;
  currentStreak: number;
  testsCompleted: number;
  accuracy: number;
}

interface HeatmapDay {
  date: string;
  minutes: number;
}

// Get color based on minutes studied
function getHeatmapColor(minutes: number): string {
  if (minutes === 0) return "bg-white/5";
  if (minutes < 30) return "bg-teal-900/60";
  if (minutes < 60) return "bg-teal-700/70";
  if (minutes < 120) return "bg-teal-500/80";
  if (minutes < 180) return "bg-teal-400/90";
  return "bg-teal-300";
}

interface StatItemProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  color?: "primary" | "accent" | "default";
}

function StatItem({ icon: Icon, label, value, subValue, color = "default" }: StatItemProps) {
  const colorClasses = {
    primary: "text-primary bg-primary/20",
    accent: "text-accent bg-accent/20",
    default: "text-white/80 bg-white/10",
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
      <div className={cn("p-2 rounded-lg", colorClasses[color])}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/50">{label}</p>
        <p className="text-lg font-semibold text-white">{value}</p>
        {subValue && <p className="text-xs text-white/40">{subValue}</p>}
      </div>
    </div>
  );
}

// Activity Heatmap Component
function ActivityHeatmap({ heatmapData }: { heatmapData: HeatmapDay[] }) {
  // Organize data into weeks (columns) and days (rows)
  const weeks = useMemo(() => {
    if (heatmapData.length === 0) return [];

    const result: HeatmapDay[][] = [];
    let currentWeek: HeatmapDay[] = [];

    // Find the starting day offset (to align with weekday)
    const firstDate = new Date(heatmapData[0].date);
    const startDayOffset = firstDate.getDay(); // 0 = Sunday

    // Add empty cells for alignment
    for (let i = 0; i < startDayOffset; i++) {
      currentWeek.push({ date: "", minutes: -1 });
    }

    heatmapData.forEach((day) => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        result.push(currentWeek);
        currentWeek = [];
      }
    });

    // Push remaining days
    if (currentWeek.length > 0) {
      result.push(currentWeek);
    }

    return result;
  }, [heatmapData]);

  // Calculate total study time
  const totalMinutes = useMemo(
    () => heatmapData.reduce((sum, day) => sum + (day.minutes > 0 ? day.minutes : 0), 0),
    [heatmapData]
  );

  const totalHours = Math.floor(totalMinutes / 60);

  if (heatmapData.length === 0) {
    return (
      <div className="p-3 rounded-xl bg-white/5">
        <p className="text-xs text-white/50 text-center">No study data yet</p>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-xl bg-white/5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-white/50">Activity (16 weeks)</p>
        <p className="text-xs text-white/70">{totalHours}h total</p>
      </div>

      {/* Heatmap Grid */}
      <div className="flex gap-[2px] overflow-hidden">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-[2px]">
            {week.map((day, dayIndex) => (
              <div
                key={`${weekIndex}-${dayIndex}`}
                className={cn(
                  "w-[10px] h-[10px] rounded-[2px] transition-colors",
                  day.minutes === -1 ? "bg-transparent" : getHeatmapColor(day.minutes)
                )}
                title={
                  day.minutes >= 0
                    ? `${day.date}: ${day.minutes} minutes`
                    : undefined
                }
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-2">
        <span className="text-[10px] text-white/40 mr-1">Less</span>
        <div className="w-[10px] h-[10px] rounded-[2px] bg-white/5" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-teal-900/60" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-teal-700/70" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-teal-500/80" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-teal-300" />
        <span className="text-[10px] text-white/40 ml-1">More</span>
      </div>
    </div>
  );
}

export function StatsWidget() {
  const { user, profile } = useAuthStore();
  const [stats, setStats] = useState<Stats>({
    todayMinutes: 0,
    weekMinutes: 0,
    currentStreak: 0,
    testsCompleted: 0,
    accuracy: 0,
  });
  const [heatmapData, setHeatmapData] = useState<HeatmapDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let isCancelled = false;

    const fetchStats = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Get today's date and week ago
        const today = new Date();
        const todayStr = today.toISOString().split("T")[0];
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split("T")[0];

        // Fetch study logs for heatmap (last 112 days / 16 weeks)
        const heatmapStart = new Date();
        heatmapStart.setDate(heatmapStart.getDate() - 111);

        const { data: studyLogs, error: logsError } = await supabase
          .from("daily_study_logs")
          .select("study_date, minutes_studied")
          .eq("user_id", user.id)
          .gte("study_date", heatmapStart.toISOString().split("T")[0])
          .order("study_date", { ascending: true });

        if (isCancelled) return;

        if (logsError) {
          if (logsError.message?.includes("aborted") || logsError.message?.includes("AbortError")) {
            return;
          }
          console.error("Study logs fetch error:", logsError.message);
        }

        // Create heatmap data with all days
        const heatmap: HeatmapDay[] = [];
        for (let i = 111; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split("T")[0];
          const log = studyLogs?.find((l) => l.study_date === dateStr);
          heatmap.push({
            date: dateStr,
            minutes: log?.minutes_studied || 0,
          });
        }
        setHeatmapData(heatmap);

        // Calculate today's minutes
        const todayLog = studyLogs?.find((l) => l.study_date === todayStr);
        const todayMinutes = todayLog?.minutes_studied || 0;

        // Calculate week's minutes
        const weekLogs = studyLogs?.filter((l) => l.study_date >= weekAgoStr) || [];
        const weekMinutes = weekLogs.reduce((sum, l) => sum + l.minutes_studied, 0);

        // Fetch test attempts for stats
        const { data: testAttempts, error: attemptsError } = await supabase
          .from("test_attempts")
          .select("score, total_marks, status")
          .eq("user_id", user.id);

        if (isCancelled) return;

        if (attemptsError) {
          if (attemptsError.message?.includes("aborted") || attemptsError.message?.includes("AbortError")) {
            return;
          }
          console.error("Test attempts fetch error:", attemptsError.message);
        }

        const completedTests = testAttempts?.filter((t) => t.status === "completed") || [];
        const testsCompleted = completedTests.length;

        // Calculate accuracy
        let accuracy = 0;
        if (completedTests.length > 0) {
          const totalPercent = completedTests.reduce((sum, a) => {
            if (a.score && a.total_marks) {
              return sum + (a.score / a.total_marks) * 100;
            }
            return sum;
          }, 0);
          accuracy = Math.round(totalPercent / completedTests.length);
        }

        setStats({
          todayMinutes,
          weekMinutes,
          currentStreak: profile?.current_streak || 0,
          testsCompleted,
          accuracy,
        });
      } catch (err: any) {
        if (isCancelled) return;
        if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
          return;
        }
        console.error("Error fetching stats:", err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchStats();

    return () => {
      isCancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.current_streak]);

  const formatMinutes = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (!user) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-white/50">Sign in to see your stats</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="p-4 space-y-3">
        {/* Today's Progress */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/20">
          <p className="text-xs text-primary/80">Today&apos;s Study Time</p>
          <p className="text-3xl font-bold text-white mt-1">
            {formatMinutes(stats.todayMinutes)}
          </p>
          <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${Math.min((stats.todayMinutes / 120) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-white/40 mt-1">Goal: 2 hours</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          <StatItem
            icon={Clock}
            label="This Week"
            value={formatMinutes(stats.weekMinutes)}
            color="primary"
          />
          <StatItem
            icon={Flame}
            label="Streak"
            value={`${stats.currentStreak} days`}
            color="accent"
          />
          <StatItem
            icon={Target}
            label="Tests Done"
            value={stats.testsCompleted}
          />
          <StatItem
            icon={TrendingUp}
            label="Accuracy"
            value={stats.accuracy > 0 ? `${stats.accuracy}%` : "N/A"}
          />
        </div>

        {/* Activity Heatmap */}
        <ActivityHeatmap heatmapData={heatmapData} />

        {/* Quick Insight */}
        {stats.currentStreak > 0 && (
          <div className="p-3 rounded-xl bg-accent/10 border border-accent/20">
            <p className="text-xs text-accent">
              You&apos;re on a {stats.currentStreak}-day streak! Keep it up!
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
