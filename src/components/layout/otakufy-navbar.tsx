"use client";

import { isAllFeaturesFree } from "@/lib/access";
import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  Bell,
  BellOff,
  User,
  Crown,
  CheckCheck,
  Trash2,
  Users,
  BookOpen,
  Timer,
  AtSign,
  X,
  Settings,
  UserPlus,
  SquarePlus,
  Brain,
  Flame,
  Wand2,
  Sparkles,
  Heart,
} from "lucide-react";
import { useAuthStore, getTrialStatus } from "@/stores/auth-store";
import {
  useNotificationStore,
  type NotificationType,
  type LocalNotification,
} from "@/stores/notification-store";
import { useWidgetStore } from "@/stores/widget-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RedPandaMascot } from "@/components/ui/red-panda-mascot";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ProfileFrame } from "@/types/database.types";
import { formatDistanceToNow } from "date-fns";

const notificationIcons: Record<NotificationType, React.ElementType> = {
  room_created: Users,
  test_added: BookOpen,
  timer_complete: Timer,
  mention: AtSign,
  table_mention: AtSign,
  room_message: Bell,
  member_joined: UserPlus,
  table_created: SquarePlus,
  revision_due: Brain,
  study_streak: Flame,
  planner_revision_due: Brain,
  buddy_match: Heart,
  buddy_message: Heart,
};

const notificationColors: Record<NotificationType, string> = {
  room_created: "text-green-400",
  test_added: "text-blue-400",
  timer_complete: "text-orange-400",
  mention: "text-purple-400",
  table_mention: "text-purple-400",
  room_message: "text-white/60",
  member_joined: "text-cyan-400",
  table_created: "text-yellow-400",
  revision_due: "text-purple-400",
  study_streak: "text-orange-400",
  planner_revision_due: "text-orange-400",
  buddy_match: "text-pink-400",
  buddy_message: "text-pink-400",
};

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/rooms", label: "Study Rooms" },
  { href: "/study-ai", label: "Study with AI", isAI: true },
  { href: "/tests", label: "Tests Arena" },
];

