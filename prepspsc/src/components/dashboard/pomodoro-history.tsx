"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Timer, Clock, Hourglass, CheckCircle2, XCircle, Flame, Calendar } from "lucide-react";
import { useTimerStore, type PomodoroRecord } from "@/stores/timer-store";
import { cn } from "@/lib/utils";

export function PomodoroHistory() {
  const { pomodoroHistory, getTodaysSessions, getTotalFocusTime, clearHistory } = useTimerStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="animate-pulse">
        <div className="h-32 bg-white/5 rounded-xl" />
      </div>
    );
  }

  const todaysSessions = getTodaysSessions();
  const todayFocusTime = getTotalFocusTime(1);
  const weeklyFocusTime = getTotalFocusTime(7);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const modeIcons = {
    pomodoro: Timer,
    stopwatch: Clock,
    countdown: Hourglass,
  };

  const modeColors = {
    pomodoro: "text-primary",
    stopwatch: "text-blue-400",
    countdown: "text-orange-400",
  };

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="widget-glass p-3 rounded-xl text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-white/50">Today</span>
          </div>
          <p className="text-lg font-bold text-white">{formatDuration(todayFocusTime)}</p>
        </div>

        <div className="widget-glass p-3 rounded-xl text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-xs text-white/50">This Week</span>
          </div>
          <p className="text-lg font-bold text-white">{formatDuration(weeklyFocusTime)}</p>
        </div>

        <div className="widget-glass p-3 rounded-xl text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span className="text-xs text-white/50">Sessions</span>
          </div>
          <p className="text-lg font-bold text-white">{todaysSessions.length}</p>
        </div>
      </div>

      {/* Today's Sessions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-white/70">Today&apos;s Focus Sessions</h4>
          {todaysSessions.length > 0 && (
            <span className="text-xs text-white/40">
              {todaysSessions.length} session{todaysSessions.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {todaysSessions.length === 0 ? (
          <div className="text-center py-6 bg-white/5 rounded-xl">
            <Timer className="w-8 h-8 text-white/20 mx-auto mb-2" />
            <p className="text-sm text-white/40">No focus sessions today</p>
            <p className="text-xs text-white/30 mt-1">Start a timer to track your study time</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {[...todaysSessions].reverse().map((session, index) => {
              const ModeIcon = modeIcons[session.mode];
              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl",
                    session.isCompleted
                      ? "bg-green-500/10 border border-green-500/20"
                      : "bg-white/5 border border-white/10"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      session.isCompleted ? "bg-green-500/20" : "bg-white/10"
                    )}
                  >
                    <ModeIcon className={cn("w-4 h-4", modeColors[session.mode])} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">
                        {session.sessionName}
                      </span>
                      {session.isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <span>{formatTime(session.startTime)}</span>
                      <span>•</span>
                      <span>{formatDuration(session.duration)}</span>
                      {session.mode === "pomodoro" && session.sessionsCompleted > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-primary">
                            {session.sessionsCompleted} pomodoro{session.sessionsCompleted !== 1 ? "s" : ""}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent History (last 7 days summary) */}
      {pomodoroHistory.length > todaysSessions.length && (
        <div className="pt-3 border-t border-white/10">
          <p className="text-xs text-white/40 text-center">
            {pomodoroHistory.length} total sessions recorded
          </p>
        </div>
      )}
    </div>
  );
}
