"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  GraduationCap,
  X,
  CheckCircle2,
  Brain,
  AlertCircle,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { VoiceSettings } from "@/components/ui/tts-controls";
import type { SessionState } from "@/lib/guided-learning/types";

interface SessionHeaderProps {
  sessionState: SessionState;
  subject?: string;
  topics?: string[];
  isExpanded?: boolean;
  onExpandToggle?: () => void;
  onClose?: () => void;
  onComplete?: () => void;
  // TTS props
  ttsEnabled?: boolean;
  onTTSToggle?: (enabled: boolean) => void;
  voices?: SpeechSynthesisVoice[];
  selectedVoice?: SpeechSynthesisVoice | null;
  onVoiceChange?: (voice: SpeechSynthesisVoice) => void;
  speechRate?: number;
  onRateChange?: (rate: number) => void;
  isTTSSupported?: boolean;
}

export function SessionHeader({
  sessionState,
  subject,
  topics,
  isExpanded,
  onExpandToggle,
  onClose,
  onComplete,
  // TTS props
  ttsEnabled = false,
  onTTSToggle,
  voices = [],
  selectedVoice,
  onVoiceChange,
  speechRate = 1.0,
  onRateChange,
  isTTSSupported = true,
}: SessionHeaderProps) {
  const {
    conceptsMastered,
    conceptsStruggling,
    checkpointsPassed,
    checkpointsTotal,
    totalExchanges,
  } = sessionState;

  // Calculate progress dots (max 5)
  const progress = checkpointsTotal > 0
    ? Math.round((checkpointsPassed / checkpointsTotal) * 5)
    : Math.min(Math.floor(totalExchanges / 4), 5);

  return (
    <div className="flex flex-col gap-2 p-3 border-b border-white/10 bg-white/5">
      {/* Main Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Guided Learning</h3>
            {subject && (
              <p className="text-xs text-white/50 truncate max-w-[200px]">
                {subject} {topics && topics.length > 0 && `- ${topics[0]}`}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Progress Dots */}
          <div className="flex items-center gap-1 mr-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  i <= progress ? "bg-green-400" : "bg-white/20"
                )}
              />
            ))}
          </div>

          {/* Complete Button (show after some progress) */}
          {totalExchanges >= 5 && onComplete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onComplete}
              className="h-7 text-xs text-green-400 hover:text-green-300 hover:bg-green-500/10"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Finish
            </Button>
          )}

          {/* Voice Settings Toggle */}
          {isTTSSupported && onTTSToggle && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7",
                    ttsEnabled
                      ? "text-cyan-400 hover:text-cyan-300"
                      : "text-white/50 hover:text-white"
                  )}
                  title={ttsEnabled ? "Voice ON - Click for settings" : "Voice OFF - Click to enable"}
                >
                  {ttsEnabled ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-64 bg-zinc-900 border-white/10"
                align="end"
              >
                <VoiceSettings
                  enabled={ttsEnabled}
                  onToggle={onTTSToggle}
                  voices={voices}
                  selectedVoice={selectedVoice || null}
                  onVoiceChange={onVoiceChange || (() => {})}
                  rate={speechRate}
                  onRateChange={onRateChange || (() => {})}
                />
              </PopoverContent>
            </Popover>
          )}

          {/* Expand/Contract Button */}
          {onExpandToggle && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onExpandToggle}
              className="h-7 w-7 text-white/50 hover:text-white"
              title={isExpanded ? "Contract view" : "Expand view"}
            >
              {isExpanded ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>
          )}

          {/* Close Button */}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 text-white/50 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Stats Row (if we have any progress) */}
      {(conceptsMastered.length > 0 || conceptsStruggling.length > 0 || checkpointsTotal > 0) && (
        <div className="flex items-center gap-4 text-xs">
          {/* Concepts Mastered */}
          {conceptsMastered.length > 0 && (
            <div className="flex items-center gap-1.5 text-green-400">
              <Brain className="w-3.5 h-3.5" />
              <span>{conceptsMastered.length} mastered</span>
            </div>
          )}

          {/* Concepts Struggling */}
          {conceptsStruggling.length > 0 && (
            <div className="flex items-center gap-1.5 text-amber-400">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{conceptsStruggling.length} needs review</span>
            </div>
          )}

          {/* Checkpoints */}
          {checkpointsTotal > 0 && (
            <div className="flex items-center gap-1.5 text-white/50">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {checkpointsPassed}/{checkpointsTotal} checkpoints
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
