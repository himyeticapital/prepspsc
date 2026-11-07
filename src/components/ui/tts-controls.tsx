"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TTSControlsProps {
  isSpeaking: boolean;
  isPaused: boolean;
  isThisMessage: boolean;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  className?: string;
  size?: "sm" | "default";
}

export function TTSControls({
  isSpeaking,
  isPaused,
  isThisMessage,
  onPlay,
  onPause,
  onResume,
  onStop,
  className,
  size = "sm",
}: TTSControlsProps) {
  const isActive = isSpeaking && isThisMessage;
  const buttonSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <AnimatePresence mode="wait">
        {isActive ? (
          <motion.div
            key="active-controls"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-1"
          >
            {/* Speaking indicator */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/20 text-primary text-xs font-medium">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                <Volume2 className="w-3.5 h-3.5" />
              </motion.div>
              <span>{isPaused ? "Paused" : "Speaking"}</span>
            </div>

            {/* Pause/Resume button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={isPaused ? onResume : onPause}
              className={cn(buttonSize, "text-white/60 hover:text-white hover:bg-white/10")}
              title={isPaused ? "Resume" : "Pause"}
            >
              {isPaused ? (
                <Play className={iconSize} />
              ) : (
                <Pause className={iconSize} />
              )}
            </Button>

            {/* Stop button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onStop}
              className={cn(buttonSize, "text-white/60 hover:text-red-400 hover:bg-red-500/10")}
              title="Stop"
            >
              <Square className={iconSize} />
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="play-button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            {/* Play button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onPlay}
              className={cn(
                buttonSize,
                "text-white/40 hover:text-primary hover:bg-primary/10",
                isSpeaking && !isThisMessage && "opacity-50"
              )}
              title="Play message"
              disabled={isSpeaking && !isThisMessage}
            >
              <Play className={iconSize} />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Voice settings popover content
interface VoiceSettingsProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  onVoiceChange: (voice: SpeechSynthesisVoice) => void;
  rate: number;
  onRateChange: (rate: number) => void;
}

export function VoiceSettings({
  enabled,
  onToggle,
  voices,
  selectedVoice,
  onVoiceChange,
  rate,
  onRateChange,
}: VoiceSettingsProps) {
  // Filter to show only English voices for cleaner list
  const englishVoices = voices.filter((v) => v.lang.startsWith("en"));
  const displayVoices = englishVoices.length > 0 ? englishVoices : voices;

  const rateOptions = [
    { value: 0.75, label: "0.75x" },
    { value: 1.0, label: "1x" },
    { value: 1.25, label: "1.25x" },
    { value: 1.5, label: "1.5x" },
    { value: 2.0, label: "2x" },
  ];

  return (
    <div className="space-y-4 p-1">
      {/* Auto-play toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/80">Auto-play responses</span>
        <button
          onClick={() => onToggle(!enabled)}
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
            enabled ? "bg-primary" : "bg-white/20"
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
              enabled ? "translate-x-4" : "translate-x-0.5"
            )}
          />
        </button>
      </div>

      {/* Voice selection */}
      <div className="space-y-1.5">
        <label className="text-xs text-white/60">Voice</label>
        <select
          value={selectedVoice?.name || ""}
          onChange={(e) => {
            const voice = voices.find((v) => v.name === e.target.value);
            if (voice) onVoiceChange(voice);
          }}
          className="w-full rounded-md bg-white/10 border border-white/10 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {displayVoices.map((voice) => (
            <option key={voice.name} value={voice.name} className="bg-zinc-800">
              {voice.name} ({voice.lang})
            </option>
          ))}
        </select>
      </div>

      {/* Speed selection */}
      <div className="space-y-1.5">
        <label className="text-xs text-white/60">Speed</label>
        <div className="flex gap-1">
          {rateOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onRateChange(option.value)}
              className={cn(
                "flex-1 py-1 text-xs rounded transition-colors",
                rate === option.value
                  ? "bg-primary text-white"
                  : "bg-white/10 text-white/60 hover:bg-white/20"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
