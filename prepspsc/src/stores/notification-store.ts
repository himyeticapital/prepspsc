"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Notification types
export type NotificationType =
  | "room_created"      // New study room created
  | "test_added"        // New test added
  | "timer_complete"    // Timer stopped/completed
  | "mention"           // @username mention in chat
  | "table_mention"     // @username mention in table chat
  | "room_message"      // General room message (optional)
  | "member_joined"     // Someone joined a room you're in
  | "table_created"     // New table created in a room
  | "revision_due"      // Study AI: goal due for revision
  | "study_streak";     // Study AI: streak reminder

export interface LocalNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  isRead: boolean;
  data?: {
    roomId?: number;
    roomName?: string;
    testId?: number;
    testName?: string;
    tableId?: number;
    tableName?: string;
    userId?: string;
    username?: string;
    goalId?: number;
    goalText?: string;
  };
}

export interface NotificationSettings {
  enabled: boolean;              // Master toggle
  roomCreated: boolean;          // New room notifications
  testAdded: boolean;            // New test notifications
  timerComplete: boolean;        // Timer complete notifications
  mentions: boolean;             // @username mentions
  soundEnabled: boolean;         // Play sound on notification
  revisionDue: boolean;          // Study AI revision due
  studyStreak: boolean;          // Study AI streak reminders
}

interface NotificationState {
  // Notifications list
  notifications: LocalNotification[];

  // Settings
  settings: NotificationSettings;

  // Unread count
  unreadCount: number;

  // Track which user owns these notifications
  lastUserId: string | null;

  // Actions - Notifications
  addNotification: (notification: Omit<LocalNotification, "id" | "timestamp" | "isRead">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;

  // Actions - Settings
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  toggleSetting: (key: keyof NotificationSettings) => void;

  // Helper - Check if notification type is enabled
  isNotificationEnabled: (type: NotificationType) => boolean;

  // Trigger notification (checks settings before adding)
  triggerNotification: (notification: Omit<LocalNotification, "id" | "timestamp" | "isRead">) => void;

  // Set current user ID (clears notifications if user changed)
  setUserId: (userId: string | null) => void;
}

// Play notification sound
const playNotificationSound = () => {
  if (typeof window !== "undefined") {
    const audio = new Audio("/sounds/notification.wav");
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Ignore errors (e.g., user hasn't interacted with page)
    });
  }
};

// Export for test button
export { playNotificationSound };

// Show browser notification (if permission granted)
const showBrowserNotification = (title: string, body: string) => {
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
      });
    }
  }
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      // Initial state
      notifications: [],
      unreadCount: 0,
      lastUserId: null,
      settings: {
        enabled: true,
        roomCreated: true,
        testAdded: true,
        timerComplete: true,
        mentions: true,
        soundEnabled: true,
        revisionDue: true,
        studyStreak: true,
      },

      // Add notification
      addNotification: (notification) => {
        const newNotification: LocalNotification = {
          ...notification,
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          isRead: false,
        };

        set((state) => ({
          notifications: [newNotification, ...state.notifications].slice(0, 100), // Keep max 100
          unreadCount: state.unreadCount + 1,
        }));
      },

      // Mark single notification as read
      markAsRead: (id) => {
        set((state) => {
          const notification = state.notifications.find((n) => n.id === id);
          if (notification && !notification.isRead) {
            return {
              notifications: state.notifications.map((n) =>
                n.id === id ? { ...n, isRead: true } : n
              ),
              unreadCount: Math.max(0, state.unreadCount - 1),
            };
          }
          return state;
        });
      },

      // Mark all as read
      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
          unreadCount: 0,
        }));
      },

      // Remove notification
      removeNotification: (id) => {
        set((state) => {
          const notification = state.notifications.find((n) => n.id === id);
          const wasUnread = notification && !notification.isRead;
          return {
            notifications: state.notifications.filter((n) => n.id !== id),
            unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
          };
        });
      },

      // Clear all notifications
      clearAllNotifications: () => {
        set({ notifications: [], unreadCount: 0 });
      },

      // Update settings
      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      // Toggle individual setting
      toggleSetting: (key) => {
        set((state) => ({
          settings: {
            ...state.settings,
            [key]: !state.settings[key],
          },
        }));
      },

      // Check if notification type is enabled
      isNotificationEnabled: (type) => {
        const { settings } = get();

        if (!settings.enabled) return false;

        switch (type) {
          case "room_created":
            return settings.roomCreated;
          case "test_added":
            return settings.testAdded;
          case "timer_complete":
            return settings.timerComplete;
          case "mention":
          case "table_mention":
            return settings.mentions;
          case "revision_due":
            return settings.revisionDue;
          case "study_streak":
            return settings.studyStreak;
          default:
            return true;
        }
      },

      // Trigger notification (checks settings first)
      triggerNotification: (notification) => {
        const { settings, isNotificationEnabled, addNotification } = get();

        // Check if this notification type is enabled
        if (!isNotificationEnabled(notification.type)) {
          return;
        }

        // Add the notification
        addNotification(notification);

        // Play sound if enabled
        if (settings.soundEnabled) {
          playNotificationSound();
        }

        // Show browser notification for important ones
        if (notification.type === "mention" || notification.type === "table_mention") {
          showBrowserNotification(notification.title, notification.message);
        }
      },

      // Set user ID and clear notifications if user changed
      setUserId: (userId) => {
        const { lastUserId, clearAllNotifications } = get();

        // If there's a stored user ID and it doesn't match the new user, clear notifications
        if (lastUserId && userId && lastUserId !== userId) {
          clearAllNotifications();
          // Also clear revision checker localStorage
          localStorage.removeItem("study-ai-last-revision-check");
          localStorage.removeItem("study-ai-notified-goals");
        }

        set({ lastUserId: userId });
      },
    }),
    {
      name: "prepspsc-notification-store",
      partialize: (state) => ({
        notifications: state.notifications.slice(0, 50), // Persist only last 50
        settings: state.settings,
        unreadCount: state.unreadCount,
        lastUserId: state.lastUserId,
      }),
    }
  )
);

