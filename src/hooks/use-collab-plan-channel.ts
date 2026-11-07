"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CollabPlanFormParams {
  examType: string;
  durationWeeks: string;
  hoursPerDay: string;
  studySlots: string;
  focusAreas: string;
  startWithSubject: string;
}

export interface CollabPresenceUser {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  joined_at: number;
}

interface UseCollabPlanChannelOptions {
  sessionId: string;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  enabled: boolean;
}

interface UseCollabPlanChannelReturn {
  buddyOnline: boolean;
  buddyProfile: CollabPresenceUser | null;
  buddyFormParams: Partial<CollabPlanFormParams>;
  buddyLastField: keyof CollabPlanFormParams | null;
  buddyReady: boolean;
  myReady: boolean;
  receivedPlan: Record<string, unknown> | null;
  broadcastFormUpdate: (field: keyof CollabPlanFormParams, value: string, fullParams: CollabPlanFormParams) => void;
  broadcastReady: () => void;
  broadcastUnready: () => void;
  broadcastPlanGenerated: (plan: Record<string, unknown>) => void;
  broadcastCancelled: () => void;
  setMyReady: (v: boolean) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCollabPlanChannel({
  sessionId,
  userId,
  fullName,
  avatarUrl,
  enabled,
}: UseCollabPlanChannelOptions): UseCollabPlanChannelReturn {
  const [buddyOnline, setBuddyOnline] = useState(false);
  const [buddyProfile, setBuddyProfile] = useState<CollabPresenceUser | null>(null);
  const [buddyFormParams, setBuddyFormParams] = useState<Partial<CollabPlanFormParams>>({});
  const [buddyLastField, setBuddyLastField] = useState<keyof CollabPlanFormParams | null>(null);
  const [buddyReady, setBuddyReady] = useState(false);
  const [myReady, setMyReady] = useState(false);
  const [receivedPlan, setReceivedPlan] = useState<Record<string, unknown> | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !sessionId) return;

    const supabase = createClient();

    const channel = supabase.channel(`collab-plan-${sessionId}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<CollabPresenceUser>();
        const otherKeys = Object.keys(state).filter((k) => k !== userId);
        setBuddyOnline(otherKeys.length > 0);
        if (otherKeys.length > 0) {
          const entries = state[otherKeys[0]];
          if (entries && entries.length > 0) setBuddyProfile(entries[0]);
        } else {
          setBuddyProfile(null);
        }
      })
      .on("broadcast", { event: "form_update" }, (msg) => {
        const payload = msg.payload as { user_id: string; field: keyof CollabPlanFormParams; full_params: CollabPlanFormParams };
        if (payload.user_id === userId) return;
        setBuddyFormParams(payload.full_params);
        setBuddyLastField(payload.field);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setBuddyLastField(null), 2000);
      })
      .on("broadcast", { event: "user_ready" }, (msg) => {
        const payload = msg.payload as { user_id: string; ready: boolean };
        if (payload.user_id === userId) return;
        setBuddyReady(payload.ready);
      })
      .on("broadcast", { event: "plan_generated" }, (msg) => {
        const payload = msg.payload as { plan: Record<string, unknown> };
        setReceivedPlan(payload.plan);
      })
      .on("broadcast", { event: "cancelled" }, (msg) => {
        const payload = msg.payload as { user_id: string };
        if (payload.user_id === userId) return;
        setReceivedPlan(null);
        setBuddyReady(false);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId,
            full_name: fullName,
            avatar_url: avatarUrl,
            joined_at: Date.now(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId, userId, fullName, avatarUrl, enabled]);

  const broadcastFormUpdate = useCallback(
    (field: keyof CollabPlanFormParams, value: string, fullParams: CollabPlanFormParams) => {
      channelRef.current?.send({
        type: "broadcast",
        event: "form_update",
        payload: { user_id: userId, field, value, full_params: fullParams },
      });
    },
    [userId]
  );

  const broadcastReady = useCallback(() => {
    setMyReady(true);
    channelRef.current?.send({
      type: "broadcast",
      event: "user_ready",
      payload: { user_id: userId, ready: true },
    });
  }, [userId]);

  const broadcastUnready = useCallback(() => {
    setMyReady(false);
    channelRef.current?.send({
      type: "broadcast",
      event: "user_ready",
      payload: { user_id: userId, ready: false },
    });
  }, [userId]);

  const broadcastPlanGenerated = useCallback(
    (plan: Record<string, unknown>) => {
      channelRef.current?.send({
        type: "broadcast",
        event: "plan_generated",
        payload: { plan },
      });
    },
    []
  );

  const broadcastCancelled = useCallback(() => {
    channelRef.current?.send({
      type: "broadcast",
      event: "cancelled",
      payload: { user_id: userId },
    });
  }, [userId]);

  return {
    buddyOnline,
    buddyProfile,
    buddyFormParams,
    buddyLastField,
    buddyReady,
    myReady,
    receivedPlan,
    broadcastFormUpdate,
    broadcastReady,
    broadcastUnready,
    broadcastPlanGenerated,
    broadcastCancelled,
    setMyReady,
  };
}
