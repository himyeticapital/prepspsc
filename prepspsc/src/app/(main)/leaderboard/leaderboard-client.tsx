"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Trophy, Medal, Crown, ArrowLeft, Flame, Clock, Zap, Code2 } from "lucide-react";
import { isBuilder } from "@/lib/builder";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatMinutes, getInitials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { ProfileFrame } from "@/types/database.types";

interface LeaderboardUser {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  profile_frame: string | null;
  total_minutes: number;
  current_streak: number;
  is_pro_member: boolean;
  xp_points: number;
}

interface LeaderboardClientProps {
  leaderboard: LeaderboardUser[];
  currentUserId: string;
  currentUserProfile: any;
  userRank: number | null;
}

const getRankDisplay = (rank: number) => {
  if (rank === 1) return { icon: <Trophy className="w-6 h-6 text-yellow-500" />, bg: "bg-yellow-500/10 border-yellow-500/30" };
  if (rank === 2) return { icon: <Medal className="w-6 h-6 text-gray-300" />, bg: "bg-gray-400/10 border-gray-400/30" };
  if (rank === 3) return { icon: <Medal className="w-6 h-6 text-amber-600" />, bg: "bg-amber-600/10 border-amber-600/30" };
  return { icon: <span className="text-lg font-bold text-white/60">{rank}</span>, bg: "bg-white/5 border-white/10" };
};

