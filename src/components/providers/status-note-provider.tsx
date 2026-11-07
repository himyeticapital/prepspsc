"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useStatusNoteStore } from "@/stores/status-note-store";

export function StatusNoteProvider() {
  const { user } = useAuthStore();
  const { fetchMyNote, subscribeToRealtime, clearExpiredFromCache } =
    useStatusNoteStore();
  const cleanupRef = useRef<(() => void) | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;

    fetchMyNote(user.id);
    cleanupRef.current = subscribeToRealtime();

    // Prune expired notes from cache every 60 seconds
    intervalRef.current = setInterval(clearExpiredFromCache, 60_000);

    return () => {
      cleanupRef.current?.();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return null;
}
