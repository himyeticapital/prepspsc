"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  MessageCircle,
  Users,
  Trash2,
  Timer,
  BookOpen,
  AtSign,
  X,
  UserPlus,
  SquarePlus,
  Brain,
  Flame,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  useNotificationStore,
  type NotificationType,
  type LocalNotification,
} from "@/stores/notification-store";

const notificationIcons: Record<NotificationType, React.ElementType> = {
  room_created: Users,
  test_added: BookOpen,
  timer_complete: Timer,
  mention: AtSign,
  table_mention: AtSign,
  room_message: MessageCircle,
  member_joined: UserPlus,
  table_created: SquarePlus,
  revision_due: Brain,
  study_streak: Flame,
  planner_revision_due: Brain,
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
};

export function NotificationsWidget() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
    settings,
  } = useNotificationStore();

  const unreadNotifications = notifications.filter((n) => !n.isRead);
  const readNotifications = notifications.filter((n) => n.isRead);

  const handleNotificationClick = (notification: LocalNotification) => {
    console.log("Notification clicked:", notification.type, notification);

    // Mark as read
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.type === "revision_due") {
      console.log("Navigating to /study-ai/revision");
      router.push("/study-ai/revision");
    } else if (notification.type === "study_streak") {
      console.log("Navigating to /study-ai");
      router.push("/study-ai");
    } else if (notification.data?.tableId && notification.data?.roomId) {
      console.log("Navigating to room (table):", notification.data.roomId);
      router.push(`/room/${notification.data.roomId}`);
    } else if (notification.data?.roomId) {
      console.log("Navigating to room:", notification.data.roomId);
      router.push(`/room/${notification.data.roomId}`);
    } else if (notification.data?.testId) {
      console.log("Navigating to test:", notification.data.testId);
      router.push(`/test/${notification.data.testId}`);
    } else {
      console.log("No matching navigation route for notification type:", notification.type);
    }
  };

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeNotification(id);
  };

  // Show notification status if paused
  if (!settings.enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-[350px] p-6 text-center">
        <BellOff className="w-12 h-12 text-white/20 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Notifications Paused</h3>
        <p className="text-sm text-white/50">
          Enable notifications in Settings to receive alerts
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[420px]">
      {/* Header Actions */}
      <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <span className="text-sm text-white/60">
          {unreadCount} unread
        </span>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs text-white/50 hover:text-white h-7"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Mark all read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllNotifications}
              className="text-xs text-white/50 hover:text-white h-7"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <ScrollArea className="flex-1">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] p-6 text-center">
            <Bell className="w-10 h-10 text-white/20 mb-3" />
            <h3 className="text-sm font-medium text-white mb-1">No notifications</h3>
            <p className="text-xs text-white/40">
              You'll be notified about rooms, tests, timer, and mentions
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            <AnimatePresence mode="popLayout">
              {/* Unread notifications first */}
              {unreadNotifications.map((notification) => {
                const Icon = notificationIcons[notification.type] || Bell;
                const colorClass = notificationColors[notification.type] || "text-white/60";

                return (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className={cn(
                      "relative group",
                      "bg-primary/5 border-l-2 border-primary"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className="w-full text-left px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn("p-1.5 rounded-lg bg-white/5", colorClass)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white truncate">
                              {notification.title}
                            </p>
                            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                          </div>
                          {notification.message && (
                            <p className="text-xs text-white/50 line-clamp-2 mt-0.5">
                              {notification.message}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-white/40">
                              {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => handleRemove(e, notification.id)}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity"
                    >
                      <X className="w-4 h-4 text-white/30" />
                    </button>
                  </motion.div>
                );
              })}

              {/* Read notifications */}
              {readNotifications.map((notification) => {
                const Icon = notificationIcons[notification.type] || Bell;

                return (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="relative group opacity-60"
                  >
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className="w-full text-left px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-lg bg-white/5 text-white/40">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/70 truncate">
                            {notification.title}
                          </p>
                          {notification.message && (
                            <p className="text-xs text-white/40 line-clamp-1 mt-0.5">
                              {notification.message}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-white/30">
                              {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => handleRemove(e, notification.id)}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity"
                    >
                      <X className="w-4 h-4 text-white/30" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
