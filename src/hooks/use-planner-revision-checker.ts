"use client";

import { useEffect, useCallback, useRef } from "react";
import { notificationHelpers } from "@/stores/notification-store";

const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const LAST_CHECK_KEY = "planner-last-revision-check";
const NOTIFIED_REVIEWS_KEY = "planner-notified-reviews";

export function usePlannerRevisionChecker(userId?: string) {
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
      // Fetch due reviews from API
      const response = await fetch("/api/study-ai/planner-revision/due");
      if (!response.ok) {
        localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
        return;
      }

      const data = await response.json();
      const dueTopics = data.dueTopics || [];

      if (dueTopics.length === 0) {
        localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
        return;
      }

      // Get previously notified reviews (to avoid spamming)
      const notifiedReviewsStr = localStorage.getItem(NOTIFIED_REVIEWS_KEY);
      const notifiedReviews: { [key: number]: number } = notifiedReviewsStr
        ? JSON.parse(notifiedReviewsStr)
        : {};

      // Clean up old entries (older than 24 hours)
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      Object.keys(notifiedReviews).forEach((key) => {
        if (notifiedReviews[parseInt(key)] < oneDayAgo) {
          delete notifiedReviews[parseInt(key)];
        }
      });

      // Find reviews that haven't been notified recently
      const newDueReviews = dueTopics.filter(
        (review: any) => !notifiedReviews[review.id]
      );

      if (newDueReviews.length > 0) {
        // Trigger notification for the first due review
        const firstReview = newDueReviews[0];
        notificationHelpers.plannerRevisionDue(
          firstReview.subject,
          firstReview.topics || [],
          firstReview.id,
          newDueReviews.length
        );

        // Mark all new due reviews as notified
        newDueReviews.forEach((review: any) => {
          notifiedReviews[review.id] = Date.now();
        });

        localStorage.setItem(NOTIFIED_REVIEWS_KEY, JSON.stringify(notifiedReviews));
      }

      localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
    } catch (error) {
      console.error("Error checking planner due revisions:", error);
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