// Helper functions to trigger specific notification types
export const notificationHelpers = {
  // Trigger when new study room is created
  newRoomCreated: (roomName: string, roomId: number) => {
    useNotificationStore.getState().triggerNotification({
      type: "room_created",
      title: "New Study Room",
      message: `"${roomName}" has been created`,
      data: { roomId, roomName },
    });
  },

  // Trigger when new test is added
  newTestAdded: (testName: string, testId: number) => {
    useNotificationStore.getState().triggerNotification({
      type: "test_added",
      title: "New Test Available",
      message: `"${testName}" has been added`,
      data: { testId, testName },
    });
  },

  // Trigger when timer completes
  timerComplete: (mode: "pomodoro" | "countdown" | "stopwatch", session?: "work" | "break" | "longBreak") => {
    let title = "Timer Complete";
    let message = "Your timer has finished!";

    if (mode === "pomodoro") {
      if (session === "work") {
        title = "Work Session Complete";
        message = "Great job! Time for a break.";
      } else if (session === "longBreak") {
        title = "Long Break Over";
        message = "Ready to start a fresh session?";
      } else {
        title = "Break Over";
        message = "Ready to start another work session?";
      }
    } else if (mode === "countdown") {
      title = "Countdown Complete";
      message = "Your countdown timer has finished!";
    }

    useNotificationStore.getState().triggerNotification({
      type: "timer_complete",
      title,
      message,
    });
  },

  // Trigger when mentioned in room chat
  mentionInRoom: (username: string, roomName: string, roomId: number, messagePreview: string) => {
    useNotificationStore.getState().triggerNotification({
      type: "mention",
      title: `@${username} mentioned you`,
      message: `In ${roomName}: "${messagePreview.slice(0, 50)}${messagePreview.length > 50 ? "..." : ""}"`,
      data: { roomId, roomName, username },
    });
  },

  // Trigger when mentioned in table chat
  mentionInTable: (username: string, tableName: string, tableId: number, roomId: number, messagePreview: string) => {
    useNotificationStore.getState().triggerNotification({
      type: "table_mention",
      title: `@${username} mentioned you`,
      message: `At ${tableName}: "${messagePreview.slice(0, 50)}${messagePreview.length > 50 ? "..." : ""}"`,
      data: { tableId, tableName, roomId, username },
    });
  },

  // Trigger when someone joins a room
  memberJoinedRoom: (username: string, roomName: string, roomId: number) => {
    useNotificationStore.getState().triggerNotification({
      type: "member_joined",
      title: "New Member",
      message: `${username} joined "${roomName}"`,
      data: { roomId, roomName, username },
    });
  },

  // Trigger when a new table is created in a room
  tableCreated: (tableName: string, roomName: string, tableId: number, roomId: number, creatorName?: string) => {
    useNotificationStore.getState().triggerNotification({
      type: "table_created",
      title: "New Study Table",
      message: creatorName
        ? `${creatorName} created "${tableName}" in ${roomName}`
        : `"${tableName}" table created in ${roomName}`,
      data: { tableId, tableName, roomId, roomName },
    });
  },

  // Study AI: Trigger when a goal is due for revision
  revisionDue: (goalText: string, goalId: number, dueCount?: number) => {
    useNotificationStore.getState().triggerNotification({
      type: "revision_due",
      title: "Time to Review!",
      message: dueCount && dueCount > 1
        ? `"${goalText.slice(0, 40)}${goalText.length > 40 ? "..." : ""}" and ${dueCount - 1} more due for revision`
        : `"${goalText.slice(0, 50)}${goalText.length > 50 ? "..." : ""}" is ready for revision`,
      data: { goalId, goalText },
    });
  },

  // Study AI: Trigger streak reminder
  studyStreakReminder: (currentStreak: number) => {
    useNotificationStore.getState().triggerNotification({
      type: "study_streak",
      title: "Keep Your Streak Alive!",
      message: currentStreak > 0
        ? `You're on a ${currentStreak}-day study streak! Don't break it.`
        : "Start your study streak today with a quick revision session.",
    });
  },
};
