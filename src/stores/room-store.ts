"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { Room, UserRoomSubscription, RoomNotification, RoomPresence, Profile } from "@/types/database.types";
import { notificationHelpers } from "@/stores/notification-store";

// Extended room type with computed fields
export interface RoomWithDetails extends Room {
  onlineCount: number;
  memberCount: number;
  isSubscribed: boolean;
  isFavorite: boolean;
  unreadCount: number;
}

// Presence with profile
export interface PresenceWithProfile extends RoomPresence {
  profile?: Profile;
}

interface RoomState {
  // Data
  rooms: Room[];
  subscriptions: UserRoomSubscription[];
  notifications: RoomNotification[];
  presenceByRoom: Record<number, PresenceWithProfile[]>;
  onlineCountByRoom: Record<number, number>;
  roomMembers: Record<number, { id: string; full_name: string | null; username: string | null; avatar_url: string | null; xp_level: number }[]>;

  // Loading states
  isLoading: boolean;
  isSubscriptionsLoading: boolean;

  // Current room context
  currentRoomId: number | null;

  // Actions - Rooms
  fetchRooms: () => Promise<void>;
  searchRooms: (query: string) => Promise<Room[]>;

  // Actions - Subscriptions
  fetchSubscriptions: (userId: string) => Promise<void>;
  subscribeToRoom: (userId: string, roomId: number) => Promise<boolean>;
  unsubscribeFromRoom: (userId: string, roomId: number) => Promise<boolean>;
  toggleFavorite: (userId: string, roomId: number) => Promise<void>;
  setNotificationLevel: (userId: string, roomId: number, level: "muted" | "normal" | "important") => Promise<void>;

  // Actions - Notifications
  fetchNotifications: (userId: string) => Promise<void>;
  markNotificationRead: (notificationId: number) => Promise<void>;
  markRoomNotificationsRead: (userId: string, roomId: number) => Promise<void>;
  clearAllNotifications: (userId: string) => Promise<void>;

  // Actions - Presence
  joinRoom: (userId: string, roomId: number, status?: "online" | "away" | "studying") => Promise<void>;
  leaveRoom: (userId: string, roomId: number) => Promise<void>;
  updatePresenceStatus: (userId: string, roomId: number, status: "online" | "away" | "studying") => Promise<void>;
  fetchRoomPresence: (roomId: number) => Promise<void>;

  // Actions - Current room
  setCurrentRoom: (roomId: number | null) => void;

  // Computed helpers
  getSubscribedRooms: () => Room[];
  getFavoriteRooms: () => Room[];
  getRoomWithDetails: (roomId: number) => RoomWithDetails | null;
  getUnreadCount: () => number;

  // Actions - Room Members
  fetchRoomMembers: (roomId: number) => Promise<void>;

  // Realtime subscriptions
  subscribeToRealtime: (userId: string) => () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  // Initial state
  rooms: [],
  subscriptions: [],
  notifications: [],
  presenceByRoom: {},
  onlineCountByRoom: {},
  roomMembers: {},
  isLoading: false,
  isSubscriptionsLoading: false,
  currentRoomId: null,

  // Fetch all rooms
  fetchRooms: async () => {
    set({ isLoading: true });
    const supabase = createClient();

    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (!error && data) {
      set({ rooms: data });
    }
    set({ isLoading: false });
  },

