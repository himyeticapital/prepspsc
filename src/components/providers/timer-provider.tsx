"use client";

import { useEffect, useRef } from "react";
import { useTimerStore } from "@/stores/timer-store";

/**
 * TimerProvider - Keeps the timer ticking across all page navigations.
 * This component should be placed in the root layout so the timer
 * continues running even when the timer widget is closed or the user
 * navigates to different pages.
 */
export function TimerProvider() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to store state
  const status = useTimerStore((state) => state.status);
  const tick = useTimerStore((state) => state.tick);
  const wasRunning = useTimerStore((state) => state.wasRunning);
  const lastTickTime = useTimerStore((state) => state.lastTickTime);

  // Handle timer resumption on mount (e.g., after page refresh)
  useEffect(() => {
    if (wasRunning && lastTickTime && status !== "running") {
      const now = Date.now();
      const elapsedWhileAway = Math.floor((now - lastTickTime) / 1000);

      // Only resume if less than 5 minutes have passed
      if (elapsedWhileAway < 300) {
        const store = useTimerStore.getState();
        const newElapsed = store.elapsedSeconds + elapsedWhileAway;

        // Update elapsed time and restart the timer
        useTimerStore.setState({
          elapsedSeconds: newElapsed,
          status: "running",
          lastTickTime: now,
          wasRunning: true,
        });
      } else {
        // Too much time passed, mark as paused
        useTimerStore.setState({
          wasRunning: false,
          lastTickTime: null,
        });
      }
    }
  }, []); // Run once on mount

  // Manage the interval based on status
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Start interval if timer is running
    if (status === "running") {
      intervalRef.current = setInterval(() => {
        tick();
      }, 1000);
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status, tick]);

  // This component doesn't render anything visible
  return null;
}
