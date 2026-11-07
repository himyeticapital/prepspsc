"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarWithNote } from "@/components/ui/avatar-with-note";
import { useRoomStore, PresenceWithProfile } from "@/stores/room-store";
import { useAuthStore } from "@/stores/auth-store";
import { useStatusNoteStore } from "@/stores/status-note-store";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ProfileFrame } from "@/types/database.types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Users, BookOpen, Clock } from "lucide-react";

interface OnlinePresenceProps {
  roomId: number;
  compact?: boolean;
  maxAvatars?: number;
}

const statusConfig = {
  online: {
    color: "bg-green-500",
    label: "Online",
    icon: Users,
  },
  away: {
    color: "bg-yellow-500",
    label: "Away",
    icon: Clock,
  },
  studying: {
    color: "bg-primary",
    label: "Studying",
    icon: BookOpen,
  },
};

export function OnlinePresence({
  roomId,
  compact = false,
  maxAvatars = 5,
}: OnlinePresenceProps) {
  const { user } = useAuthStore();
  const [profileFrames, setProfileFrames] = useState<ProfileFrame[]>([]);
  const supabase = useMemo(() => createClient(), []);

  const getFrameClass = (frameSlug?: string | null) => {
    if (!frameSlug || profileFrames.length === 0) return "border-2 border-zinc-900";
    const frame = profileFrames.find((f) => f.slug === frameSlug);
    return frame?.css_class || "border-2 border-zinc-900";
  };

  useEffect(() => {
    const fetchFrames = async () => {
      const { data } = await supabase
        .from("profile_frames")
        .select("*")
        .order("sort_order", { ascending: true });
      if (data) setProfileFrames(data);
    };
    fetchFrames();
  }, [supabase]);

  const {
    presenceByRoom,
    onlineCountByRoom,
    fetchRoomPresence,
    joinRoom,
    leaveRoom,
    setCurrentRoom,
    subscribeToRealtime,
  } = useRoomStore();
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeCleanupRef = useRef<(() => void) | null>(null);

  const presence = presenceByRoom[roomId] || [];
  const onlineCount = onlineCountByRoom[roomId] || presence.length;
  const { fetchNotesForUsers } = useStatusNoteStore();

  // Fetch status notes for present users
  useEffect(() => {
    if (presence.length > 0) {
      fetchNotesForUsers(presence.map((p) => p.user_id));
    }
  }, [presence, fetchNotesForUsers]);

  // Join room on mount, leave on unmount
  useEffect(() => {
    if (user) {
      // Set current room for realtime updates
      setCurrentRoom(roomId);

      // Subscribe to real-time presence updates
      realtimeCleanupRef.current = subscribeToRealtime(user.id);

      // Join room presence and then fetch (await to avoid race condition)
      const initPresence = async () => {
        await joinRoom(user.id, roomId, "online");
        await fetchRoomPresence(roomId);
      };
      initPresence();

      // Heartbeat to keep presence alive (every 2 minutes)
      heartbeatRef.current = setInterval(() => {
        joinRoom(user.id, roomId, "online");
      }, 2 * 60 * 1000);

      return () => {
        // Leave room on unmount
        leaveRoom(user.id, roomId);
        setCurrentRoom(null);
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
        }
        if (realtimeCleanupRef.current) {
          realtimeCleanupRef.current();
        }
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, roomId]);

  // NOTE: Removed 30-second polling - real-time subscriptions handle presence updates
  // The heartbeat (every 2 minutes) is sufficient to keep presence alive

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 text-white/60 text-xs">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <Users className="w-3 h-3" />
        <span>{onlineCount}</span>
      </div>
    );
  }

  const displayedUsers = presence.slice(0, maxAvatars);
  const remainingCount = Math.max(0, onlineCount - maxAvatars);

  return (
    <div className="widget-glass p-4 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Online Now
        </h3>
        <span className="text-xs text-white/50">{onlineCount} active</span>
      </div>

      {presence.length === 0 ? (
        <p className="text-xs text-white/40 text-center py-2">
          No one else is here yet
        </p>
      ) : (
        <TooltipProvider>
          <div className="flex items-center">
            <AnimatePresence mode="popLayout">
              {displayedUsers.map((p, index) => (
                <motion.div
                  key={p.user_id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  style={{ marginLeft: index > 0 ? -8 : 0 }}
                  className="relative"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative">
                        <AvatarWithNote
                          userId={p.user_id}
                          avatarUrl={p.profile?.avatar_url}
                          fallback={(p.profile?.username || p.profile?.full_name || "U").slice(0, 2).toUpperCase()}
                          profileFrame={getFrameClass(p.profile?.profile_frame)}
                          size="sm"
                        />
                        <span
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900",
                            statusConfig[p.status].color
                          )}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="widget-glass border-white/10"
                    >
                      <div className="text-xs">
                        <p className="font-medium text-white">
                          {p.profile?.username || p.profile?.full_name || "Anonymous"}
                        </p>
                        <p className="text-white/50 flex items-center gap-1">
                          {(() => {
                            const Icon = statusConfig[p.status].icon;
                            return <Icon className="w-3 h-3" />;
                          })()}
                          {statusConfig[p.status].label}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              ))}
            </AnimatePresence>

            {remainingCount > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-8 h-8 rounded-full bg-white/10 border-2 border-zinc-900 flex items-center justify-center -ml-2"
              >
                <span className="text-[10px] text-white/60">+{remainingCount}</span>
              </motion.div>
            )}
          </div>
        </TooltipProvider>
      )}

      {/* Status Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5">
        {Object.entries(statusConfig).map(([status, config]) => {
          const count = presence.filter((p) => p.status === status).length;
          if (count === 0) return null;

          return (
            <div key={status} className="flex items-center gap-1.5 text-xs text-white/40">
              <span className={cn("w-2 h-2 rounded-full", config.color)} />
              <span>{count} {config.label.toLowerCase()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
