"use client";

import { hasProAccess, isAllFeaturesFree } from "@/lib/access";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  Mail,
  Clock,
  Flame,
  BookOpen,
  Bookmark,
  Crown,
  Settings,
  LogOut,
  Edit2,
  Calendar,
  Trophy,
  Target,
  Loader2,
  Sparkles,
  ChevronRight,
  FileText,
  XCircle,
  Shield,
  Zap,
  Palette,
  Lock,
  Code2,
  MessageCircle,
  Check,
  ExternalLink,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ActivityHeatmap } from "@/components/dashboard/activity-heatmap";
import { AvatarSelector } from "@/components/profile/avatar-selector";
import { XPBar } from "@/components/gamification/xp-bar";
import { AchievementsShowcase } from "@/components/gamification/achievements-grid";
import { ProfileFrameSelector, FramedAvatar } from "@/components/gamification/profile-frame-selector";
import { StreakShieldBadge } from "@/components/gamification/streak-shield-card";
import { AvatarWithNote } from "@/components/ui/avatar-with-note";
import { CreateStatusNote } from "@/components/status-notes/create-status-note";
import { ProBadgeOverlay } from "@/components/ui/pro-badge";
import { useStatusNoteStore } from "@/stores/status-note-store";
import { useAuthStore, getTrialStatus } from "@/stores/auth-store";
import { useWidgetStore } from "@/stores/widget-store";
import { formatMinutes, cn } from "@/lib/utils";
import { getProgressToNextLevel, getLevelTitle, formatXP } from "@/lib/xp";
import { isBuilder } from "@/lib/builder";
import { ExamSelector } from "@/components/ui/exam-selector";
import { getExamLabel } from "@/lib/exam-options";
import { FeedbackModal } from "@/components/feedback/feedback-modal";
import { FeedbackHistory } from "@/components/feedback/feedback-history";
import { FeedbackBox } from "@/components/feedback/feedback-box";
import type { Profile, DailyStudyLog, Achievement, ProfileFrame } from "@/types/database.types";

interface ProfileClientProps {
  profile: Profile | null;
  studyLogs: DailyStudyLog[];
  completedTests: number;
  totalBookmarks: number;
  userEmail: string;
  achievements?: Achievement[];
  unlockedAchievementIds?: number[];
  profileFrames?: ProfileFrame[];
}

