"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, formatTime } from "@/lib/utils";
import {
  Trophy,
  Medal,
  Crown,
  Clock,
  Loader2,
  Users,
} from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  score: number;
  totalMarks: number;
  percentage: number;
  timeTaken: number;
  attemptedAt: string;
}

interface LeaderboardProps {
  testId: number;
  totalMarks: number;
  currentUserId?: string;
}

type TimeFilter = "all" | "week" | "today";

export function Leaderboard({ testId, totalMarks, currentUserId }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      const supabase = createClient();

      // Build date filter
      let dateFilter = "";
      const now = new Date();
      if (timeFilter === "today") {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateFilter = today.toISOString();
      } else if (timeFilter === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = weekAgo.toISOString();
      }

      // Fetch top attempts (best score per user)
      let query = supabase
        .from("test_attempts")
        .select(`
          id,
          user_id,
          score,
          total_marks,
          time_taken_seconds,
          completed_at,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .eq("test_id", testId)
        .eq("status", "completed")
        .not("score", "is", null)
        .order("score", { ascending: false })
        .order("time_taken_seconds", { ascending: true });

      if (dateFilter) {
        query = query.gte("completed_at", dateFilter);
      }

      const { data, error } = await query.limit(50);

      if (error) {
        console.error("Failed to fetch leaderboard:", error);
        setLoading(false);
        return;
      }

      // Group by user and get best score
      const userBestScores = new Map<string, typeof data[0]>();
      for (const attempt of data || []) {
        const existing = userBestScores.get(attempt.user_id);
        if (!existing || (attempt.score || 0) > (existing.score || 0)) {
          userBestScores.set(attempt.user_id, attempt);
        }
      }

      // Convert to leaderboard entries
      const leaderboardEntries: LeaderboardEntry[] = Array.from(userBestScores.values())
        .sort((a, b) => {
          // Sort by score descending, then time ascending
          if ((b.score || 0) !== (a.score || 0)) {
            return (b.score || 0) - (a.score || 0);
          }
          return (a.time_taken_seconds || 0) - (b.time_taken_seconds || 0);
        })
        .slice(0, 10)
        .map((attempt, index) => {
          const profileData = attempt.profiles as unknown;
          const profile = Array.isArray(profileData) ? profileData[0] : profileData;
          const profileTyped = profile as { username: string; avatar_url: string | null } | null;
          const score = attempt.score || 0;
          const marks = attempt.total_marks || totalMarks;
          return {
            rank: index + 1,
            userId: attempt.user_id,
            username: profileTyped?.username || "Anonymous",
            avatarUrl: profileTyped?.avatar_url || null,
            score,
            totalMarks: marks,
            percentage: marks > 0 ? Math.round((score / marks) * 100) : 0,
            timeTaken: attempt.time_taken_seconds || 0,
            attemptedAt: attempt.completed_at || "",
          };
        });

      setEntries(leaderboardEntries);

      // Find current user's rank if not in top 10
      if (currentUserId) {
        const userEntry = leaderboardEntries.find((e) => e.userId === currentUserId);
        if (userEntry) {
          setUserRank(userEntry);
        } else {
          // Fetch user's best attempt
          const { data: userAttempts } = await supabase
            .from("test_attempts")
            .select(`
              id,
              user_id,
              score,
              total_marks,
              time_taken_seconds,
              completed_at,
              profiles:user_id (
                username,
                avatar_url
              )
            `)
            .eq("test_id", testId)
            .eq("user_id", currentUserId)
            .eq("status", "completed")
            .not("score", "is", null)
            .order("score", { ascending: false })
            .limit(1);

          if (userAttempts && userAttempts.length > 0) {
            const userBest = userAttempts[0];
            const userProfileData = userBest.profiles as unknown;
            const userProfile = Array.isArray(userProfileData) ? userProfileData[0] : userProfileData;
            const profile = userProfile as { username: string; avatar_url: string | null } | null;
            const score = userBest.score || 0;
            const marks = userBest.total_marks || totalMarks;

            // Count how many users scored higher
            const { count } = await supabase
              .from("test_attempts")
              .select("*", { count: "exact", head: true })
              .eq("test_id", testId)
              .eq("status", "completed")
              .gt("score", score);

            setUserRank({
              rank: (count || 0) + 1,
              userId: userBest.user_id,
              username: profile?.username || "You",
              avatarUrl: profile?.avatar_url || null,
              score,
              totalMarks: marks,
              percentage: marks > 0 ? Math.round((score / marks) * 100) : 0,
              timeTaken: userBest.time_taken_seconds || 0,
              attemptedAt: userBest.completed_at || "",
            });
          }
        }
      }

      setLoading(false);
    };

    fetchLeaderboard();
  }, [testId, totalMarks, currentUserId, timeFilter]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-muted-foreground font-medium">{rank}</span>;
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-yellow-500/10 border-yellow-500/30";
      case 2:
        return "bg-gray-400/10 border-gray-400/30";
      case 3:
        return "bg-amber-600/10 border-amber-600/30";
      default:
        return "bg-secondary/50 border-border";
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="glass-card p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Leaderboard</h3>
        </div>

        {/* Time Filter */}
        <div className="flex gap-1">
          {(["all", "week", "today"] as TimeFilter[]).map((filter) => (
            <Button
              key={filter}
              variant={timeFilter === filter ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setTimeFilter(filter)}
            >
              {filter === "all" ? "All Time" : filter === "week" ? "This Week" : "Today"}
            </Button>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No attempts yet{timeFilter !== "all" ? " in this time period" : ""}.</p>
          <p className="text-sm">Be the first to complete this test!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => {
            const isCurrentUser = entry.userId === currentUserId;

            return (
              <motion.div
                key={entry.userId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  getRankBg(entry.rank),
                  isCurrentUser && "ring-2 ring-primary"
                )}
              >
                {/* Rank */}
                <div className="w-8 flex items-center justify-center">
                  {getRankIcon(entry.rank)}
                </div>

                {/* Avatar & Name */}
                <Avatar className="h-8 w-8">
                  <AvatarImage src={entry.avatarUrl || undefined} alt={entry.username} />
                  <AvatarFallback className="text-xs">
                    {entry.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "font-medium truncate",
                    isCurrentUser && "text-primary"
                  )}>
                    {entry.username}
                    {isCurrentUser && <span className="ml-1 text-xs opacity-70">(You)</span>}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatTime(entry.timeTaken)}
                  </div>
                </div>

                {/* Score */}
                <div className="text-right">
                  <p className="font-bold">{entry.score}/{entry.totalMarks}</p>
                  <Badge variant={entry.percentage >= 70 ? "default" : "secondary"} className="text-xs">
                    {entry.percentage}%
                  </Badge>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* User's rank if not in top 10 */}
      {userRank && userRank.rank > 10 && (
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Your Best Score</p>
          <div className={cn(
            "flex items-center gap-3 p-3 rounded-lg border",
            "bg-primary/10 border-primary/30 ring-2 ring-primary"
          )}>
            <div className="w-8 flex items-center justify-center font-medium">
              #{userRank.rank}
            </div>
            <Avatar className="h-8 w-8">
              <AvatarImage src={userRank.avatarUrl || undefined} alt={userRank.username} />
              <AvatarFallback className="text-xs">
                {userRank.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-primary truncate">{userRank.username}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {formatTime(userRank.timeTaken)}
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold">{userRank.score}/{userRank.totalMarks}</p>
              <Badge variant={userRank.percentage >= 70 ? "default" : "secondary"} className="text-xs">
                {userRank.percentage}%
              </Badge>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