export function OtakufyNavbar({ className }: { className?: string }) {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();
  const { openWidget } = useWidgetStore();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
    settings,
    triggerNotification,
  } = useNotificationStore();
  const supabase = createClient();
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [profileFrames, setProfileFrames] = useState<ProfileFrame[]>([]);

  const getFrameClass = (frameSlug?: string | null) => {
    if (!frameSlug || profileFrames.length === 0) return "border border-white/20";
    const frame = profileFrames.find((f) => f.slug === frameSlug);
    return frame?.css_class || "border border-white/20";
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to global broadcast notifications (new tests, announcements, etc.)
  useEffect(() => {
    const globalChannel = supabase.channel("global-notifications");

    globalChannel
      .on("broadcast", { event: "new_notification" }, (payload) => {
        const { type, title, message, data } = payload.payload as {
          type: NotificationType;
          title: string;
          message: string;
          data?: Record<string, unknown>;
        };

        // Trigger the notification in the local store
        triggerNotification({
          type,
          title,
          message,
          data: data as LocalNotification["data"],
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(globalChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to room_notifications for real-time room invitations
  useEffect(() => {
    if (!profile?.id) return;

    // Fetch unread room invitations on mount
    const fetchUnread = async () => {
      const { data } = await supabase
        .from("room_notifications")
        .select("*")
        .eq("user_id", profile.id)
        .eq("is_read", false)
        .eq("type", "room_update")
        .order("created_at", { ascending: false })
        .limit(10);

      if (data && data.length > 0) {
        data.forEach((notif) => {
          triggerNotification({
            type: "member_joined",
            title: notif.title,
            message: notif.message || "You have a new room invitation",
            data: { roomId: notif.room_id, roomName: (notif.metadata as any)?.roomName },
          });
        });

        // Mark them as read in DB so they don't re-appear
        const ids = data.map((n) => n.id);
        await supabase
          .from("room_notifications")
          .update({ is_read: true })
          .in("id", ids);
      }
    };

    // Fetch missed test notifications (for users who were offline)
    const fetchMissedNotifications = async () => {
      const { data } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", profile.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data && data.length > 0) {
        data.forEach((notif) => {
          const metadata = notif.metadata as { testId?: number; testName?: string; notificationType?: string } | null;
          const notifType = metadata?.notificationType === "test_added" ? "test_added" : "room_message";

          triggerNotification({
            type: notifType as NotificationType,
            title: notif.title,
            message: notif.message || "",
            data: metadata?.testId ? { testId: metadata.testId, testName: metadata.testName } : undefined,
          });
        });

        // Mark them as read in DB
        const ids = data.map((n) => n.id);
        await supabase
          .from("user_notifications")
          .update({ is_read: true })
          .in("id", ids);
      }
    };

    fetchUnread();
    fetchMissedNotifications();

    // Realtime subscription for new room invitations
    realtimeRef.current = supabase
      .channel(`navbar-room-notifs-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_notifications",
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          const notif = payload.new as any;
          triggerNotification({
            type: "member_joined",
            title: notif.title || "Room Invitation",
            message: notif.message || "You have a new room invitation",
            data: { roomId: notif.room_id, roomName: notif.metadata?.roomName },
          });
        }
      )
      .subscribe();

    return () => {
      if (realtimeRef.current) {
        supabase.removeChannel(realtimeRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleNotificationClick = (notification: LocalNotification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.type === "revision_due") {
      router.push("/study-ai/revision");
    } else if (notification.type === "study_streak") {
      router.push("/study-ai");
    } else if (notification.data?.tableId && notification.data?.roomId) {
      router.push(`/room/${notification.data.roomId}`);
    } else if (notification.data?.roomId) {
      router.push(`/room/${notification.data.roomId}`);
    } else if (notification.data?.testId) {
      router.push(`/test/${notification.data.testId}`);
    }
  };

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeNotification(id);
  };

  return (
    <motion.nav
      initial={{ y: -56, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 h-14",
        "navbar-transparent",
        "flex items-center justify-between px-6",
        className
      )}
    >
      {/* Logo */}
      <RedPandaMascot size="md" />

      {/* Center Nav Links */}
      <div className="hidden md:flex items-center gap-0 lg:gap-1">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "px-2 lg:px-4 py-2 rounded-lg text-sm font-medium",
              "text-white/70 hover:text-white hover:bg-white/10",
              "transition-colors duration-200",
              link.isAI && "group relative"
            )}
          >
            {link.isAI ? (
              <span className="flex items-center gap-1.5">
                <motion.span
                  animate={{
                    rotate: [0, -10, 10, -10, 0],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 3
                  }}
                  className="inline-block"
                >
                  <Wand2 className="w-3.5 h-3.5 text-purple-400 group-hover:text-purple-300" />
                </motion.span>
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent group-hover:from-purple-300 group-hover:to-pink-300">
                  {link.label}
                </span>
                {/* Sparkle effect */}
                <motion.span
                  className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-purple-400 rounded-full"
                  animate={{
                    scale: [0, 1, 0],
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    repeatDelay: 2,
                  }}
                />
              </span>
            ) : (
              link.label
            )}
          </Link>
        ))}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="dock-button w-10 h-10 relative">
              {settings.enabled ? (
                <Bell className="w-5 h-5" />
              ) : (
                <BellOff className="w-5 h-5 text-white/40" />
              )}
              {unreadCount > 0 && settings.enabled && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-destructive rounded-full">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-80 p-0 widget-glass border-white/10"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <span className="font-medium text-white">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-xs text-white/50">({unreadCount} new)</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={markAllAsRead}
                    className="w-7 h-7 text-white/50 hover:text-white"
                    title="Mark all read"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </Button>
                )}
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearAllNotifications}
                    className="w-7 h-7 text-white/50 hover:text-white"
                    title="Clear all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openWidget("settings")}
                  className="w-7 h-7 text-white/50 hover:text-white"
                  title="Notification settings"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Notification List */}
            <ScrollArea className="max-h-[400px]">
              {!settings.enabled ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <BellOff className="w-10 h-10 text-white/20 mb-3" />
                  <p className="text-sm text-white/60">Notifications paused</p>
                  <p className="text-xs text-white/40 mt-1">
                    Enable in settings to receive alerts
                  </p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <Bell className="w-10 h-10 text-white/20 mb-3" />
                  <p className="text-sm text-white/60">No notifications</p>
                  <p className="text-xs text-white/40 mt-1">
                    You'll be notified about rooms, tests, and mentions
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  <AnimatePresence mode="popLayout">
                    {notifications.slice(0, 20).map((notification) => {
                      const Icon = notificationIcons[notification.type] || Bell;
                      const colorClass = notificationColors[notification.type] || "text-white/60";

                      return (
                        <motion.div
                          key={notification.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className={cn(
                            "px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors relative group",
                            !notification.isRead && "bg-primary/5 border-l-2 border-primary"
                          )}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn("p-1.5 rounded-lg bg-white/5 flex-shrink-0", colorClass)}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={cn(
                                  "text-sm truncate",
                                  notification.isRead ? "text-white/70" : "font-medium text-white"
                                )}>
                                  {notification.title}
                                </p>
                                {!notification.isRead && (
                                  <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                                )}
                              </div>
                              {notification.message && (
                                <p className="text-xs text-white/50 line-clamp-1 mt-0.5">
                                  {notification.message}
                                </p>
                              )}
                              <p className="text-[10px] text-white/40 mt-1">
                                {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                              </p>
                            </div>
                            <button
                              onClick={(e) => handleRemove(e, notification.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity flex-shrink-0"
                            >
                              <X className="w-3.5 h-3.5 text-white/40" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 p-1 rounded-full hover:bg-white/10 transition-colors">
              <Avatar className={cn("w-8 h-8", getFrameClass(profile?.profile_frame))}>
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-xs">
                  {getInitials(profile?.full_name || profile?.username)}
                </AvatarFallback>
              </Avatar>
              {profile?.is_pro_member && (() => {
                const trial = getTrialStatus(profile);
                if (trial?.isActive) {
                  if (isAllFeaturesFree()) return null;
                  return (
                    <span className="text-[10px] font-medium text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <Sparkles className="w-3 h-3" />
                      {trial.daysLeft}d
                    </span>
                  );
                }
                return <Crown className="w-4 h-4 text-accent" />;
              })()}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 widget-glass">
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-white">
                {profile?.full_name || profile?.username || "User"}
              </p>
              <p className="text-xs text-white/60">{profile?.username}</p>
            </div>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="cursor-pointer">
                <User className="w-4 h-4 mr-2" />
                Profile
              </Link>
            </DropdownMenuItem>
            {!isAllFeaturesFree() && (!profile?.is_pro_member || getTrialStatus(profile)?.isActive) && (
              <DropdownMenuItem asChild>
                <Link href="/pricing" className="cursor-pointer text-accent">
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade to Pro
                </Link>
              </DropdownMenuItem>
            )}
            {(profile?.role === "admin" || profile?.role === "teacher") && (
              <DropdownMenuItem asChild>
                <Link href="/admin" className="cursor-pointer">
                  Admin Panel
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              onClick={() => signOut()}
              className="cursor-pointer text-destructive"
            >
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.nav>
  );
}
