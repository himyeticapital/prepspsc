"use client";

import { useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { notificationHelpers } from "@/stores/notification-store";

const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const LAST_CHECK_KEY = "study-ai-last-revision-check";
const NOTIFIED_GOALS_KEY = "study-ai-notified-goals";

export function useRevisionChecker(userId?: string) {
  const checkInProgressRef = useRef(false);

  const checkDueRevisions = useCallback(async () => {
    if (!userId || checkInProgressRef.current) return;

    // Prevent double-checking within 1 minute
    const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
    if (lastCheck) {
      const timeSinceLastCheck = Date.now() - parseInt(lastCheck);
      if (timeSinceLastCheck < 60000) return; // 1 minute cooldown
    }

    checkInProgressRef.current = true;

    try {
      const supabase = createClient();
      const now = new Date().toISOString();

      // Fetch goals due for revision
      const { data: dueGoals, error } = await supabase
        .from("study_ai_goals")
        .select("id, goal_text")
        .eq("user_id", userId)
        .eq("is_archived", false)
        .lte("next_revision_at", now)
        .order("next_revision_at", { ascending: true })
        .limit(10);

      if (error || !dueGoals || dueGoals.length === 0) {
        localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
        return;
      }

      // Get previously notified goals (to avoid spamming)
      const notifiedGoalsStr = localStorage.getItem(NOTIFIED_GOALS_KEY);
      const notifiedGoals: { [key: number]: number } = notifiedGoalsStr
        ? JSON.parse(notifiedGoalsStr)
        : {};

      // Clean up old entries (older than 24 hours)
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      Object.keys(notifiedGoals).forEach((key) => {
        if (notifiedGoals[parseInt(key)] < oneDayAgo) {
          delete notifiedGoals[parseInt(key)];
        }
      });

      // Find goals that haven't been notified recently
      const newDueGoals = dueGoals.filter(
        (goal) => !notifiedGoals[goal.id]
      );

      if (newDueGoals.length > 0) {
        // Trigger notification for the first due goal
        const firstGoal = newDueGoals[0];
        notificationHelpers.revisionDue(
          firstGoal.goal_text,
          firstGoal.id,
          newDueGoals.length
        );

        // Mark all new due goals as notified
        newDueGoals.forEach((goal) => {
          notifiedGoals[goal.id] = Date.now();
        });

        localStorage.setItem(NOTIFIED_GOALS_KEY, JSON.stringify(notifiedGoals));
      }

      localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
    } catch (error) {
      console.error("Error checking due revisions:", error);
    } finally {
      checkInProgressRef.current = false;
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    // Check immediately on mount
    checkDueRevisions();

    // Set up interval for periodic checks
    const intervalId = setInterval(checkDueRevisions, CHECK_INTERVAL);

    // Check when window becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkDueRevisions();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [userId, checkDueRevisions]);

  return { checkDueRevisions };
}
