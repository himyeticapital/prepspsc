"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette,
  Crown,
  Lock,
  Check,
  Trophy,
  Sparkles,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ProfileFrame, Achievement } from "@/types/database.types";

interface ProfileFrameSelectorProps {
  frames: ProfileFrame[];
  currentFrame: string | null;
  isPro: boolean;
  unlockedAchievementSlugs: string[];
  avatarUrl?: string | null;
  userName?: string | null;
  onSelectFrame?: (frameSlug: string) => Promise<boolean>;
  className?: string;
}

export function ProfileFrameSelector({
  frames,
  currentFrame,
  isPro,
  unlockedAchievementSlugs,
  avatarUrl,
  userName,
  onSelectFrame,
  className,
}: ProfileFrameSelectorProps) {
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [previewFrame, setPreviewFrame] = useState<string | null>(null);

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Check if a frame is unlocked
  const isFrameUnlocked = (frame: ProfileFrame): boolean => {
    // Default frame always available
    if (frame.slug === "default") return true;

    // Non-Pro users can't use Pro frames
    if (frame.is_pro_only && !isPro) return false;

    // Check unlock conditions
    if (frame.unlock_condition) {
      // Pro member condition
      if (frame.unlock_condition === "pro_member") {
        return isPro;
      }

      // Achievement-based unlock
      if (frame.unlock_condition.startsWith("achievement:")) {
        const achievementSlug = frame.unlock_condition.split(":")[1];
        return unlockedAchievementSlugs.includes(achievementSlug);
      }
    }

    // Default to available for Pro users
    return isPro;
  };

  // Get unlock requirement text
  const getUnlockText = (frame: ProfileFrame): string | null => {
    if (isFrameUnlocked(frame)) return null;

    if (frame.is_pro_only && !isPro) {
      return "Pro members only";
    }

    if (frame.unlock_condition) {
      if (frame.unlock_condition === "pro_member") {
        return "Upgrade to Pro";
      }
      if (frame.unlock_condition.startsWith("achievement:")) {
        const achievementSlug = frame.unlock_condition.split(":")[1];
        return `Unlock achievement: ${achievementSlug.replace(/_/g, " ")}`;
      }
    }

    return "Locked";
  };

  const handleSelect = async (frameSlug: string) => {
    if (!onSelectFrame || selecting) return;

    const frame = frames.find((f) => f.slug === frameSlug);
    if (!frame || !isFrameUnlocked(frame)) return;

    setSelecting(frameSlug);
    const success = await onSelectFrame(frameSlug);
    setSelecting(null);

    if (success) {
      setOpen(false);
    }
  };

  const displayFrame = previewFrame || currentFrame;
  const displayFrameData = frames.find((f) => f.slug === displayFrame);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("border-white/20", className)}
        >
          <Palette className="w-4 h-4 mr-2" />
          Change Frame
        </Button>
      </DialogTrigger>
      <DialogContent className="widget-glass sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            Profile Frame
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Preview */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              <Avatar
                className={cn(
                  "w-24 h-24 transition-all duration-300",
                  displayFrameData?.css_class || "ring-2 ring-white/20"
                )}
              >
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-2xl">
                  {getInitials(userName)}
                </AvatarFallback>
              </Avatar>
              {displayFrame && displayFrame !== "default" && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center"
                >
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </motion.div>
              )}
            </div>
            <p className="mt-3 text-sm text-white/60">
              {displayFrameData?.name || "Default"}
            </p>
          </div>

          {/* Frame grid */}
          <div className="grid grid-cols-3 gap-3">
            {frames.map((frame) => {
              const unlocked = isFrameUnlocked(frame);
              const unlockText = getUnlockText(frame);
              const isSelected = currentFrame === frame.slug;
              const isLoading = selecting === frame.slug;

              return (
                <motion.button
                  key={frame.slug}
                  whileHover={unlocked ? { scale: 1.05 } : undefined}
                  whileTap={unlocked ? { scale: 0.95 } : undefined}
                  onClick={() => unlocked && handleSelect(frame.slug)}
                  onMouseEnter={() => unlocked && setPreviewFrame(frame.slug)}
                  onMouseLeave={() => setPreviewFrame(null)}
                  disabled={!unlocked || isLoading}
                  className={cn(
                    "relative p-3 rounded-xl border transition-all",
                    unlocked
                      ? isSelected
                        ? "border-primary bg-primary/10"
                        : "border-white/20 hover:border-white/40 bg-white/5"
                      : "border-white/10 bg-white/[0.02] opacity-60 cursor-not-allowed"
                  )}
                >
                  {/* Frame preview */}
                  <div className="flex justify-center mb-2">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full bg-white/10",
                        frame.css_class
                      )}
                    />
                  </div>

                  {/* Frame name */}
                  <p
                    className={cn(
                      "text-xs font-medium truncate",
                      unlocked ? "text-white" : "text-white/50"
                    )}
                  >
                    {frame.name}
                  </p>

                  {/* Selected indicator */}
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                    >
                      <Check className="w-3 h-3 text-white" />
                    </motion.div>
                  )}

                  {/* Lock overlay */}
                  {!unlocked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl">
                      {frame.is_pro_only && !isPro ? (
                        <Crown className="w-4 h-4 text-accent mb-1" />
                      ) : frame.unlock_condition?.startsWith("achievement:") ? (
                        <Trophy className="w-4 h-4 text-yellow-400 mb-1" />
                      ) : (
                        <Lock className="w-4 h-4 text-white/40 mb-1" />
                      )}
                      <span className="text-[10px] text-white/50 text-center px-1">
                        {unlockText}
                      </span>
                    </div>
                  )}

                  {/* Loading state */}
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Pro upsell */}
          {!isPro && (
            <div className="mt-6 p-4 rounded-xl bg-accent/10 border border-accent/30">
              <div className="flex items-center gap-3">
                <Crown className="w-8 h-8 text-accent flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white">
                    Unlock more frames with Pro
                  </p>
                  <p className="text-xs text-white/60">
                    Pro members get access to exclusive profile frames
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto border-accent/30 text-accent hover:bg-accent/10"
                  asChild
                >
                  <a href="/pricing">Upgrade</a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Avatar with frame applied
interface FramedAvatarProps {
  src?: string | null;
  name?: string | null;
  frameSlug?: string | null;
  frames: ProfileFrame[];
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function FramedAvatar({
  src,
  name,
  frameSlug,
  frames,
  size = "md",
  className,
}: FramedAvatarProps) {
  const frame = frames.find((f) => f.slug === frameSlug);
  const frameClass = frame?.css_class || "ring-2 ring-white/20";

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-16 h-16",
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Avatar className={cn(sizeClasses[size], frameClass, className)}>
      <AvatarImage src={src || undefined} />
      <AvatarFallback className="bg-primary/20 text-primary">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
