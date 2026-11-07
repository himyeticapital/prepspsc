"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, Timer, Clock, Hourglass, ListTodo, X, Minimize2, Edit3, Check } from "lucide-react";
import { useTimerStore } from "@/stores/timer-store";
import { useWidgetStore } from "@/stores/widget-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { PomodoroSettings, PomodoroConfigDisplay } from "@/components/timer/pomodoro-settings";

export function TimerWidget() {
  const {
    mode,
    status,
    elapsedSeconds,
    targetSeconds,
    pomodoroConfig,
    totalSessionSeconds,
    currentSessionName,
    setMode,
    setTargetSeconds,
    setSessionName,
    start,
    pause,
    reset,
    resumeIfNeeded,
    getTodaysSessions,
  } = useTimerStore();

  const { profile } = useAuthStore();
  const { activeTaskId, notes, setActiveTask, minimizeTimer } = useWidgetStore();
  const activeTask = activeTaskId ? notes.find((n) => n.id === activeTaskId) : null;

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(currentSessionName);

  // Calculate work time only (not break time)
  const workTimeStudied = pomodoroConfig.currentSession === "work"
    ? totalSessionSeconds + elapsedSeconds
    : totalSessionSeconds;

  // Get today's session count from history for accurate display
  const todaysSessions = getTodaysSessions();
  const todaysSessionCount = todaysSessions.length;

  // Handle manual session completion
  const handleComplete = () => {
    const minutes = Math.floor(workTimeStudied / 60);
    if (minutes > 0) {
      // The reset() function will save to history and sync to database
    }
    reset();
  };

  // Resume timer if it was running before navigation
  useEffect(() => {
    resumeIfNeeded();
  }, [resumeIfNeeded]);

  // Sync session name with active task
  useEffect(() => {
    if (activeTask && !currentSessionName) {
      setSessionName(activeTask.text);
      setNameInput(activeTask.text);
    }
  }, [activeTask, currentSessionName, setSessionName]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins
        .toString()
        .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const getDisplayTime = () => {
    if (mode === "stopwatch") {
      return formatTime(elapsedSeconds);
    }
    const remaining = Math.max(0, targetSeconds - elapsedSeconds);
    return formatTime(remaining);
  };

  const getProgress = () => {
    if (mode === "stopwatch") {
      // For stopwatch, fill based on 60 minutes max
      return Math.min((elapsedSeconds / 3600) * 100, 100);
    }
    return (elapsedSeconds / targetSeconds) * 100;
  };

  const modeIcons = {
    pomodoro: Timer,
    stopwatch: Clock,
    countdown: Hourglass,
  };

  const handleClearTask = () => {
    setActiveTask(null);
    setSessionName("");
    setNameInput("");
  };

  const handleSaveName = () => {
    setSessionName(nameInput.trim());
    setIsEditingName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      setNameInput(currentSessionName);
      setIsEditingName(false);
    }
  };

  return (
    <div className="p-4 space-y-3">
      {/* Session Name / Active Task Display */}
      {isEditingName ? (
        <div className="flex items-center gap-2">
          <Input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSaveName}
            placeholder="Name this session..."
            className="flex-1 h-9 bg-white/5 border-white/10 text-sm"
            autoFocus
          />
        </div>
      ) : activeTask ? (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/20">
          <ListTodo className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="flex-1 text-sm text-white truncate">{activeTask.text}</span>
          <button
            onClick={handleClearTask}
            className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors flex-shrink-0"
            title="Clear task"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : currentSessionName ? (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 border border-white/10">
          <Timer className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="flex-1 text-sm text-white truncate">{currentSessionName}</span>
          <button
            onClick={() => setIsEditingName(true)}
            className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors flex-shrink-0"
            title="Edit name"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsEditingName(true)}
          className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-white/5 border border-white/10 border-dashed text-white/50 hover:text-white hover:bg-white/10 transition-colors text-sm"
        >
          <Edit3 className="w-4 h-4" />
          Name this session
        </button>
      )}

      {/* Mode Selector */}
      <div className="flex justify-center gap-2">
        {(["pomodoro", "stopwatch", "countdown"] as const).map((m) => {
          const Icon = modeIcons[m];
          return (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                mode === m
                  ? "bg-primary/20 text-primary"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              )}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </div>

      {/* Pomodoro Settings */}
      {mode === "pomodoro" && (
        <div className="flex items-center justify-center gap-3">
          <PomodoroConfigDisplay />
          <PomodoroSettings isPro={!!profile?.is_pro_member} />
        </div>
      )}

      {/* Timer Display */}
      <div className="relative flex items-center justify-center py-4">
        {/* Progress Circle */}
        <svg className="w-40 h-40 -rotate-90">
          <circle
            cx="80"
            cy="80"
            r="72"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            className="text-white/10"
          />
          <motion.circle
            cx="80"
            cy="80"
            r="72"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            className="text-primary"
            strokeDasharray={2 * Math.PI * 72}
            animate={{ strokeDashoffset: 2 * Math.PI * 72 * (1 - getProgress() / 100) }}
            transition={{ duration: 0.9, ease: "linear" }}
          />
        </svg>

        {/* Time Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-white tabular-nums">
            {getDisplayTime()}
          </span>
          {mode === "pomodoro" && (
            <span className="text-xs text-white/60 mt-1">
              {pomodoroConfig.currentSession === "work"
                ? `Session ${todaysSessionCount + 1}`
                : pomodoroConfig.currentSession === "break"
                ? "Short Break"
                : "Long Break"}
            </span>
          )}
        </div>
      </div>

      {/* Duration Selector (for countdown mode) */}
      {mode === "countdown" && status === "idle" && (
        <div className="flex justify-center">
          <Select
            value={String(targetSeconds / 60)}
            onValueChange={(v) => setTargetSeconds(Number(v) * 60)}
          >
            <SelectTrigger className="w-32 bg-white/5 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[15, 25, 30, 45, 60, 90, 120].map((mins) => (
                <SelectItem key={mins} value={String(mins)}>
                  {mins} min
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Controls */}
      <div className="flex justify-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={reset}
          disabled={status === "idle" && elapsedSeconds === 0}
          className="bg-white/5 border-white/10 hover:bg-white/10 disabled:opacity-30"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>

        <Button
          size="lg"
          onClick={status === "running" ? pause : start}
          className={cn(
            "px-8",
            status === "running"
              ? "bg-accent hover:bg-accent/90"
              : "bg-primary hover:bg-primary/90"
          )}
        >
          {status === "running" ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5" />
          )}
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={handleComplete}
          disabled={elapsedSeconds < 60}
          className="bg-white/5 border-white/10 hover:bg-white/10 hover:text-green-400 disabled:opacity-30"
          title="Complete session"
        >
          <Check className="w-4 h-4" />
        </Button>
      </div>

      {/* Current session info */}
      {workTimeStudied > 0 && (
        <p className="text-center text-xs text-white/50">
          {Math.floor(workTimeStudied / 60)} min studied this session
        </p>
      )}

      {/* Minimize Button */}
      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={minimizeTimer}
          className="text-white/50 hover:text-white hover:bg-white/10 gap-2"
        >
          <Minimize2 className="w-4 h-4" />
          <span className="text-xs">Minimize Timer</span>
        </Button>
      </div>

    </div>
  );
}
