"use client";

import { motion } from "framer-motion";
import { Play, Pause, SkipForward, Maximize2 } from "lucide-react";
import { useWidgetStore } from "@/stores/widget-store";
import { LOFI_STREAMS } from "@/types/widget.types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MusicMiniPlayer() {
  const {
    isMusicPlaying,
    isMusicMinimized,
    currentStreamIndex,
    toggleMusic,
    nextStream,
    maximizeMusic,
  } = useWidgetStore();

  const currentStream = LOFI_STREAMS[currentStreamIndex];

  if (!isMusicMinimized) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className="fixed bottom-6 left-24 z-40 pointer-events-auto"
    >
      <div className="widget-glass rounded-full px-4 py-2 flex items-center gap-3 shadow-2xl border border-white/10">
        {/* Equalizer Animation */}
        <div className="flex items-end gap-0.5 h-4 w-6">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-1.5 bg-primary rounded-full transition-all duration-150",
                isMusicPlaying ? "animate-pulse" : "h-1"
              )}
              style={{
                height: isMusicPlaying ? `${8 + Math.random() * 8}px` : "4px",
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>

        {/* Stream Name */}
        <div className="flex flex-col min-w-[80px]">
          <span className="text-xs font-medium text-white truncate">
            {currentStream.name}
          </span>
          <span className="text-[10px] text-white/50">Lofi Radio</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMusic}
            className={cn(
              "w-8 h-8 rounded-full",
              isMusicPlaying
                ? "bg-primary/20 text-primary hover:bg-primary/30"
                : "text-white/60 hover:text-white hover:bg-white/10"
            )}
          >
            {isMusicPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={nextStream}
            className="w-8 h-8 rounded-full text-white/60 hover:text-white hover:bg-white/10"
          >
            <SkipForward className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={maximizeMusic}
            className="w-8 h-8 rounded-full text-white/60 hover:text-white hover:bg-white/10"
            title="Expand player"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
