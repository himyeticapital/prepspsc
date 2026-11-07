"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MusicMiniPlayer } from "@/components/status-notes/music-mini-player";
import { useStatusNoteStore } from "@/stores/status-note-store";
import { cn } from "@/lib/utils";
import { MessageCircle } from "lucide-react";

interface AvatarWithNoteProps {
  userId: string;
  avatarUrl?: string | null;
  fallback?: string;
  profileFrame?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showNote?: boolean;
  onNoteClick?: () => void;
}

const sizeConfig = {
  sm: { avatar: "w-8 h-8", bubble: "max-w-[80px] text-[9px]", truncate: 20, marqueeWidth: "60px" },
  md: { avatar: "w-12 h-12", bubble: "max-w-[120px] text-[10px]", truncate: 30, marqueeWidth: "90px" },
  lg: { avatar: "w-24 h-24", bubble: "max-w-[160px] text-xs", truncate: 60, marqueeWidth: "130px" },
};

function MiniEqualizer() {
  return (
    <span className="inline-flex items-end gap-[2px] h-2.5 flex-shrink-0">
      <span className="equalizer-bar" style={{ height: "4px", width: "2px" }} />
      <span className="equalizer-bar" style={{ height: "4px", width: "2px" }} />
      <span className="equalizer-bar" style={{ height: "4px", width: "2px" }} />
    </span>
  );
}

export function AvatarWithNote({
  userId,
  avatarUrl,
  fallback = "?",
  profileFrame,
  size = "md",
  className,
  showNote = true,
  onNoteClick,
}: AvatarWithNoteProps) {
  const [showPlayer, setShowPlayer] = useState(false);
  const note = useStatusNoteStore((s) => s.getNoteForUser(userId));
  const config = sizeConfig[size];

  const handleBubbleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (note?.note_type === "music" && note.music_preview_url) {
      setShowPlayer((prev) => !prev);
    }
    onNoteClick?.();
  };

  const isMusic = note?.note_type === "music";

  const truncatedContent = note
    ? note.content.length > config.truncate
      ? note.content.slice(0, config.truncate) + "..."
      : note.content
    : "";

  return (
    <div className={cn("relative inline-flex flex-col items-center", className)}>
      {/* Note bubble above avatar */}
      <AnimatePresence>
        {showNote && note && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 4 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full z-10"
          >
            <button
              onClick={handleBubbleClick}
              className={cn(
                "px-1.5 py-0.5 rounded-full cursor-pointer overflow-hidden",
                "backdrop-blur-sm border transition-colors",
                config.bubble,
                isMusic
                  ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                  : "bg-white/10 text-white/80 border-white/10 hover:bg-white/15"
              )}
            >
              <span className="flex items-center gap-0.5 overflow-hidden">
                {isMusic ? (
                  <MiniEqualizer />
                ) : (
                  <MessageCircle className="w-2.5 h-2.5 flex-shrink-0" />
                )}
                {isMusic ? (
                  <span className="overflow-hidden whitespace-nowrap flex-1 min-w-0">
                    <span className="music-marquee">
                      <span>{note.content}{note.music_artist ? ` \u2022 ${note.music_artist}` : ""}</span>
                      <span aria-hidden="true">{note.content}{note.music_artist ? ` \u2022 ${note.music_artist}` : ""}</span>
                    </span>
                  </span>
                ) : (
                  <span className="truncate whitespace-nowrap">{truncatedContent}</span>
                )}
              </span>
            </button>
            {/* Small triangle pointer */}
            <div
              className={cn(
                "w-2 h-2 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2 border-b border-r",
                isMusic
                  ? "bg-primary/10 border-primary/20"
                  : "bg-white/10 border-white/10"
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar */}
      <div
        className={cn("relative", onNoteClick && "cursor-pointer group")}
        onClick={onNoteClick ? (e) => { e.stopPropagation(); onNoteClick(); } : undefined}
      >
        <Avatar className={cn(config.avatar, profileFrame || "border border-white/10")}>
          <AvatarImage src={avatarUrl || ""} />
          <AvatarFallback className="bg-white/10 text-white text-xs">
            {fallback}
          </AvatarFallback>
        </Avatar>
        {/* "+" indicator when no note exists and avatar is clickable */}
        {onNoteClick && !note && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-primary text-white text-[8px] font-bold flex items-center justify-center border border-zinc-900 group-hover:scale-110 transition-transform">
            +
          </span>
        )}
      </div>

      {/* Inline Music Mini-Player */}
      <AnimatePresence>
        {showPlayer && note?.note_type === "music" && note.music_preview_url && (
          <MusicMiniPlayer
            userId={userId}
            songName={note.content}
            artist={note.music_artist || "Unknown"}
            previewUrl={note.music_preview_url}
            albumArt={note.music_album_art || undefined}
            onClose={() => setShowPlayer(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
