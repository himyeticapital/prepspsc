"use client";

import { useState } from "react";
import { Play, Pause, SkipForward, Volume2, VolumeX, Minimize2 } from "lucide-react";
import { useWidgetStore } from "@/stores/widget-store";
import { LOFI_STREAMS } from "@/types/widget.types";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MusicWidget() {
  const {
    isMusicPlaying,
    currentStreamIndex,
    volume,
    toggleMusic,
    setVolume,
    nextStream,
    minimizeMusic,
  } = useWidgetStore();

  const [isMuted, setIsMuted] = useState(false);

  const currentStream = LOFI_STREAMS[currentStreamIndex];

  // Handle mute/unmute locally (volume is stored in provider)
  const handleMuteToggle = () => {
    if (isMuted) {
      // Unmute - restore volume
      setIsMuted(false);
    } else {
      // Mute
      setIsMuted(true);
      setVolume(0);
    }
  };

  const handleVolumeChange = (value: number) => {
    setIsMuted(false);
    setVolume(value);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Album Art / Visualizer */}
      <div className="relative aspect-square max-w-[200px] mx-auto rounded-2xl overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20">
        {/* Animated background */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30",
            isMusicPlaying && "animate-pulse"
          )}
        />

        {/* Equalizer visualization */}
        <div className="absolute inset-0 flex items-end justify-center gap-1 pb-8">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-3 bg-primary rounded-t-full transition-all duration-300",
                isMusicPlaying ? "animate-pulse" : "h-4"
              )}
              style={{
                height: isMusicPlaying ? `${20 + Math.random() * 60}%` : "16px",
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>

        {/* Stream name */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
          <p className="text-sm font-medium text-white text-center">
            {currentStream.name}
          </p>
          <p className="text-xs text-white/50 text-center">Lofi Radio</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleMuteToggle}
          className="text-white/60 hover:text-white hover:bg-white/10"
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </Button>

        <Button
          size="lg"
          onClick={toggleMusic}
          className={cn(
            "w-14 h-14 rounded-full",
            isMusicPlaying
              ? "bg-accent hover:bg-accent/90"
              : "bg-primary hover:bg-primary/90"
          )}
        >
          {isMusicPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6 ml-1" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={nextStream}
          className="text-white/60 hover:text-white hover:bg-white/10"
        >
          <SkipForward className="w-5 h-5" />
        </Button>
      </div>

      {/* Minimize Button */}
      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={minimizeMusic}
          className="text-white/50 hover:text-white hover:bg-white/10 gap-2"
        >
          <Minimize2 className="w-4 h-4" />
          <span className="text-xs">Minimize Player</span>
        </Button>
      </div>

      {/* Volume Slider */}
      <div className="flex items-center gap-3 px-4">
        <Volume2 className="w-4 h-4 text-white/40" />
        <Slider
          value={[volume]}
          onValueChange={([v]) => handleVolumeChange(v)}
          max={100}
          step={1}
          className="flex-1"
        />
        <span className="text-xs text-white/40 w-8">{volume}%</span>
      </div>

      {/* Stream Selector */}
      <div className="space-y-2">
        <p className="text-xs text-white/40">Stations</p>
        <div className="flex gap-2">
          {LOFI_STREAMS.map((stream, index) => (
            <button
              key={stream.id}
              onClick={() => {
                useWidgetStore.setState({ currentStreamIndex: index });
              }}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg text-xs transition-colors",
                currentStreamIndex === index
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              )}
            >
              {stream.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
