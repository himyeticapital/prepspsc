"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, Maximize2, Timer, Clock, Hourglass } from "lucide-react";
import { useWidgetStore } from "@/stores/widget-store";
import { useTimerStore } from "@/stores/timer-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TimerMiniPlayer() {
  const { isTimerMinimized, isMusicMinimized, maximizeTimer, activeTaskId, notes } = useWidgetStore();
  const {
    mode,
    status,
    elapsedSeconds,
    targetSeconds,
    pomodoroConfig,
    currentSessionName,
    start,
    pause,
    reset,
    resumeIfNeeded,
  } = useTimerStore();

  const activeTask = activeTaskId ? notes.find((n) => n.id === activeTaskId) : null;

  // Resume timer if it was running before navigation
  useEffect(() => {
    resumeIfNeeded();
  }, [resumeIfNeeded]);

  if (!isTimerMinimized) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getDisplayTime = () => {
    if (mode === "stopwatch") {
      return formatTime(elapsedSeconds);
    }
    const remaining = Math.max(0, targetSeconds - elapsedSeconds);
    return formatTime(remaining);
  };

  const modeIcons = {
    pomodoro: Timer,
    stopwatch: Clock,
    countdown: Hourglass,
  };

  const ModeIcon = modeIcons[mode];

  // Position: if music is also minimized, stack above it
  const bottomPosition = isMusicMinimized ? "bottom-20" : "bottom-6";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className={cn("fixed left-24 z-40 pointer-events-auto", bottomPosition)}
    >
      <div className="widget-glass rounded-full px-4 py-2 flex items-center gap-3 shadow-2xl border border-white/10">
        {/* Mode Icon with animation when running */}
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            status === "running"
              ? "bg-primary/20 text-primary"
              : "bg-white/10 text-white/60"
          )}
        >
          <ModeIcon
            className={cn(
              "w-4 h-4",
              status === "running" && "animate-pulse"
            )}
          />
        </div>

        {/* Timer Display */}
        <div className="flex flex-col min-w-[60px]">
          <span className="text-sm font-bold text-white tabular-nums">
            {getDisplayTime()}
          </span>
          {activeTask ? (
            <span className="text-[10px] text-primary truncate max-w-[80px]">
              {activeTask.text}
            </span>
          ) : currentSessionName ? (
            <span className="text-[10px] text-primary truncate max-w-[80px]">
              {currentSessionName}
            </span>
          ) : (
            <span className="text-[10px] text-white/50 capitalize">
              {mode === "pomodoro"
                ? `${pomodoroConfig.currentSession} session`
                : mode}
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={status === "running" ? pause : start}
            className={cn(
              "w-8 h-8 rounded-full",
              status === "running"
                ? "bg-accent/20 text-accent hover:bg-accent/30"
                : "bg-primary/20 text-primary hover:bg-primary/30"
            )}
          >
            {status === "running" ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={reset}
            className="w-8 h-8 rounded-full text-white/60 hover:text-white hover:bg-white/10"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={maximizeTimer}
            className="w-8 h-8 rounded-full text-white/60 hover:text-white hover:bg-white/10"
            title="Expand timer"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
