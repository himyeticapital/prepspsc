"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UseSyncTestChannelOptions {
  challengeId: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  enabled: boolean;
}

interface UseSyncTestChannelReturn {
  buddyOnline: boolean;
  buddyAnswered: number;
  buddySubmitted: boolean;
  broadcastProgress: (answered: number, total: number) => void;
  broadcastSubmitted: (attemptId: number) => void;
}

export function useSyncTestChannel({
  challengeId,
  userId,
  userName,
  avatarUrl,
  enabled,
}: UseSyncTestChannelOptions): UseSyncTestChannelReturn {
  const [buddyOnline, setBuddyOnline] = useState(false);
  const [buddyAnswered, setBuddyAnswered] = useState(0);
  const [buddySubmitted, setBuddySubmitted] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();

    const channel = supabase.channel(`sync-test-${challengeId}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const otherUsers = Object.keys(state).filter((key) => key !== userId);
        setBuddyOnline(otherUsers.length > 0);
      })
      .on("broadcast", { event: "progress" }, (payload) => {
        if (payload.payload.user_id !== userId) {
          setBuddyAnswered(payload.payload.answered);
        }
      })
      .on("broadcast", { event: "submitted" }, (payload) => {
        if (payload.payload.user_id !== userId) {
          setBuddySubmitted(true);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId,
            full_name: userName,
            avatar_url: avatarUrl,
            joined_at: Date.now(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [challengeId, userId, userName, avatarUrl, enabled]);

  const broadcastProgress = useCallback(
    (answered: number, total: number) => {
      channelRef.current?.send({
        type: "broadcast",
        event: "progress",
        payload: { user_id: userId, answered, total },
      });
    },
    [userId]
  );

  const broadcastSubmitted = useCallback(
    (attemptId: number) => {
      channelRef.current?.send({
        type: "broadcast",
        event: "submitted",
        payload: { user_id: userId, attempt_id: attemptId },
      });
    },
    [userId]
  );

  return {
    buddyOnline,
    buddyAnswered,
    buddySubmitted,
    broadcastProgress,
    broadcastSubmitted,
  };
}
