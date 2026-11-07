"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSyncTestChannel } from "@/hooks/use-sync-test-channel";
import { Loader2, CheckCircle2 } from "lucide-react";


interface SyncTestWaitingProps {
  challengeId: number;
  userId: string;
  attemptId: number;
  onBothComplete: () => void;
  onSkipWaiting: () => void;
}

interface BuddyProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export function SyncTestWaiting({
  challengeId,
  userId,
  attemptId,
  onBothComplete,
  onSkipWaiting,
}: SyncTestWaitingProps) {
  const [buddyProfile, setBuddyProfile] = useState<BuddyProfile | null>(null);
  const [showFinished, setShowFinished] = useState(false);
  const [totalQuestions, setTotalQuestions] = useState(0);

  // Fetch challenge and buddy profile
  useEffect(() => {
    async function fetchChallengeAndBuddy() {
      const supabase = createClient();

      const { data: challenge, error: challengeError } = await supabase
        .from("buddy_challenges")
        .select("challenger_id, challenged_id, test_id")
        .eq("id", challengeId)
        .single();

      if (challengeError || !challenge) {
        console.error("Failed to fetch challenge:", challengeError);
        return;
      }

      const buddyId =
        challenge.challenger_id === userId
          ? challenge.challenged_id
          : challenge.challenger_id;

      // Fetch buddy profile and test question count in parallel
      const [profileResult, testResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("id", buddyId)
          .single(),
        supabase
          .from("test_questions")
          .select("id", { count: "exact", head: true })
          .eq("test_id", challenge.test_id),
      ]);

      if (profileResult.data) {
        setBuddyProfile(profileResult.data);
      }

      if (testResult.count !== null) {
        setTotalQuestions(testResult.count);
      }
    }

    fetchChallengeAndBuddy();
  }, [challengeId, userId]);

  const { buddyOnline, buddyAnswered, buddySubmitted } = useSyncTestChannel({
    challengeId,
    userId,
    userName: "Me",
    avatarUrl: null,
    enabled: !!buddyProfile,
  });

  // Subscribe to postgres_changes on buddy_challenges as backup detection
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`challenge-status-${challengeId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "buddy_challenges",
          filter: `id=eq.${challengeId}`,
        },
        (payload) => {
          if (payload.new.status === "completed") {
            setShowFinished(true);
            setTimeout(() => onBothComplete(), 500);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [challengeId, onBothComplete]);

  // When buddy submits via realtime broadcast
  useEffect(() => {
    if (buddySubmitted && !showFinished) {
      setShowFinished(true);
      setTimeout(() => onBothComplete(), 500);
    }
  }, [buddySubmitted, showFinished, onBothComplete]);

  const progressPercent =
    totalQuestions > 0 ? (buddyAnswered / totalQuestions) * 100 : 0;

  const buddyName = buddyProfile?.full_name || "your buddy";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 w-full max-w-sm text-center">
        {showFinished ? (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-1">
              {buddyName} finished!
            </h2>
            <p className="text-sm text-zinc-400">
              Loading results...
            </p>
          </>
        ) : (
          <>
            {/* Animated loader */}
            <div className="mb-6">
              <Loader2 className="w-12 h-12 text-orange-500 mx-auto animate-spin" />
            </div>

            {/* Waiting text */}
            <h2 className="text-lg font-semibold text-white mb-1">
              Waiting for {buddyName}...
            </h2>

            {/* Buddy online/offline status */}
            {!buddyOnline && buddyProfile && (
              <p className="text-xs text-red-400 mb-4">
                Buddy went offline
              </p>
            )}

            {/* Progress bar */}
            {totalQuestions > 0 && (
              <div className="mt-4 mb-2">
                <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-orange-500 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-sm text-zinc-400 mt-2">
                  {buddyAnswered}/{totalQuestions} answering questions
                </p>
              </div>
            )}

            {/* Skip button */}
            <button
              onClick={onSkipWaiting}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-xl px-6 py-2.5 mt-6 transition-colors"
            >
              View My Results Now
            </button>

            {/* Extra skip hint if buddy offline */}
            {!buddyOnline && buddyProfile && (
              <p className="text-[11px] text-zinc-600 mt-2">
                You can view your results without waiting
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