  // Search rooms
  searchRooms: async (query: string) => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("is_active", true)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`)
      .order("created_at", { ascending: false });

    return error ? [] : data || [];
  },

  // Fetch user subscriptions
  fetchSubscriptions: async (userId: string) => {
    set({ isSubscriptionsLoading: true });
    const supabase = createClient();

    const { data, error } = await supabase
      .from("user_room_subscriptions")
      .select("*")
      .eq("user_id", userId);

    if (!error && data) {
      set({ subscriptions: data });
    }
    set({ isSubscriptionsLoading: false });
  },

  // Subscribe to a room
  subscribeToRoom: async (userId: string, roomId: number) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("user_room_subscriptions")
      .insert({ user_id: userId, room_id: roomId });

    if (!error) {
      await get().fetchSubscriptions(userId);
      return true;
    }
    return false;
  },

  // Unsubscribe from a room
  unsubscribeFromRoom: async (userId: string, roomId: number) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("user_room_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("room_id", roomId);

    if (!error) {
      set((state) => ({
        subscriptions: state.subscriptions.filter(
          (s) => !(s.user_id === userId && s.room_id === roomId)
        ),
      }));
      return true;
    }
    return false;
  },

  // Toggle favorite
  toggleFavorite: async (userId: string, roomId: number) => {
    const { subscriptions } = get();
    const subscription = subscriptions.find(
      (s) => s.user_id === userId && s.room_id === roomId
    );

    if (!subscription) return;

    const supabase = createClient();
    await supabase
      .from("user_room_subscriptions")
      .update({ is_favorite: !subscription.is_favorite })
      .eq("user_id", userId)
      .eq("room_id", roomId);

    set((state) => ({
      subscriptions: state.subscriptions.map((s) =>
        s.user_id === userId && s.room_id === roomId
          ? { ...s, is_favorite: !s.is_favorite }
          : s
      ),
    }));
  },

  // Set notification level
  setNotificationLevel: async (userId: string, roomId: number, level) => {
    const supabase = createClient();
    await supabase
      .from("user_room_subscriptions")
      .update({ notification_level: level })
      .eq("user_id", userId)
      .eq("room_id", roomId);

    set((state) => ({
      subscriptions: state.subscriptions.map((s) =>
        s.user_id === userId && s.room_id === roomId
          ? { ...s, notification_level: level }
          : s
      ),
    }));
  },

  // Fetch notifications
  fetchNotifications: async (userId: string) => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("room_notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      set({ notifications: data });
    }
  },

  // Mark single notification read
  markNotificationRead: async (notificationId: number) => {
    const supabase = createClient();

    await supabase
      .from("room_notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, is_read: true } : n
      ),
    }));
  },

  // Mark all room notifications as read
  markRoomNotificationsRead: async (userId: string, roomId: number) => {
    const supabase = createClient();

    await supabase
      .from("room_notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("room_id", roomId)
      .eq("is_read", false);

    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.room_id === roomId ? { ...n, is_read: true } : n
      ),
    }));
  },

  // Clear all notifications
  clearAllNotifications: async (userId: string) => {
    const supabase = createClient();

    await supabase
      .from("room_notifications")
      .delete()
      .eq("user_id", userId);

    set({ notifications: [] });
  },

  // Join room (presence)
  joinRoom: async (userId: string, roomId: number, status = "online") => {
    const supabase = createClient();

    try {
      // First try to update existing presence
      const { data: existing } = await supabase
        .from("room_presence")
        .select("id")
        .eq("user_id", userId)
        .eq("room_id", roomId)
        .single();

      if (existing) {
        // Update existing record
        await supabase
          .from("room_presence")
          .update({
            last_seen_at: new Date().toISOString(),
            status,
          })
          .eq("user_id", userId)
          .eq("room_id", roomId);
      } else {
        // Insert new record
        await supabase.from("room_presence").insert({
          user_id: userId,
          room_id: roomId,
          last_seen_at: new Date().toISOString(),
          status,
        });
      }
    } catch (error) {
      console.error("Join room error:", error);
    }

    await get().fetchRoomPresence(roomId);
  },

  // Leave room (presence)
  leaveRoom: async (userId: string, roomId: number) => {
    const supabase = createClient();

    try {
      await supabase
        .from("room_presence")
        .delete()
        .eq("user_id", userId)
        .eq("room_id", roomId);
    } catch (error) {
      console.error("Leave room error:", error);
    }

    set((state) => ({
      presenceByRoom: {
        ...state.presenceByRoom,
        [roomId]: (state.presenceByRoom[roomId] || []).filter(
          (p) => p.user_id !== userId
        ),
      },
    }));
  },

  // Update presence status
  updatePresenceStatus: async (userId: string, roomId: number, status) => {
    const supabase = createClient();

    await supabase
      .from("room_presence")
      .update({ status, last_seen_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("room_id", roomId);
  },

  // Fetch room presence
  fetchRoomPresence: async (roomId: number) => {
    const supabase = createClient();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    try {
      // First get presence records
      const { data: presenceData, error: presenceError } = await supabase
        .from("room_presence")
        .select("*")
        .eq("room_id", roomId)
        .gte("last_seen_at", fiveMinutesAgo);

      if (presenceError) {
        // Ignore AbortError from React StrictMode and empty error objects (auth not ready)
        if (
          !presenceError.message ||
          presenceError.message.includes("aborted") ||
          presenceError.message.includes("AbortError")
        ) {
          return;
        }
        console.error("Presence query error:", presenceError);
        set((state) => ({
          presenceByRoom: { ...state.presenceByRoom, [roomId]: [] },
          onlineCountByRoom: { ...state.onlineCountByRoom, [roomId]: 0 },
        }));
        return;
      }

      if (!presenceData || presenceData.length === 0) {
        set((state) => ({
          presenceByRoom: { ...state.presenceByRoom, [roomId]: [] },
          onlineCountByRoom: { ...state.onlineCountByRoom, [roomId]: 0 },
        }));
        return;
      }

      // Fetch profiles for each user
      const userIds = presenceData.map((p) => p.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);

      // Combine presence with profiles
      const data = presenceData.map((p) => ({
        ...p,
        profile: profiles?.find((profile) => profile.id === p.user_id) || null,
      }));

      set((state) => ({
        presenceByRoom: {
          ...state.presenceByRoom,
          [roomId]: (data as PresenceWithProfile[]) || [],
        },
        onlineCountByRoom: {
          ...state.onlineCountByRoom,
          [roomId]: data?.length || 0,
        },
      }));
    } catch (error) {
      // Ignore AbortError from React StrictMode
      if (error instanceof Error && (error.name === "AbortError" || error.message?.includes("aborted"))) {
        return;
      }
      console.error("Error fetching room presence:", error);
      set((state) => ({
        presenceByRoom: {
          ...state.presenceByRoom,
          [roomId]: [],
        },
        onlineCountByRoom: {
          ...state.onlineCountByRoom,
          [roomId]: 0,
        },
      }));
    }
  },

  // Fetch room members
  fetchRoomMembers: async (roomId: number) => {
    const supabase = createClient();
    // Get subscription user_ids for this room
    const { data: subs } = await supabase
      .from("user_room_subscriptions")
      .select("user_id")
      .eq("room_id", roomId);

    if (!subs?.length) {
      set((state) => ({ roomMembers: { ...state.roomMembers, [roomId]: [] } }));
      return;
    }

    const userIds = subs.map((s) => s.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, xp_level")
      .in("id", userIds);

    set((state) => ({
      roomMembers: { ...state.roomMembers, [roomId]: profiles || [] },
    }));
  },

  // Set current room
  setCurrentRoom: (roomId) => {
    set({ currentRoomId: roomId });
  },

  // Get subscribed rooms
  getSubscribedRooms: () => {
    const { rooms, subscriptions } = get();
    const subscribedIds = new Set(subscriptions.map((s) => s.room_id));
    return rooms.filter((r) => subscribedIds.has(r.id));
  },

  // Get favorite rooms
  getFavoriteRooms: () => {
    const { rooms, subscriptions } = get();
    const favoriteIds = new Set(
      subscriptions.filter((s) => s.is_favorite).map((s) => s.room_id)
    );
    return rooms.filter((r) => favoriteIds.has(r.id));
  },

  // Get room with computed details
  getRoomWithDetails: (roomId: number) => {
    const { rooms, subscriptions, notifications, onlineCountByRoom } = get();
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return null;

    const subscription = subscriptions.find((s) => s.room_id === roomId);
    const unreadCount = notifications.filter(
      (n) => n.room_id === roomId && !n.is_read
    ).length;

    return {
      ...room,
      onlineCount: onlineCountByRoom[roomId] || 0,
      memberCount: subscriptions.filter((s) => s.room_id === roomId).length,
      isSubscribed: !!subscription,
      isFavorite: subscription?.is_favorite || false,
      unreadCount,
    };
  },

  // Get total unread count
  getUnreadCount: () => {
    const { notifications } = get();
    return notifications.filter((n) => !n.is_read).length;
  },

  // Subscribe to realtime updates
  subscribeToRealtime: (userId: string) => {
    const supabase = createClient();

    // Subscribe to notifications
    const notificationsChannel = supabase
      .channel("room-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          set((state) => ({
            notifications: [payload.new as RoomNotification, ...state.notifications],
          }));
        }
      )
      .subscribe();

    // Subscribe to presence changes for current room
    // Use debouncing to avoid multiple fetches on rapid presence changes
    let presenceDebounceTimer: NodeJS.Timeout | null = null;

    const presenceChannel = supabase
      .channel("room-presence-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_presence",
        },
        async (payload) => {
          const { currentRoomId, rooms } = get();
          const newPresence = payload.new as RoomPresence;
          const oldPresence = payload.old as RoomPresence;
          const affectedRoomId = newPresence?.room_id || oldPresence?.room_id;

          // Only process if this affects the current room
          if (!currentRoomId || affectedRoomId !== currentRoomId) {
            return;
          }

          // Check if this is a new user joining (not yourself)
          if (
            payload.eventType === "INSERT" &&
            newPresence?.user_id !== userId
          ) {
            // Fetch the profile of the new member
            const { data: profile } = await supabase
              .from("profiles")
              .select("username, display_name")
              .eq("id", newPresence.user_id)
              .single();

            const room = rooms.find((r) => r.id === currentRoomId);
            if (profile && room) {
              const memberName = profile.display_name || profile.username || "Someone";
              notificationHelpers.memberJoinedRoom(memberName, room.name, currentRoomId);
            }
          }

          // Debounce presence fetches - wait 500ms before fetching to batch rapid changes
          if (presenceDebounceTimer) {
            clearTimeout(presenceDebounceTimer);
          }
          presenceDebounceTimer = setTimeout(() => {
            get().fetchRoomPresence(currentRoomId);
            presenceDebounceTimer = null;
          }, 500);
        }
      )
      .subscribe();

    // Return cleanup function
    return () => {
      if (presenceDebounceTimer) {
        clearTimeout(presenceDebounceTimer);
      }
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(presenceChannel);
    };
  },
}));
