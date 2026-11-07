"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Calendar,
  Timer,
  Sparkles,
  Download,
  Crown,
  Lock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format, formatDistanceToNow, subDays, isAfter } from "date-fns";
import type { StudySession } from "@/types/database.types";
import { formatXP } from "@/lib/xp";

// Mode icons and colors
const modeConfig = {
  pomodoro: { icon: Timer, color: "text-red-400", bg: "bg-red-400/10" },
  stopwatch: { icon: Clock, color: "text-blue-400", bg: "bg-blue-400/10" },
  countdown: { icon: Clock, color: "text-green-400", bg: "bg-green-400/10" },
};

interface SessionHistoryProps {
  sessions: StudySession[];
  isPro: boolean;
  className?: string;
}

export function SessionHistory({
  sessions,
  isPro,
  className,
}: SessionHistoryProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Free users only see last 7 days
  const sevenDaysAgo = subDays(new Date(), 7);
  const filteredSessions = isPro
    ? sessions
    : sessions.filter((s) => isAfter(new Date(s.ended_at), sevenDaysAgo));

  // Group sessions by date
  const groupedSessions = filteredSessions.reduce(
    (acc, session) => {
      const date = format(new Date(session.ended_at), "yyyy-MM-dd");
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(session);
      return acc;
    },
    {} as Record<string, StudySession[]>
  );

  const dates = Object.keys(groupedSessions).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  // Calculate totals
  const totalMinutes = Math.floor(
    filteredSessions.reduce((acc, s) => acc + s.duration_seconds, 0) / 60
  );
  const totalXP = filteredSessions.reduce((acc, s) => acc + s.xp_earned, 0);
  const totalSessions = filteredSessions.length;

  // Format duration
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Export to CSV (Pro only)
  const exportToCSV = () => {
    if (!isPro) return;

    const headers = ["Date", "Time", "Duration", "Mode", "XP Earned"];
    const rows = sessions.map((s) => [
      format(new Date(s.ended_at), "yyyy-MM-dd"),
      format(new Date(s.ended_at), "HH:mm"),
      formatDuration(s.duration_seconds),
      s.mode,
      s.xp_earned.toString(),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `study-sessions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("border-white/20", className)}
        >
          <Clock className="w-4 h-4 mr-2" />
          History
        </Button>
      </DialogTrigger>
      <DialogContent className="widget-glass sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Session History
            </div>
            {isPro && (
              <Button
                variant="ghost"
                size="sm"
                onClick={exportToCSV}
                className="text-white/60 hover:text-white"
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 py-4">
          <div className="p-3 rounded-lg bg-white/5 text-center">
            <div className="text-2xl font-bold text-white">{totalSessions}</div>
            <div className="text-xs text-white/50">Sessions</div>
          </div>
          <div className="p-3 rounded-lg bg-white/5 text-center">
            <div className="text-2xl font-bold text-white">
              {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
            </div>
            <div className="text-xs text-white/50">Total Time</div>
          </div>
          <div className="p-3 rounded-lg bg-white/5 text-center">
            <div className="text-2xl font-bold text-primary">
              {formatXP(totalXP)}
            </div>
            <div className="text-xs text-white/50">XP Earned</div>
          </div>
        </div>

        {/* Free user notice */}
        {!isPro && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 border border-accent/30 text-sm mb-4">
            <Lock className="w-4 h-4 text-accent flex-shrink-0" />
            <span className="text-accent/80">
              Showing last 7 days.{" "}
              <a href="/pricing" className="underline">
                Upgrade to Pro
              </a>{" "}
              for unlimited history.
            </span>
          </div>
        )}

        {/* Session list */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 -mr-2">
          {dates.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/60">No sessions yet</p>
              <p className="text-sm text-white/40">
                Start a timer to track your study sessions
              </p>
            </div>
          ) : (
            dates
              .slice(0, expanded ? undefined : 5)
              .map((date) => (
                <div key={date}>
                  {/* Date header */}
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-white/40" />
                    <span className="text-sm font-medium text-white/70">
                      {format(new Date(date), "EEEE, MMM d")}
                    </span>
                    <span className="text-xs text-white/40">
                      (
                      {formatDuration(
                        groupedSessions[date].reduce(
                          (acc, s) => acc + s.duration_seconds,
                          0
                        )
                      )}
                      )
                    </span>
                  </div>

                  {/* Sessions for this date */}
                  <div className="space-y-2 ml-6">
                    {groupedSessions[date].map((session) => {
                      const config = modeConfig[session.mode];
                      const Icon = config.icon;
                      return (
                        <motion.div
                          key={session.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          <div
                            className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center",
                              config.bg
                            )}
                          >
                            <Icon className={cn("w-4 h-4", config.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white capitalize">
                                {session.mode}
                              </span>
                              <span className="text-xs text-white/40">
                                {format(new Date(session.ended_at), "HH:mm")}
                              </span>
                            </div>
                            <div className="text-xs text-white/50">
                              {formatDuration(session.duration_seconds)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                            <span className="text-primary font-medium">
                              +{session.xp_earned}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))
          )}

          {/* Show more button */}
          {dates.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="w-full text-white/60"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Show {dates.length - 5} more days
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Mini session summary for dashboard
interface SessionSummaryProps {
  sessions: StudySession[];
  className?: string;
}

export function SessionSummary({ sessions, className }: SessionSummaryProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const todaySessions = sessions.filter(
    (s) => format(new Date(s.ended_at), "yyyy-MM-dd") === today
  );

  const todayMinutes = Math.floor(
    todaySessions.reduce((acc, s) => acc + s.duration_seconds, 0) / 60
  );
  const todayXP = todaySessions.reduce((acc, s) => acc + s.xp_earned, 0);

  return (
    <div
      className={cn(
        "flex items-center gap-4 text-sm text-white/60",
        className
      )}
    >
      <div className="flex items-center gap-1">
        <Clock className="w-4 h-4" />
        <span>{todayMinutes}m today</span>
      </div>
      <div className="flex items-center gap-1">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-primary">+{todayXP} XP</span>
      </div>
    </div>
  );
}
