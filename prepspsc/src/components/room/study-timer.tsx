"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useTimerStore } from "@/stores/timer-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatTime } from "@/lib/utils";
import { Play, Pause, RotateCcw, Timer, Clock, Hourglass, Check, Edit3 } from "lucide-react";
import { PomodoroSettings, PomodoroConfigDisplay } from "@/components/timer/pomodoro-settings";

interface StudyTimerProps {
  onSessionComplete: (minutes: number) => void;
  isPro?: boolean;
}

export function StudyTimer({ onSessionComplete, isPro = false }: StudyTimerProps) {
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
    getTodaysSessions,
  } = useTimerStore();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(currentSessionName);

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

  // Calculate display time based on mode
  const displayTime = mode === "stopwatch"
    ? elapsedSeconds
    : targetSeconds - elapsedSeconds;

  // Progress for countdown/pomodoro
  const progress = mode === "stopwatch"
    ? 0
    : ((targetSeconds - elapsedSeconds) / targetSeconds) * 100;

  // Calculate work time only (not break time)
  const workTimeStudied = pomodoroConfig.currentSession === "work"
    ? totalSessionSeconds + elapsedSeconds
    : totalSessionSeconds;

  // Get today's session count from history for accurate display
  const todaysSessions = getTodaysSessions();
  const todaysSessionCount = todaysSessions.length;

  // Handle timer completion (manual check button)
  const handleComplete = () => {
    // Use workTimeStudied which tracks total work time across sessions
    const minutes = Math.floor(workTimeStudied / 60);
    if (minutes > 0) {
      onSessionComplete(minutes);
    }
    reset();
  };

  return (
    <div className="space-y-6">
      {/* Session Name */}
      {isEditingName ? (
        <div className="flex items-center justify-center gap-2 px-4">
          <Input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSaveName}
            placeholder="Name this session..."
            className="max-w-[200px] h-8 bg-white/5 border-white/10 text-sm text-center"
            autoFocus
          />
        </div>
      ) : currentSessionName ? (
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-primary">{currentSessionName}</span>
          <button
            onClick={() => {
              setNameInput(currentSessionName);
              setIsEditingName(true);
            }}
            className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsEditingName(true)}
          className="flex items-center justify-center gap-1.5 mx-auto px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 border-dashed text-white/50 hover:text-white hover:bg-white/10 transition-colors text-xs"
        >
          <Edit3 className="w-3 h-3" />
          Name this session
        </button>
      )}

      {/* Mode Selector */}
      <div className="flex items-center justify-center gap-2">
        {(["pomodoro", "stopwatch", "countdown"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all",
              mode === m
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-white/5 text-white/60 hover:bg-white/10"
            )}
          >
            {m === "pomodoro" && <Timer className="w-4 h-4" />}
            {m === "stopwatch" && <Clock className="w-4 h-4" />}
            {m === "countdown" && <Hourglass className="w-4 h-4" />}
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {/* Pomodoro Settings */}
      {mode === "pomodoro" && (
        <div className="flex flex-col items-center gap-2">
          <PomodoroSettings isPro={isPro} />
          <PomodoroConfigDisplay />
        </div>
      )}

      {/* Timer Display */}
      <div className="relative flex items-center justify-center">
        <svg className="w-52 h-52 -rotate-90">
          <circle
            cx="104"
            cy="104"
            r="96"
            className="fill-none stroke-white/10"
            strokeWidth="6"
          />
          {mode !== "stopwatch" && (
            <motion.circle
              cx="104"
              cy="104"
              r="96"
              className="fill-none stroke-primary"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 96}
              animate={{ strokeDashoffset: 2 * Math.PI * 96 * (1 - progress / 100) }}
              transition={{ duration: 0.9, ease: "linear" }}
            />
          )}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {mode === "pomodoro" && (
            <span className={cn(
              "text-xs font-medium mb-2 px-2 py-1 rounded-full",
              pomodoroConfig.currentSession === "work"
                ? "bg-primary/20 text-primary"
                : "bg-green-500/20 text-green-400"
            )}>
              {pomodoroConfig.currentSession === "work" ? "Focus Time" : "Break Time"}
            </span>
          )}
          <span className="text-5xl font-mono font-bold tracking-wider text-white">
            {formatTime(Math.max(0, displayTime))}
          </span>
          {mode === "pomodoro" && (
            <span className="text-xs text-white/40 mt-2">
              {pomodoroConfig.currentSession === "work"
                ? `Session ${todaysSessionCount + 1}`
                : pomodoroConfig.currentSession === "break"
                ? "Short Break"
                : "Long Break"}
            </span>
          )}
        </div>
      </div>

      {/* Countdown Duration Selector */}
      {mode === "countdown" && status === "idle" && (
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-white/50">Duration:</span>
          <Select
            value={String(targetSeconds / 60)}
            onValueChange={(v) => setTargetSeconds(parseInt(v) * 60)}
          >
            <SelectTrigger className="w-28 bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/10">
              <SelectItem value="15">15 min</SelectItem>
              <SelectItem value="30">30 min</SelectItem>
              <SelectItem value="45">45 min</SelectItem>
              <SelectItem value="60">60 min</SelectItem>
              <SelectItem value="90">90 min</SelectItem>
              <SelectItem value="120">120 min</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={reset}
          disabled={status === "idle" && elapsedSeconds === 0}
          className="text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30"
        >
          <RotateCcw className="w-5 h-5" />
        </Button>

        <Button
          size="lg"
          className={cn(
            "w-20 h-20 rounded-full shadow-lg",
            status === "running"
              ? "bg-red-500 hover:bg-red-600"
              : "bg-primary hover:bg-primary/90"
          )}
          onClick={status === "running" ? pause : start}
        >
          {status === "running" ? (
            <Pause className="w-7 h-7" />
          ) : (
            <Play className="w-7 h-7 ml-1" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleComplete}
          disabled={elapsedSeconds < 60}
          className="text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30"
        >
          <Check className="w-5 h-5" />
        </Button>
      </div>

      {/* Current session info */}
      {workTimeStudied > 0 && (
        <p className="text-center text-sm text-white/50">
          {Math.floor(workTimeStudied / 60)} min studied this session
        </p>
      )}
    </div>
  );
}