export function ProfileClient({
  profile: initialProfile,
  studyLogs,
  completedTests,
  totalBookmarks,
  userEmail,
  achievements = [],
  unlockedAchievementIds = [],
  profileFrames = [],
}: ProfileClientProps) {
  const router = useRouter();
  const { signOut, updateProfile, user } = useAuthStore();
  const { openWidget } = useWidgetStore();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [showCreateNote, setShowCreateNote] = useState(false);
  const { fetchNotesForUsers } = useStatusNoteStore();
  const [telegramConnected, setTelegramConnected] = useState<boolean | null>(null);
  const [isCheckingTelegram, setIsCheckingTelegram] = useState(true);

  // Fetch status note for this user
  useEffect(() => {
    if (user?.id) {
      fetchNotesForUsers([user.id]);
    }
  }, [user?.id, fetchNotesForUsers]);

  // Check Telegram connection status
  useEffect(() => {
    if (user?.id) {
      fetch(`/api/bot/connection-status?userId=${user.id}`)
        .then((res) => res.json())
        .then((data) => {
          setTelegramConnected(data.connected ?? false);
          setIsCheckingTelegram(false);
        })
        .catch(() => {
          setTelegramConnected(false);
          setIsCheckingTelegram(false);
        });
    } else {
      setIsCheckingTelegram(false);
    }
  }, [user?.id]);

  // Local profile state (for preview mode and immediate UI updates)
  const [localProfile, setLocalProfile] = useState(initialProfile);
  const profile = localProfile;

  // XP and Level data
  const xp = profile?.xp_points ?? 0;
  const level = profile?.xp_level ?? 1;
  const isPro = hasProAccess(profile);
  const streakShields = profile?.streak_shields_remaining ?? 0;
  const xpProgress = getProgressToNextLevel(xp);

  // Edit form state
  const [editForm, setEditForm] = useState({
    full_name: profile?.full_name || "",
    username: profile?.username || "",
    bio: profile?.bio || "",
    avatar_url: profile?.avatar_url || "",
    preparing_for: profile?.preparing_for || [],
  });
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    router.push("/");
  };

  const handleOpenSettings = () => {
    openWidget("settings");
  };

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    try {
      const response = await fetch("/api/cancel-subscription", {
        method: "POST",
      });

      if (response.ok) {
        setLocalProfile((prev) =>
          prev ? { ...prev, pro_cancelled: true } : prev
        );
        toast.success("Subscription cancelled. You'll keep Pro access until your current period ends.");
        setShowCancelDialog(false);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to cancel subscription");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setUsernameError(null);

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (editForm.username && !usernameRegex.test(editForm.username)) {
      setUsernameError("Username can only contain letters, numbers, and underscores");
      setIsSaving(false);
      return;
    }

    // Try to save to database if user is authenticated
    if (user) {
      try {
        const success = await updateProfile({
          full_name: editForm.full_name,
          username: editForm.username,
          bio: editForm.bio,
          avatar_url: editForm.avatar_url,
          preparing_for: editForm.preparing_for,
        });
        setIsSaving(false);
        if (success) {
          // Update local state
          setLocalProfile((prev) =>
            prev
              ? {
                  ...prev,
                  full_name: editForm.full_name,
                  username: editForm.username,
                  bio: editForm.bio,
                  avatar_url: editForm.avatar_url,
                  preparing_for: editForm.preparing_for,
                }
              : prev
          );
          setIsEditModalOpen(false);
          toast.success("Profile updated successfully");
          router.refresh();
        }
      } catch (error) {
        setIsSaving(false);
        if (error instanceof Error && error.message === "USERNAME_TAKEN") {
          setUsernameError("This username is already taken");
          toast.error("Username is already taken");
        } else {
          toast.error("Failed to update profile");
        }
      }
    } else {
      // Preview mode - just update local state
      setLocalProfile((prev) =>
        prev
          ? {
              ...prev,
              full_name: editForm.full_name,
              username: editForm.username,
              bio: editForm.bio,
              avatar_url: editForm.avatar_url,
              preparing_for: editForm.preparing_for,
            }
          : prev
      );
      setIsSaving(false);
      setIsEditModalOpen(false);
    }
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

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "Unknown";

  const stats = [
    {
      icon: Sparkles,
      label: "Total XP",
      value: formatXP(xp),
      color: "text-primary",
      bgColor: "bg-primary/20",
    },
    {
      icon: Clock,
      label: "Total Study Time",
      value: formatMinutes(profile?.total_minutes_all_time || 0),
      color: "text-cyan-400",
      bgColor: "bg-cyan-400/20",
    },
    {
      icon: Flame,
      label: "Current Streak",
      value: `${profile?.current_streak || 0} days`,
      color: "text-orange-400",
      bgColor: "bg-orange-400/20",
    },
    {
      icon: Trophy,
      label: "Achievements",
      value: `${unlockedAchievementIds.length}/${achievements.length}`,
      color: "text-yellow-400",
      bgColor: "bg-yellow-400/20",
    },
    {
      icon: BookOpen,
      label: "Tests Completed",
      value: completedTests.toString(),
      color: "text-blue-400",
      bgColor: "bg-blue-400/20",
    },
    {
      icon: Bookmark,
      label: "Saved Questions",
      value: totalBookmarks.toString(),
      color: "text-purple-400",
      bgColor: "bg-purple-400/20",
    },
  ];

  return (
    <>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="widget-glass p-6 rounded-2xl"
        >
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Avatar with Frame + Status Note */}
            <div className="relative">
              <div
                className="cursor-pointer group"
                onClick={() => setShowCreateNote(true)}
                title="Set a status note or music"
              >
                {user?.id && (
                  <AvatarWithNote
                    userId={user.id}
                    avatarUrl={profile?.avatar_url}
                    fallback={getInitials(profile?.full_name)}
                    size="lg"
                    onNoteClick={() => setShowCreateNote(true)}
                  />
                )}
                {!user?.id && (
                  <FramedAvatar
                    src={profile?.avatar_url}
                    name={profile?.full_name}
                    frameSlug={profile?.profile_frame}
                    frames={profileFrames}
                    size="lg"
                  />
                )}
              </div>
              <ProBadgeOverlay isProMember={profile?.is_pro_member ?? false} trialEndsAt={profile?.trial_ends_at} />
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold text-white">
                  {profile?.full_name || "Student"}
                </h1>
                {profile?.is_pro_member && (() => {
                  const trial = getTrialStatus(profile);
                  if (trial?.isActive) {
                    return (
                      <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0">
                        NEW
                      </Badge>
                    );
                  }
                  return (
                    <Badge className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white border-0">
                      PRO
                    </Badge>
                  );
                })()}
                {isBuilder(profile?.username) && (
                  <Badge className="bg-gradient-to-r from-primary to-cyan-500 text-white border-0 flex items-center gap-1">
                    <Code2 className="w-3 h-3" />
                    BUILDER
                  </Badge>
                )}
              </div>
              <p className="text-white/60 mb-2">@{profile?.username || "user"}</p>

              {/* Level & XP Summary */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/20">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm font-medium text-primary">Level {level}</span>
                </div>
                <span className="text-sm text-white/50">{getLevelTitle(level)}</span>
                {isPro && streakShields > 0 && (
                  <StreakShieldBadge shields={streakShields} isPro={isPro} />
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-white/50">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4" />
                  {userEmail}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  Member since {memberSince}
                </span>
              </div>

              {profile?.bio && (
                <p className="mt-3 text-white/70 text-sm max-w-md">{profile.bio}</p>
              )}

              {profile?.preparing_for && profile.preparing_for.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {profile.preparing_for.map((exam) => (
                    <span
                      key={exam}
                      className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    >
                      {getExamLabel(exam)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditForm({
                    full_name: profile?.full_name || "",
                    username: profile?.username || "",
                    bio: profile?.bio || "",
                    avatar_url: profile?.avatar_url || "",
                    preparing_for: profile?.preparing_for || [],
                  });
                  setUsernameError(null);
                  setIsEditModalOpen(true);
                }}
                className="border-white/10 text-white hover:bg-white/10"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            </div>
          </div>

          {/* XP Bar */}
          <div className="mt-6 pt-5 border-t border-white/10">
            <XPBar
              xp={xp}
              level={level}
              progressPercent={xpProgress.progressPercent}
              xpToNextLevel={xpProgress.xpToNextLevel}
              isPro={isPro}
              size="md"
            />
          </div>
        </motion.div>

        {/* Connected Apps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="widget-glass p-6 rounded-2xl"
        >
          <h2 className="text-lg font-semibold text-white mb-4">Connected Apps</h2>
          <div className="space-y-3">
            {/* Telegram Connection */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#0088cc]/20 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-[#0088cc]" />
                </div>
                <div>
                  <p className="text-white font-medium">Telegram Bot</p>
                  <p className="text-sm text-white/50">
                    {isCheckingTelegram
                      ? "Checking..."
                      : telegramConnected
                      ? "Connected — receive study reminders"
                      : "Get daily reminders & quick quizzes"}
                  </p>
                </div>
              </div>
              {isCheckingTelegram ? (
                <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
              ) : telegramConnected ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 text-sm">
                  <Check className="w-4 h-4" />
                  Connected
                </div>
              ) : (
                <a
                  href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "PrepSPSCBot"}?start=${user?.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0088cc] hover:bg-[#0088cc]/90 text-white text-sm transition-colors"
                >
                  Connect
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4">Your Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                className="widget-glass p-4 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-white/50">{stat.label}</p>
                    <p className="text-lg font-bold text-white">{stat.value}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Achievements Section */}
        {achievements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="widget-glass p-6 rounded-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <h2 className="text-lg font-semibold text-white">Achievements</h2>
                <span className="text-sm text-white/40">
                  {unlockedAchievementIds.length}/{achievements.length}
                </span>
              </div>
              <Link
                href="/achievements"
                className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
              >
                View All
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <AchievementsShowcase
              achievements={achievements}
              unlockedIds={unlockedAchievementIds}
              maxDisplay={6}
            />
          </motion.div>
        )}

        {/* Profile Frames (Pro feature) */}
        {isPro && profileFrames.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="widget-glass p-6 rounded-2xl"
          >
            <div className="flex items-center gap-2 mb-4">
              <Crown className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-white">Profile Frames</h2>
              <Badge className="bg-accent/20 text-accent border-0 text-xs">Pro</Badge>
            </div>
            <ProfileFrameSelector
              frames={profileFrames}
              currentFrame={profile?.profile_frame || null}
              unlockedAchievementSlugs={achievements
                .filter((a) => unlockedAchievementIds.includes(a.id))
                .map((a) => a.slug)}
              isPro={isPro}
              onSelectFrame={async (frameSlug: string) => {
                if (user) {
                  const success = await updateProfile({ profile_frame: frameSlug });
                  if (success) {
                    setLocalProfile((prev) =>
                      prev ? { ...prev, profile_frame: frameSlug } : prev
                    );
                    router.refresh();
                  }
                  return success;
                } else {
                  setLocalProfile((prev) =>
                    prev ? { ...prev, profile_frame: frameSlug } : prev
                  );
                  return true;
                }
              }}
              avatarUrl={profile?.avatar_url}
              userName={profile?.full_name}
            />
          </motion.div>
        )}

        {/* Activity Heatmap */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="widget-glass p-6 rounded-2xl"
        >
          <h2 className="text-lg font-semibold text-white mb-4">Study Activity</h2>
          <ActivityHeatmap logs={studyLogs} />
        </motion.div>

        {/* Subscription Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="widget-glass p-6 rounded-2xl"
        >
          <h2 className="text-lg font-semibold text-white mb-4">Subscription</h2>
          {(() => {
            const trial = getTrialStatus(profile);

            {/* State 0: Everything is free (paid members still see their plan below) */}
            const isPaidMember = !!profile?.is_pro_member && !trial?.isActive;
            if (isAllFeaturesFree() && !isPaidMember) {
              return (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium">All features unlocked</p>
                    <p className="text-sm text-white/50">Every PrepSPSC feature is free for everyone.</p>
                  </div>
                </div>
              );
            }

            {/* State 1: Active trial */}
            if (trial?.isActive) {
              const dayNum = Math.min(7, Math.max(1, 8 - trial.daysLeft));
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-orange-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Free Trial</p>
                        <p className="text-sm text-white/50">
                          {trial.daysLeft} {trial.daysLeft === 1 ? "day" : "days"} remaining
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                      Active
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 transition-all"
                        style={{ width: `${((7 - trial.daysLeft) / 7) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-white/40">Day {dayNum} of 7</p>
                  </div>
                  <Button
                    onClick={() => router.push("/pricing")}
                    className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Upgrade to Pro
                  </Button>
                </div>
              );
            }

            {/* State 2: Expired trial */}
            if (trial?.isExpired) {
              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-white/40" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Trial Ended</p>
                      <p className="text-sm text-white/50">Upgrade to unlock all features</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => router.push("/pricing")}
                    className="w-full premium-gradient text-white"
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade to Pro
                  </Button>
                </div>
              );
            }

            {/* State 3: Paid Pro */}
            if (profile?.is_pro_member) {
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 flex items-center justify-center">
                        <Crown className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Pro Member</p>
                        <p className="text-sm text-white/50">
                          {profile.pro_cancelled
                            ? `Cancelled \u2014 access until ${new Date(profile.pro_expires_at!).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                            : profile.pro_expires_at
                            ? (() => {
                                const daysLeft = Math.ceil(
                                  (new Date(profile.pro_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                                );
                                if (daysLeft <= 0) return "Expired";
                                if (daysLeft === 1) return "Expires tomorrow";
                                if (daysLeft <= 7) return `Expires in ${daysLeft} days`;
                                return `Expires ${new Date(profile.pro_expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
                              })()
                            : "Lifetime access"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {profile.pro_expires_at && (() => {
                    const expiresAt = new Date(profile.pro_expires_at).getTime();
                    const now = Date.now();
                    const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)));
                    const totalDays = daysLeft > 35 ? 365 : 30;
                    const elapsed = totalDays - daysLeft;
                    const progress = Math.min(100, (elapsed / totalDays) * 100);
                    const isExpiring = daysLeft <= 7 && daysLeft > 0;

                    return (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-white/50">
                          <span>{daysLeft > 0 ? `${daysLeft} days remaining` : "Expired"}</span>
                          <span>{new Date(profile.pro_expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              daysLeft <= 0
                                ? "bg-red-500"
                                : isExpiring
                                ? "bg-orange-400"
                                : "bg-gradient-to-r from-orange-500 to-yellow-500"
                            }`}
                            style={{ width: `${100 - progress}%` }}
                          />
                        </div>
                        {isExpiring && !profile.pro_cancelled && !isAllFeaturesFree() && (
                          <Button
                            size="sm"
                            onClick={() => router.push("/pricing")}
                            className="w-full mt-2 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white text-xs"
                          >
                            <Crown className="w-3 h-3 mr-1" />
                            Renew Subscription
                          </Button>
                        )}
                      </div>
                    );
                  })()}

                  {!profile.pro_cancelled && (
                    <button
                      onClick={() => setShowCancelDialog(true)}
                      className="text-xs text-white/40 hover:text-red-400 transition-colors"
                    >
                      Cancel Subscription
                    </button>
                  )}

                  <div className="pt-4 border-t border-white/10 space-y-3">
                    <h3 className="text-sm font-medium text-white/70">Pro Features</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { icon: Zap, label: "Unlimited AI Credits" },
                        { icon: Shield, label: "3 Streak Shields/month" },
                        { icon: Sparkles, label: "1.5x XP Multiplier" },
                        { icon: Palette, label: "Exclusive Profile Frames" },
                        { icon: Lock, label: "Premium Study Rooms" },
                        { icon: Trophy, label: "Pro Achievements" },
                      ].map((feature) => (
                        <div key={feature.label} className="flex items-center gap-2 text-sm text-white/60">
                          <feature.icon className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                          <span>{feature.label}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-white/40 pt-2">
                      Account created {new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </p>
                  </div>
                </div>
              );
            }

            {/* State 4: Free user (grandfathered, no trial) */}
            return (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                    <User className="w-6 h-6 text-white/60" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Free Plan</p>
                    <p className="text-sm text-white/50">Upgrade to unlock all features</p>
                  </div>
                </div>
                <Button
                  onClick={() => router.push("/pricing")}
                  className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade to Pro
                </Button>
              </div>
            );
          })()}
        </motion.div>

        {/* Quick Feedback */}
        {user?.id && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <FeedbackBox userId={user.id} />
          </motion.div>
        )}

        {/* My Bug Reports */}
        {user?.id && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.355 }}
          >
            <FeedbackHistory
              userId={user.id}
              onReportNew={() => setIsFeedbackModalOpen(true)}
            />
          </motion.div>
        )}

        {/* Legal & Support */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36 }}
          className="widget-glass p-6 rounded-2xl"
        >
          <h2 className="text-lg font-semibold text-white mb-4">Legal & Support</h2>
          <div className="space-y-3">
            <Link
              href="/contact"
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-white/60" />
                <span className="text-white">Contact Us</span>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </Link>

            <Link
              href="/terms"
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-white/60" />
                <span className="text-white">Terms & Conditions</span>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </Link>

            <Link
              href="/refund-policy"
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-white/60" />
                <span className="text-white">Refunds & Cancellation</span>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </Link>
          </div>
        </motion.div>

        {/* Community - Social Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.37 }}
          className="widget-glass p-6 rounded-2xl"
        >
          <h2 className="text-lg font-semibold text-white mb-4">Community</h2>
          <div className="space-y-3">
            <a
              href="https://www.instagram.com/prepspsc"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white/60 group-hover:text-pink-500 transition-colors" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
                    />
                  </svg>
                </div>
                <span className="text-white">Follow on Instagram</span>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </a>

            <a
              href="https://www.reddit.com/r/prepspsc"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white/60 group-hover:text-orange-500 transition-colors" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"
                    />
                  </svg>
                </div>
                <span className="text-white">Join on Reddit</span>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </a>
          </div>
        </motion.div>

        {/* Account Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="widget-glass p-6 rounded-2xl"
        >
          <h2 className="text-lg font-semibold text-white mb-4">Account</h2>
          <div className="space-y-3">
            <button
              onClick={handleOpenSettings}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-white/60" />
                <span className="text-white">Settings</span>
              </div>
              <span className="text-white/30">→</span>
            </button>

            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-destructive/20 text-white hover:text-destructive transition-colors"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5" />
                <span>{isSigningOut ? "Signing out..." : "Sign Out"}</span>
              </div>
            </button>
          </div>
        </motion.div>
      </div>

      {/* Edit Profile Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="widget-glass border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Edit Profile</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Avatar Selector */}
            <div className="flex flex-col items-center gap-4">
              {/* Preview of selected avatar */}
              <Avatar className="w-20 h-20 border-4 border-primary/30">
                <AvatarImage src={editForm.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">
                  {getInitials(editForm.full_name || profile?.full_name)}
                </AvatarFallback>
              </Avatar>

              {/* Avatar grid selector */}
              <AvatarSelector
                currentAvatar={editForm.avatar_url}
                onSelect={(src) => setEditForm({ ...editForm, avatar_url: src })}
                username={profile?.username}
              />
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-white/70">Full Name</Label>
                <Input
                  id="full_name"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  placeholder="Enter your full name"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="text-white/70">Username</Label>
                <Input
                  id="username"
                  value={editForm.username}
                  onChange={(e) => {
                    setEditForm({ ...editForm, username: e.target.value.toLowerCase().replace(/\s/g, "") });
                    setUsernameError(null);
                  }}
                  placeholder="Enter your username"
                  className={cn(
                    "bg-white/5 border-white/10 text-white placeholder:text-white/40",
                    usernameError && "border-red-500 focus-visible:ring-red-500"
                  )}
                />
                {usernameError && (
                  <p className="text-xs text-red-400">{usernameError}</p>
                )}
                <p className="text-xs text-white/40">Only letters, numbers, and underscores allowed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio" className="text-white/70">Bio</Label>
                <Textarea
                  id="bio"
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  placeholder="Tell us about yourself..."
                  rows={3}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40 resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/70">Preparing For</Label>
                <ExamSelector
                  selected={editForm.preparing_for}
                  onChange={(exams) => setEditForm({ ...editForm, preparing_for: exams })}
                  maxSelections={5}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSaving}
                className="flex-1 border-white/10 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Subscription Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="widget-glass border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Cancel Subscription</DialogTitle>
            <DialogDescription className="text-white/60">
              Are you sure you want to cancel your Pro subscription?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="bg-white/5 rounded-lg p-3 space-y-1.5 text-sm text-white/70">
              <p>• You&apos;ll keep Pro access until <strong className="text-white">{profile?.pro_expires_at ? new Date(profile.pro_expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "your period ends"}</strong></p>
              <p>• After that, your account reverts to the Free plan</p>
              <p>• No refund for the remaining period</p>
              <p>• You won&apos;t lose any saved data</p>
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              className="flex-1 border-white/10 text-white hover:bg-white/10"
            >
              Keep Pro
            </Button>
            <Button
              onClick={handleCancelSubscription}
              disabled={isCancelling}
              className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
            >
              {isCancelling ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-1" />
              )}
              {isCancelling ? "Cancelling..." : "Cancel Pro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Modal */}
      {user?.id && (
        <FeedbackModal
          open={isFeedbackModalOpen}
          onOpenChange={setIsFeedbackModalOpen}
          userId={user.id}
        />
      )}

      {/* Status Note Modal */}
      <CreateStatusNote open={showCreateNote} onOpenChange={setShowCreateNote} />
    </>
  );
}
