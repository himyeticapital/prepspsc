"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { BuddyMatch, BuddyMessage, Profile } from "@/types/database.types";
import { notificationHelpers } from "@/stores/notification-store";
import { useGamificationStore } from "@/stores/gamification-store";

export interface BuddyCandidate {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  xp_points: number;
  xp_level: number;
  current_streak: number;
  total_minutes_all_time: number;
  profile_frame: string | null;
  exam_type: string | null;
  focus_areas: string[] | null;
  preparing_for: string[] | null;
  compatibility_score: number;
}

export interface MatchWithBuddy extends BuddyMatch {
  buddy: Pick<Profile, "id" | "username" | "full_name" | "avatar_url" | "bio" | "xp_level" | "current_streak" | "profile_frame">;
  lastMessage?: BuddyMessage | null;
  unreadCount: number;
}

export interface BuddyRequestWithSender {
  id: number;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  sender: Pick<Profile, "id" | "username" | "full_name" | "avatar_url" | "xp_level" | "current_streak" | "profile_frame" | "bio">;
}

interface BuddyState {
  // Data
  candidates: BuddyCandidate[];
  matches: MatchWithBuddy[];
  currentIndex: number;

  // Loading
  isLoading: boolean;
  isSwiping: boolean;
  isLoadingMatches: boolean;

  // Match celebration
  newMatch: { buddy: BuddyCandidate; matchId: number } | null;

  // Filters
  examFilter: string | null;
  setExamFilter: (exam: string | null) => void;

  // Chat
  activeMatchId: number | null;
  messages: BuddyMessage[];
  isLoadingMessages: boolean;

  // Requests
  incomingRequests: BuddyRequestWithSender[];
  isLoadingRequests: boolean;

  // Actions
  fetchCandidates: (userId: string) => Promise<void>;
  swipe: (userId: string, candidateId: string, direction: "like" | "pass") => Promise<void>;
  fetchMatches: (userId: string) => Promise<void>;
  setActiveMatch: (matchId: number | null) => void;
  fetchMessages: (matchId: number) => Promise<void>;
  sendMessage: (matchId: number, senderId: string, content: string) => Promise<void>;
  markRead: (matchId: number, userId: string) => Promise<void>;
  dismissMatch: () => void;
  subscribeToUpdates: (userId: string) => () => void;
  reset: () => void;

  // Request actions
  fetchRequests: (userId: string) => Promise<void>;
  respondToRequest: (requestId: number, action: "accept" | "decline", userId: string) => Promise<void>;
}

