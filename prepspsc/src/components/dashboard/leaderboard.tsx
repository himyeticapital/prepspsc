"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, formatMinutes, getInitials } from "@/lib/utils";
import { Crown, Medal, Trophy, Flame, Code2 } from "lucide-react";
import { isBuilder } from "@/lib/builder";
import { createClient } from "@/lib/supabase/client";
import type { Profile, ProfileFrame } from "@/types/database.types";

interface LeaderboardProps {
  users: Profile[];
  currentUserId?: string;
}

export function Leaderboard({ users, currentUserId }: LeaderboardProps) {
  const [profileFrames, setProfileFrames] = useState<ProfileFrame[]>([]);
  const supabase = useMemo(() => createClient(), []);

  const getFrameClass = (frameSlug?: string | null) => {
    if (!frameSlug || profileFrames.length === 0) return "border border-white/10";
    const frame = profileFrames.find((f) => f.slug === frameSlug);
    return frame?.css_class || "border border-white/10";
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

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="text-white/40 w-5 text-center text-sm">{rank}</span>;
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-yellow-500/10 border-yellow-500/20";
      case 2:
        return "bg-gray-400/10 border-gray-400/20";
      case 3:
        return "bg-amber-600/10 border-amber-600/20";
      default:
        return "bg-white/5 border-white/5";
    }
  };

  if (users.length === 0) {
    return (
      <div className="text-center py-8">
        <Trophy className="w-10 h-10 text-white/20 mx-auto mb-3" />
        <p className="text-white/50 text-sm">No users on the leaderboard yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {users.map((user, index) => {
        const rank = index + 1;
        const isCurrentUser = user.id === currentUserId;

        return (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-all border",
              getRankBg(rank),
              isCurrentUser && "ring-1 ring-primary/50 bg-primary/10 border-primary/20"
            )}
          >
            <div className="w-8 flex justify-center">
              {getRankIcon(rank)}
            </div>

            <Avatar className={cn("h-9 w-9", getFrameClass(user.profile_frame))}>
              <AvatarImage src={user.avatar_url || ""} />
              <AvatarFallback className="bg-white/10 text-white text-xs">
                {getInitials(user.full_name || user.username)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-white truncate text-sm">
                  {user.full_name || user.username || "Anonymous"}
                </p>
                {user.is_pro_member && (
                  <Crown className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                )}
                {isBuilder(user.username) && (
                  <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-gradient-to-r from-primary/20 to-cyan-500/20 border border-cyan-500/30 flex-shrink-0" title="App Builder">
                    <Code2 className="w-2.5 h-2.5 text-cyan-400" />
                  </span>
                )}
                {isCurrentUser && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                    You
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-white/40">
                <Flame className="w-3 h-3 text-orange-400" />
                {user.current_streak} day streak
              </div>
            </div>

            <div className="text-right">
              <p className="font-semibold text-primary text-sm">
                {formatMinutes(user.total_minutes_all_time)}
              </p>
              <p className="text-[10px] text-white/40">study time</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
