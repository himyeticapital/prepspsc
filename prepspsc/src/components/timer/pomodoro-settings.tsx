"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Coffee,
  Sun,
  Hash,
  Play,
  Crown,
  Lock,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTimerStore, TIMER_LIMITS } from "@/stores/timer-store";

interface PomodoroSettingsProps {
  isPro: boolean;
  className?: string;
}

export function PomodoroSettings({ isPro, className }: PomodoroSettingsProps) {
  const {
    pomodoroConfig,
    setWorkDuration,
    setBreakDuration,
    setLongBreakDuration,
    setSessionsUntilLongBreak,
    setAutoStartBreaks,
    status,
  } = useTimerStore();

  const [open, setOpen] = useState(false);

  // Local state for live preview while dragging
  const [localWork, setLocalWork] = useState(pomodoroConfig.workMinutes);
  const [localBreak, setLocalBreak] = useState(pomodoroConfig.breakMinutes);
  const [localLongBreak, setLocalLongBreak] = useState(
    pomodoroConfig.longBreakMinutes
  );
  const [localSessions, setLocalSessions] = useState(
    pomodoroConfig.sessionsUntilLongBreak
  );

  const isDisabled = status === "running";

  const handleWorkChange = (value: number[]) => {
    const minutes = value[0];
    setLocalWork(minutes);
    setWorkDuration(minutes, isPro);
  };

  const handleBreakChange = (value: number[]) => {
    const minutes = value[0];
    setLocalBreak(minutes);
    setBreakDuration(minutes);
  };

  const handleLongBreakChange = (value: number[]) => {
    const minutes = value[0];
    setLocalLongBreak(minutes);
    setLongBreakDuration(minutes);
  };

  const handleSessionsChange = (value: number[]) => {
    const sessions = value[0];
    setLocalSessions(sessions);
    setSessionsUntilLongBreak(sessions);
  };

  // Reset to presets
  const presets = [
    { name: "Classic", work: 25, break: 5, longBreak: 15, sessions: 4 },
    { name: "Extended", work: 50, break: 10, longBreak: 30, sessions: 2 },
    { name: "Short", work: 15, break: 3, longBreak: 15, sessions: 4 },
  ];

  const applyPreset = (preset: (typeof presets)[0]) => {
    setWorkDuration(preset.work, isPro);
    setBreakDuration(preset.break);
    setLongBreakDuration(preset.longBreak);
    setSessionsUntilLongBreak(preset.sessions);
    setLocalWork(isPro ? preset.work : TIMER_LIMITS.FREE_WORK_MIN);
    setLocalBreak(preset.break);
    setLocalLongBreak(preset.longBreak);
    setLocalSessions(preset.sessions);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("border-white/20", className)}
          disabled={isDisabled}
        >
          <Settings2 className="w-4 h-4 mr-2" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="widget-glass sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Pomodoro Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Work Duration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Work Duration
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-white">
                  {localWork} min
                </span>
                {!isPro && localWork !== TIMER_LIMITS.FREE_WORK_MIN && (
                  <Lock className="w-4 h-4 text-white/40" />
                )}
              </div>
            </div>

            <div className="relative">
              <Slider
                value={[localWork]}
                onValueChange={handleWorkChange}
                min={isPro ? TIMER_LIMITS.PRO_WORK_MIN : TIMER_LIMITS.FREE_WORK_MIN}
                max={isPro ? TIMER_LIMITS.PRO_WORK_MAX : TIMER_LIMITS.FREE_WORK_MAX}
                step={5}
                disabled={!isPro}
                className={cn(!isPro && "opacity-50")}
              />
              {!isPro && (
                <div className="mt-2 flex items-center gap-1 text-xs text-accent">
                  <Crown className="w-3 h-3" />
                  <span>Pro: Unlock 15-90 min range</span>
                </div>
              )}
            </div>
          </div>

          {/* Break Duration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Coffee className="w-4 h-4 text-green-400" />
                Break Duration
              </Label>
              <span className="text-lg font-semibold text-white">
                {localBreak} min
              </span>
            </div>
            <Slider
              value={[localBreak]}
              onValueChange={handleBreakChange}
              min={TIMER_LIMITS.BREAK_MIN}
              max={TIMER_LIMITS.BREAK_MAX}
              step={1}
            />
          </div>

          {/* Long Break Duration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Sun className="w-4 h-4 text-yellow-400" />
                Long Break
              </Label>
              <span className="text-lg font-semibold text-white">
                {localLongBreak} min
              </span>
            </div>
            <Slider
              value={[localLongBreak]}
              onValueChange={handleLongBreakChange}
              min={TIMER_LIMITS.LONG_BREAK_MIN}
              max={TIMER_LIMITS.LONG_BREAK_MAX}
              step={5}
            />
          </div>

          {/* Sessions until long break */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-blue-400" />
                Sessions before long break
              </Label>
              <span className="text-lg font-semibold text-white">
                {localSessions}
              </span>
            </div>
            <Slider
              value={[localSessions]}
              onValueChange={handleSessionsChange}
              min={2}
              max={8}
              step={1}
            />
          </div>

          {/* Auto-start breaks */}
          <div className="flex items-center justify-between">
            <Label
              htmlFor="auto-start"
              className="flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 text-purple-400" />
              Auto-start breaks
            </Label>
            <Switch
              id="auto-start"
              checked={pomodoroConfig.autoStartBreaks}
              onCheckedChange={setAutoStartBreaks}
            />
          </div>

          {/* Presets */}
          <div className="pt-4 border-t border-white/10">
            <Label className="text-sm text-white/60 mb-3 block">
              Quick Presets
            </Label>
            <div className="flex gap-2">
              {presets.map((preset) => {
                const isProPreset = preset.work > TIMER_LIMITS.FREE_WORK_MAX;
                return (
                  <Button
                    key={preset.name}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset)}
                    disabled={isProPreset && !isPro}
                    className="flex-1 border-white/20"
                  >
                    {preset.name}
                    {isProPreset && !isPro && (
                      <Crown className="w-3 h-3 ml-1 text-accent" />
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Compact settings display for timer widget
interface PomodoroConfigDisplayProps {
  className?: string;
}

export function PomodoroConfigDisplay({ className }: PomodoroConfigDisplayProps) {
  const { pomodoroConfig } = useTimerStore();

  return (
    <div
      className={cn(
        "flex items-center gap-3 text-xs text-white/50",
        className
      )}
    >
      <div className="flex items-center gap-1">
        <Clock className="w-3 h-3" />
        <span>{pomodoroConfig.workMinutes}m</span>
      </div>
      <div className="flex items-center gap-1">
        <Coffee className="w-3 h-3" />
        <span>{pomodoroConfig.breakMinutes}m</span>
      </div>
      <div className="flex items-center gap-1">
        <Sun className="w-3 h-3" />
        <span>{pomodoroConfig.longBreakMinutes}m</span>
      </div>
    </div>
  );
}
