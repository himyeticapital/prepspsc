"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useStatusNoteStore } from "@/stores/status-note-store";
import { cn } from "@/lib/utils";
import { Play, Pause, X, ExternalLink } from "lucide-react";
import { getDeezerTrackUrl } from "@/lib/deezer";

interface MusicMiniPlayerProps {
  userId: string;
  songName: string;
  artist: string;
  previewUrl: string;
  albumArt?: string;
  deezerId?: number;
  onClose: () => void;
}

export function MusicMiniPlayer({
  userId,
  songName,
  artist,
  previewUrl,
  albumArt,
  deezerId,
  onClose,
}: MusicMiniPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(30);
  const [currentTime, setCurrentTime] = useState(0);

  const { playingUserId, setPlaying } = useStatusNoteStore();

  // Auto-pause when another user's music starts
  useEffect(() => {
    if (playingUserId && playingUserId !== userId && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [playingUserId, userId]);

  // Auto-play on mount
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const play = async () => {
      try {
        await audio.play();
        setIsPlaying(true);
        setPlaying(userId);
      } catch {
        // Autoplay blocked by browser
      }
    };

    play();

    return () => {
      audio.pause();
      if (playingUserId === userId) setPlaying(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    setProgress((audio.currentTime / audio.duration) * 100 || 0);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setPlaying(null);
  }, [setPlaying]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      setPlaying(null);
    } else {
      await audio.play();
      setIsPlaying(true);
      setPlaying(userId);
    }
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-20"
    >
      <div className="widget-glass rounded-xl p-3 min-w-[200px] max-w-[240px] border border-white/10 shadow-xl">
        <audio
          ref={audioRef}
          src={previewUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          preload="auto"
        />

        {/* Header with close */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {albumArt && (
              <img
                src={albumArt}
                alt=""
                className="w-8 h-8 rounded-md flex-shrink-0 object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white truncate">{songName}</p>
              <p className="text-[10px] text-white/50 truncate">{artist}</p>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-1 rounded-full hover:bg-white/10 text-white/40 hover:text-white/70 flex-shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 hover:bg-primary/80 transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 text-white" />
            ) : (
              <Play className="w-3.5 h-3.5 text-white ml-0.5" />
            )}
          </button>

          {/* Progress bar */}
          <div className="flex-1 flex items-center gap-1.5">
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[9px] text-white/40 w-7 text-right tabular-nums">
              {formatTime(currentTime)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
