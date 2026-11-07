"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Trophy, Medal, Loader2, Code2 } from "lucide-react";
import { isBuilder } from "@/lib/builder";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarWithNote } from "@/components/ui/avatar-with-note";
import { ProBadge } from "@/components/ui/pro-badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatMinutes, getInitials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { useStatusNoteStore } from "@/stores/status-note-store";
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
  trial_ends_at: string | null;
}

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Trophy className="w-4 h-4 text-yellow-500" />;
  if (rank === 2) return <Medal className="w-4 h-4 text-gray-400" />;
  if (rank === 3) return <Medal className="w-4 h-4 text-amber-600" />;
  return <span className="text-xs text-white/40 w-4 text-center">{rank}</span>;
};

export function LeaderboardWidget() {
  const { user } = useAuthStore();
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [profileFrames, setProfileFrames] = useState<ProfileFrame[]>([]);
  const supabase = useMemo(() => createClient(), []);
  const { fetchNotesForUsers } = useStatusNoteStore();

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

  useEffect(() => {
    let isCancelled = false;

    const fetchLeaderboard = async () => {
      try {
        // Get date range for this week (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split("T")[0];

        // Fetch study logs for this week grouped by user
        const { data: studyData, error: studyError } = await supabase
          .from("daily_study_logs")
          .select("user_id, minutes_studied")
          .gte("study_date", weekAgoStr);

        if (isCancelled) return;

        if (studyError) {
          if (studyError.message?.includes("aborted") || studyError.message?.includes("AbortError")) {
            return;
          }
          console.error("Leaderboard study logs fetch error:", studyError.message);
        }

        // Aggregate minutes by user
        const userMinutes: Record<string, number> = {};
        studyData?.forEach((log) => {
          userMinutes[log.user_id] = (userMinutes[log.user_id] || 0) + log.minutes_studied;
        });

        // Get user IDs with study time
        const userIds = Object.keys(userMinutes);

        if (userIds.length === 0) {
          setLeaderboard([]);
          setIsLoading(false);
          return;
        }

        // Fetch profiles for these users
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url, profile_frame, current_streak, is_pro_member, trial_ends_at")
          .in("id", userIds);

        if (isCancelled) return;

        if (profilesError) {
          if (profilesError.message?.includes("aborted") || profilesError.message?.includes("AbortError")) {
            return;
          }
          console.error("Leaderboard profiles fetch error:", profilesError.message);
        }

        // Combine data and sort by minutes
        const leaderboardData: LeaderboardUser[] = (profiles || [])
          .map((profile) => ({
            id: profile.id,
            username: profile.username,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            profile_frame: profile.profile_frame || null,
            total_minutes: userMinutes[profile.id] || 0,
            current_streak: profile.current_streak || 0,
            is_pro_member: profile.is_pro_member || false,
            trial_ends_at: profile.trial_ends_at || null,
          }))
          .sort((a, b) => b.total_minutes - a.total_minutes)
          .slice(0, 10); // Top 10

        setLeaderboard(leaderboardData);

        // Fetch status notes for leaderboard users
        if (leaderboardData.length > 0) {
          fetchNotesForUsers(leaderboardData.map((u) => u.id));
        }

        // Find current user's rank
        if (user) {
          const allSorted = (profiles || [])
            .map((profile) => ({
              id: profile.id,
              total_minutes: userMinutes[profile.id] || 0,
            }))
            .sort((a, b) => b.total_minutes - a.total_minutes);

          const rank = allSorted.findIndex((u) => u.id === user.id);
          setUserRank(rank >= 0 ? rank + 1 : null);
        }
      } catch (err: any) {
        if (isCancelled) return;
        if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
          return;
        }
        console.error("Error fetching leaderboard:", err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchLeaderboard();

    return () => {
      isCancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[350px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[350px] text-center p-4">
        <Trophy className="w-10 h-10 text-white/20 mb-3" />
        <p className="text-sm text-white/50">No study activity this week</p>
        <p className="text-xs text-white/30 mt-1">Start studying to appear on the leaderboard!</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[350px]">
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/50">Top Aspirants This Week</p>
          <Link href="/leaderboard" className="text-xs text-primary hover:underline">
            View All
          </Link>
        </div>

        {/* Leaderboard List */}
        <div className="space-y-2">
          {leaderboard.map((leaderboardUser, index) => {
            const rank = index + 1;
            const isCurrentUser = leaderboardUser.id === user?.id;

            return (
              <div
                key={leaderboardUser.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-xl transition-colors",
                  rank <= 3 ? "bg-white/5" : "bg-transparent",
                  isCurrentUser && "ring-1 ring-primary/50 bg-primary/10"
                )}
              >
                {/* Rank */}
                <div className="w-6 flex justify-center">{getRankIcon(rank)}</div>

                {/* Avatar */}
                <AvatarWithNote
                  userId={leaderboardUser.id}
                  avatarUrl={leaderboardUser.avatar_url}
                  fallback={getInitials(leaderboardUser.full_name || leaderboardUser.username)}
                  profileFrame={getFrameClass(leaderboardUser.profile_frame)}
                  size="sm"
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-white truncate">
                      {leaderboardUser.full_name || leaderboardUser.username || "Anonymous"}
                    </span>
                    <ProBadge isProMember={leaderboardUser.is_pro_member} trialEndsAt={leaderboardUser.trial_ends_at} size="xs" />
                    {isBuilder(leaderboardUser.username) && (
                      <span title="App Builder">
                        <Code2 className="w-3 h-3 text-cyan-400" />
                      </span>
                    )}
                    {isCurrentUser && (
                      <span className="text-[10px] text-primary">(You)</span>
                    )}
                  </div>
                  <p className="text-xs text-white/40">
                    {formatMinutes(leaderboardUser.total_minutes)} • {leaderboardUser.current_streak}🔥
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Your Rank (if not in top list) */}
        {userRank && userRank > leaderboard.length && (
          <div className="pt-2 border-t border-white/10">
            <p className="text-xs text-white/40 text-center">
              You&apos;re ranked <span className="text-primary">#{userRank}</span> this week!
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
