"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Profile, DailyStudyLog, ProfileFrame } from "@/types/database.types";
import {
  X,
  Clock,
  Flame,
  Trophy,
  Crown,
  Calendar,
  BookOpen,
  Target,
  TrendingUp,
  MessageCircle,
  UserPlus,
  ExternalLink,
  Code2,
} from "lucide-react";
import { isBuilder } from "@/lib/builder";

interface UserProfileModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onStartChat?: (userId: string) => void;
}

interface UserStats {
  profile: Profile | null;
  totalTests: number;
  avgScore: number;
  weeklyMinutes: number;
  studyLogs: DailyStudyLog[];
}

export function UserProfileModal({
  userId,
  isOpen,
  onClose,
  onStartChat,
}: UserProfileModalProps) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileFrames, setProfileFrames] = useState<ProfileFrame[]>([]);

  const getFrameClass = (frameSlug?: string | null) => {
    if (!frameSlug || profileFrames.length === 0) return "border-4 border-zinc-900";
    const frame = profileFrames.find((f) => f.slug === frameSlug);
    return frame?.css_class || "border-4 border-zinc-900";
  };

  useEffect(() => {
    const fetchFrames = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("profile_frames")
        .select("*")
        .order("sort_order", { ascending: true });
      if (data) setProfileFrames(data);
    };
    fetchFrames();
  }, []);

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserStats();
    }
  }, [isOpen, userId]);

  const fetchUserStats = async () => {
    setIsLoading(true);

    const supabase = createClient();

    try {
      // Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      // Fetch test attempts for stats
      const { data: attempts } = await supabase
        .from("test_attempts")
        .select("score, total_marks")
        .eq("user_id", userId)
        .eq("status", "completed");

      // Calculate average score
      let avgScore = 0;
      if (attempts && attempts.length > 0) {
        const totalPercent = attempts.reduce((sum, a) => {
          if (a.score && a.total_marks) {
            return sum + (a.score / a.total_marks) * 100;
          }
          return sum;
        }, 0);
        avgScore = Math.round(totalPercent / attempts.length);
      }

      // Fetch study logs for last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: studyLogs } = await supabase
        .from("daily_study_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("study_date", sevenDaysAgo.toISOString().split("T")[0])
        .order("study_date", { ascending: false });

      // Calculate weekly minutes
      const weeklyMinutes = studyLogs?.reduce((sum, log) => sum + log.minutes_studied, 0) || 0;

      setStats({
        profile,
        totalTests: attempts?.length || 0,
        avgScore,
        weeklyMinutes,
        studyLogs: studyLogs || [],
      });
    } catch (error) {
      console.error("Error fetching user stats:", error);
    }

    setIsLoading(false);
  };

  const formatStudyTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
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

  const getRankBadge = (minutes: number) => {
    if (minutes >= 10000) return { label: "Master", color: "text-purple-400", bg: "bg-purple-500/20" };
    if (minutes >= 5000) return { label: "Expert", color: "text-orange-400", bg: "bg-orange-500/20" };
    if (minutes >= 1000) return { label: "Dedicated", color: "text-blue-400", bg: "bg-blue-500/20" };
    if (minutes >= 100) return { label: "Active", color: "text-green-400", bg: "bg-green-500/20" };
    return { label: "Beginner", color: "text-white/60", bg: "bg-white/10" };
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="widget-glass rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="relative h-24 bg-gradient-to-br from-primary/30 to-primary/10">
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Profile Content */}
              <div className="px-6 pb-6">
                {/* Avatar - positioned to overlap header */}
                <div className="-mt-12 mb-4 flex justify-center">
                  <Avatar className={cn("w-24 h-24", getFrameClass(stats?.profile?.profile_frame))}>
                    <AvatarImage src={stats?.profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-2xl bg-primary/20 text-primary">
                      {getInitials(stats?.profile?.full_name || stats?.profile?.username)}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {isLoading ? (
                  <div className="flex flex-col items-center py-8">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-white/50 mt-3">Loading profile...</p>
                  </div>
                ) : stats?.profile ? (
                  <>
                    {/* Name & Username */}
                    <div className="text-center mb-4">
                      <div className="flex items-center justify-center gap-2">
                        <h2 className="text-xl font-bold text-white">
                          {stats.profile.full_name || stats.profile.username || "Anonymous"}
                        </h2>
                        {stats.profile.is_pro_member && (
                          <Crown className="w-5 h-5 text-orange-400" />
                        )}
                        {isBuilder(stats.profile.username) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-primary/20 to-cyan-500/20 border border-cyan-500/30 text-xs text-cyan-400 font-medium">
                            <Code2 className="w-3.5 h-3.5" />
                            Builder
                          </span>
                        )}
                      </div>
                      {stats.profile.username && stats.profile.full_name && (
                        <p className="text-sm text-white/50">@{stats.profile.username}</p>
                      )}
                      {stats.profile.bio && (
                        <p className="text-sm text-white/60 mt-2">{stats.profile.bio}</p>
                      )}

                      {/* Rank Badge */}
                      {(() => {
                        const rank = getRankBadge(stats.profile.total_minutes_all_time);
                        return (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs mt-2",
                              rank.bg,
                              rank.color
                            )}
                          >
                            <Trophy className="w-3 h-3" />
                            {rank.label}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <StatCard
                        icon={Clock}
                        label="Total Study Time"
                        value={formatStudyTime(stats.profile.total_minutes_all_time)}
                        color="text-primary"
                      />
                      <StatCard
                        icon={Flame}
                        label="Current Streak"
                        value={`${stats.profile.current_streak} days`}
                        color="text-orange-400"
                      />
                      <StatCard
                        icon={BookOpen}
                        label="Tests Completed"
                        value={stats.totalTests.toString()}
                        color="text-blue-400"
                      />
                      <StatCard
                        icon={Target}
                        label="Avg Score"
                        value={stats.avgScore > 0 ? `${stats.avgScore}%` : "N/A"}
                        color="text-green-400"
                      />
                    </div>

                    {/* Weekly Activity */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-white flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-primary" />
                          This Week
                        </h3>
                        <span className="text-xs text-white/50">
                          {formatStudyTime(stats.weeklyMinutes)} studied
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {[...Array(7)].map((_, i) => {
                          const date = new Date();
                          date.setDate(date.getDate() - (6 - i));
                          const dateStr = date.toISOString().split("T")[0];
                          const log = stats.studyLogs.find((l) => l.study_date === dateStr);
                          const minutes = log?.minutes_studied || 0;
                          const intensity = minutes === 0 ? 0 : minutes < 30 ? 1 : minutes < 60 ? 2 : minutes < 120 ? 3 : 4;

                          return (
                            <div
                              key={i}
                              className={cn(
                                "flex-1 h-8 rounded",
                                intensity === 0 && "bg-white/5",
                                intensity === 1 && "bg-primary/20",
                                intensity === 2 && "bg-primary/40",
                                intensity === 3 && "bg-primary/60",
                                intensity === 4 && "bg-primary/80"
                              )}
                              title={`${date.toLocaleDateString("en-US", { weekday: "short" })}: ${minutes}m`}
                            />
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-white/30">Mon</span>
                        <span className="text-[10px] text-white/30">Sun</span>
                      </div>
                    </div>

                    {/* Member Since */}
                    <div className="flex items-center justify-center gap-1.5 text-xs text-white/40 mb-4">
                      <Calendar className="w-3.5 h-3.5" />
                      Member since {new Date(stats.profile.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {onStartChat && (
                        <Button
                          onClick={() => onStartChat(userId)}
                          className="flex-1 bg-primary hover:bg-primary/90"
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          Message
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10"
                      >
                        Close
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-white/50">User not found</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  return (
    <div className="bg-white/5 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("w-4 h-4", color)} />
        <span className="text-[10px] text-white/50 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