export const useBuddyStore = create<BuddyState>((set, get) => ({
  candidates: [],
  matches: [],
  currentIndex: 0,
  isLoading: false,
  isSwiping: false,
  isLoadingMatches: false,
  newMatch: null,
  activeMatchId: null,
  messages: [],
  isLoadingMessages: false,
  incomingRequests: [],
  isLoadingRequests: false,
  examFilter: null,

  setExamFilter: (exam) => set({ examFilter: exam }),

  fetchCandidates: async (userId: string) => {
    set({ isLoading: true });
    try {
      const supabase = createClient();
      const { examFilter } = get();
      const { data, error } = await supabase.rpc("get_buddy_candidates", {
        p_user_id: userId,
        p_limit: 20,
        p_exam_filter: examFilter,
      });
      if (error) throw error;
      set({ candidates: (data || []) as BuddyCandidate[], currentIndex: 0 });
    } catch (err) {
      console.error("Failed to fetch buddy candidates:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  swipe: async (userId: string, candidateId: string, direction: "like" | "pass") => {
    const { candidates, currentIndex } = get();
    set({ isSwiping: true });
    try {
      const res = await fetch("/api/buddy/swipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ swiped_id: candidateId, direction }),
      });

      if (!res.ok && res.status !== 409) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Swipe failed (${res.status})`);
      }

      if (res.ok) {
        const data = await res.json();
        if (data.matched) {
          const candidate = candidates[currentIndex];
          set({ newMatch: { buddy: candidate, matchId: data.matchId } });
          get().fetchMatches(userId);
        }
      }

      // Always advance to next card (even on 409 duplicate)
      set({ currentIndex: currentIndex + 1 });

      // Fetch more candidates if running low
      if (currentIndex + 5 >= candidates.length) {
        get().fetchCandidates(userId);
      }
    } catch (err) {
      console.error("Failed to record swipe:", err instanceof Error ? err.message : err);
    } finally {
      set({ isSwiping: false });
    }
  },

  fetchMatches: async (userId: string) => {
    set({ isLoadingMatches: true });
    try {
      const supabase = createClient();

      // Get all active matches
      const { data: matchesData, error } = await supabase
        .from("buddy_matches")
        .select("*")
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
        .eq("status", "active")
        .order("matched_at", { ascending: false });

      if (error) throw error;
      if (!matchesData?.length) {
        set({ matches: [] });
        return;
      }

      // Get buddy profiles
      const buddyIds = matchesData.map(m =>
        m.user_a_id === userId ? m.user_b_id : m.user_a_id
      );

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, bio, xp_level, current_streak, profile_frame")
        .in("id", buddyIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Get last message and unread count for each match
      const matchesWithDetails: MatchWithBuddy[] = await Promise.all(
        matchesData.map(async (m) => {
          const buddyId = m.user_a_id === userId ? m.user_b_id : m.user_a_id;
          const buddy = profileMap.get(buddyId);

          // Last message
          const { data: lastMsgData } = await supabase
            .from("buddy_messages")
            .select("*")
            .eq("match_id", m.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          // Unread count
          const { count } = await supabase
            .from("buddy_messages")
            .select("*", { count: "exact", head: true })
            .eq("match_id", m.id)
            .eq("is_read", false)
            .neq("sender_id", userId);

          return {
            ...m,
            buddy: buddy || { id: buddyId, username: null, full_name: "Unknown", avatar_url: null, bio: null, xp_level: 1, current_streak: 0, profile_frame: null },
            lastMessage: lastMsgData || null,
            unreadCount: count || 0,
          } as MatchWithBuddy;
        })
      );

      set({ matches: matchesWithDetails });
    } catch (err) {
      console.error("Failed to fetch matches:", err);
    } finally {
      set({ isLoadingMatches: false });
    }
  },

  setActiveMatch: (matchId: number | null) => {
    set({ activeMatchId: matchId, messages: [] });
    if (matchId) {
      get().fetchMessages(matchId);
    }
  },

  fetchMessages: async (matchId: number) => {
    set({ isLoadingMessages: true });
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("buddy_messages")
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      set({ messages: data || [] });
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  sendMessage: async (matchId: number, senderId: string, content: string) => {
    try {
      const supabase = createClient();

      // Check if this is the user's first message in this match
      const { count: existingCount } = await supabase
        .from("buddy_messages")
        .select("id", { count: "exact", head: true })
        .eq("match_id", matchId)
        .eq("sender_id", senderId);

      const isFirstMessage = existingCount === 0;

      const { error } = await supabase
        .from("buddy_messages")
        .insert({ match_id: matchId, sender_id: senderId, content });

      if (error) throw error;

      // Award XP for first message in this match
      if (isFirstMessage) {
        try {
          await useGamificationStore
            .getState()
            .awardXP(senderId, 10, "buddy_first_message", matchId.toString());
        } catch (xpErr) {
          console.error("Failed to award first message XP:", xpErr);
        }
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  },

  markRead: async (matchId: number, userId: string) => {
    try {
      const supabase = createClient();
      await supabase
        .from("buddy_messages")
        .update({ is_read: true })
        .eq("match_id", matchId)
        .eq("is_read", false)
        .neq("sender_id", userId);
    } catch (err) {
      console.error("Failed to mark messages read:", err);
    }
  },

  dismissMatch: () => {
    set({ newMatch: null });
  },

  fetchRequests: async (userId: string) => {
    set({ isLoadingRequests: true });
    try {
      const res = await fetch("/api/buddy/request");
      if (!res.ok) throw new Error("Failed to fetch requests");
      const data = await res.json();
      set({ incomingRequests: data.requests || [] });
    } catch (err) {
      console.error("Failed to fetch buddy requests:", err);
    } finally {
      set({ isLoadingRequests: false });
    }
  },

  respondToRequest: async (requestId: number, action: "accept" | "decline", userId: string) => {
    try {
      const res = await fetch("/api/buddy/request", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId, action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to respond to request");
      }
      // Remove from incoming requests list
      set((state) => ({
        incomingRequests: state.incomingRequests.filter((r) => r.id !== requestId),
      }));
      // If accepted, refresh matches
      if (action === "accept") {
        get().fetchMatches(userId);
      }
    } catch (err) {
      console.error("Failed to respond to buddy request:", err);
      throw err;
    }
  },

  subscribeToUpdates: (userId: string) => {
    const supabase = createClient();

    const channel = supabase
      .channel(`buddy-updates-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "buddy_matches" },
        (payload) => {
          const match = payload.new as BuddyMatch;
          if (match.user_a_id === userId || match.user_b_id === userId) {
            get().fetchMatches(userId);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "buddy_messages" },
        (payload) => {
          const msg = payload.new as BuddyMessage;
          const { activeMatchId, messages } = get();

          // If viewing this match's chat, add message
          if (activeMatchId === msg.match_id) {
            set({ messages: [...messages, msg] });
          }

          // Refresh matches list for unread counts
          get().fetchMatches(userId);

          // Trigger notification if message is from someone else
          if (msg.sender_id !== userId) {
            const match = get().matches.find(m => m.id === msg.match_id);
            if (match) {
              notificationHelpers.buddyMessage(
                match.buddy.full_name || match.buddy.username || "Study Buddy",
                msg.content.substring(0, 50),
                msg.match_id
              );
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "buddy_requests" },
        (payload) => {
          const request = payload.new as { receiver_id: string };
          if (request.receiver_id === userId) {
            get().fetchRequests(userId);
            notificationHelpers.buddyMessage("Study Buddy", "New buddy request!", 0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  reset: () => {
    set({
      candidates: [],
      matches: [],
      currentIndex: 0,
      isLoading: false,
      isSwiping: false,
      isLoadingMatches: false,
      newMatch: null,
      activeMatchId: null,
      messages: [],
      isLoadingMessages: false,
      incomingRequests: [],
      isLoadingRequests: false,
      examFilter: null,
    });
  },
}));