export function LeaderboardClient({
  leaderboard,
  currentUserId,
  currentUserProfile,
  userRank,
}: LeaderboardClientProps) {
  const [profileFrames, setProfileFrames] = useState<ProfileFrame[]>([]);
  const supabase = useMemo(() => createClient(), []);

  const getFrameClass = (frameSlug?: string | null) => {
    if (!frameSlug || profileFrames.length === 0) return "";
    const frame = profileFrames.find((f) => f.slug === frameSlug);
    return frame?.css_class || "";
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

  // Top 3 for podium
  const topThree = leaderboard.slice(0, 3);
  // Rest for list
  const restOfLeaderboard = leaderboard.slice(3);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Weekly Leaderboard</h1>
            <p className="text-white/50 text-sm">Top performers based on study time this week</p>
          </div>
        </div>

        {/* Your Rank Card */}
        {currentUserProfile && (
          <Card className="mb-8 bg-primary/10 border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className={cn("w-12 h-12", getFrameClass(currentUserProfile.profile_frame))}>
                    <AvatarImage src={currentUserProfile.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {getInitials(currentUserProfile.full_name || currentUserProfile.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-white">
                      {currentUserProfile.full_name || currentUserProfile.username || "You"}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-white/60">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatMinutes(leaderboard.find(u => u.id === currentUserId)?.total_minutes || 0)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-orange-500" />
                        {currentUserProfile.current_streak || 0} streak
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/50">Your Rank</p>
                  <p className="text-2xl font-bold text-primary">
                    {userRank ? `#${userRank}` : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {leaderboard.length === 0 ? (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-12 text-center">
              <Trophy className="w-16 h-16 mx-auto text-white/20 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No Activity Yet</h3>
              <p className="text-white/50 mb-4">
                No one has logged study time this week. Be the first!
              </p>
              <Link href="/dashboard">
                <Button>Start Studying</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Podium for Top 3 */}
            {topThree.length >= 3 && (
              <div className="grid grid-cols-3 gap-4 mb-8">
                {/* 2nd Place */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex flex-col items-center pt-8"
                >
                  <Avatar className={cn("w-16 h-16 mb-2 ring-2 ring-gray-400", getFrameClass(topThree[1].profile_frame))}>
                    <AvatarImage src={topThree[1].avatar_url || undefined} />
                    <AvatarFallback className="bg-gray-600 text-white">
                      {getInitials(topThree[1].full_name || topThree[1].username)}
                    </AvatarFallback>
                  </Avatar>
                  <Medal className="w-6 h-6 text-gray-300 mb-1" />
                  <div className="flex items-center gap-1 justify-center">
                    <p className="text-sm font-medium text-white text-center truncate max-w-full px-2">
                      {topThree[1].full_name || topThree[1].username || "Anonymous"}
                    </p>
                    {isBuilder(topThree[1].username) && <Code2 className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                  <p className="text-xs text-white/50">{formatMinutes(topThree[1].total_minutes)}</p>
                  <div className="w-full h-20 bg-gray-400/20 rounded-t-lg mt-2" />
                </motion.div>

                {/* 1st Place */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center"
                >
                  <Avatar className={cn("w-20 h-20 mb-2 ring-2 ring-yellow-500", getFrameClass(topThree[0].profile_frame))}>
                    <AvatarImage src={topThree[0].avatar_url || undefined} />
                    <AvatarFallback className="bg-yellow-600 text-white">
                      {getInitials(topThree[0].full_name || topThree[0].username)}
                    </AvatarFallback>
                  </Avatar>
                  <Trophy className="w-8 h-8 text-yellow-500 mb-1" />
                  <div className="flex items-center gap-1 justify-center">
                    <p className="text-sm font-medium text-white text-center truncate max-w-full px-2">
                      {topThree[0].full_name || topThree[0].username || "Anonymous"}
                    </p>
                    {isBuilder(topThree[0].username) && <Code2 className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                  <p className="text-xs text-white/50">{formatMinutes(topThree[0].total_minutes)}</p>
                  <div className="w-full h-28 bg-yellow-500/20 rounded-t-lg mt-2" />
                </motion.div>

                {/* 3rd Place */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-col items-center pt-12"
                >
                  <Avatar className={cn("w-14 h-14 mb-2 ring-2 ring-amber-600", getFrameClass(topThree[2].profile_frame))}>
                    <AvatarImage src={topThree[2].avatar_url || undefined} />
                    <AvatarFallback className="bg-amber-700 text-white">
                      {getInitials(topThree[2].full_name || topThree[2].username)}
                    </AvatarFallback>
                  </Avatar>
                  <Medal className="w-5 h-5 text-amber-600 mb-1" />
                  <div className="flex items-center gap-1 justify-center">
                    <p className="text-sm font-medium text-white text-center truncate max-w-full px-2">
                      {topThree[2].full_name || topThree[2].username || "Anonymous"}
                    </p>
                    {isBuilder(topThree[2].username) && <Code2 className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                  <p className="text-xs text-white/50">{formatMinutes(topThree[2].total_minutes)}</p>
                  <div className="w-full h-14 bg-amber-600/20 rounded-t-lg mt-2" />
                </motion.div>
              </div>
            )}

            {/* Rest of Leaderboard */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-white">Rankings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {leaderboard.map((user, index) => {
                  const rank = index + 1;
                  const isCurrentUser = user.id === currentUserId;
                  const { icon, bg } = getRankDisplay(rank);

                  return (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-xl border transition-colors",
                        bg,
                        isCurrentUser && "ring-1 ring-primary"
                      )}
                    >
                      {/* Rank */}
                      <div className="w-10 h-10 flex items-center justify-center">
                        {icon}
                      </div>

                      {/* Avatar */}
                      <Avatar className={cn("w-10 h-10", getFrameClass(user.profile_frame))}>
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="bg-white/10 text-white">
                          {getInitials(user.full_name || user.username)}
                        </AvatarFallback>
                      </Avatar>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white truncate">
                            {user.full_name || user.username || "Anonymous"}
                          </span>
                          {user.is_pro_member && <Crown className="w-4 h-4 text-accent flex-shrink-0" />}
                          {isBuilder(user.username) && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-primary/20 to-cyan-500/20 border border-cyan-500/30 text-[10px] text-cyan-400 font-medium flex-shrink-0">
                              <Code2 className="w-3 h-3" />
                              Builder
                            </span>
                          )}
                          {isCurrentUser && (
                            <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">(You)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/50">
                          <span className="flex items-center gap-1">
                            <Flame className="w-3 h-3 text-orange-500" />
                            {user.current_streak} day streak
                          </span>
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3 text-primary" />
                            {user.xp_points.toLocaleString()} XP
                          </span>
                        </div>
                      </div>

                      {/* Study Time */}
                      <div className="text-right">
                        <p className="font-semibold text-white">{formatMinutes(user.total_minutes)}</p>
                        <p className="text-xs text-white/40">this week</p>
                      </div>
                    </motion.div>
                  );
                })}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
