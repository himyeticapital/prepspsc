"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useTestStore } from "@/stores/test-store";
import { useSyncTestChannel } from "@/hooks/use-sync-test-channel";
import { Wifi, WifiOff, CheckCircle2 } from "lucide-react";


interface SyncTestOverlayProps {
  challengeId: number;
  userId: string;
  totalQuestions: number;
}

interface BuddyProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export function SyncTestOverlay({
  challengeId,
  userId,
  totalQuestions,
}: SyncTestOverlayProps) {
  const [buddyProfile, setBuddyProfile] = useState<BuddyProfile | null>(null);
  const [isSyncMode, setIsSyncMode] = useState<boolean | null>(null);

  // Fetch challenge and buddy profile
  useEffect(() => {
    async function fetchChallengeAndBuddy() {
      const supabase = createClient();

      const { data: challenge, error: challengeError } = await supabase
        .from("buddy_challenges")
        .select("challenger_id, challenged_id, mode")
        .eq("id", challengeId)
        .single();

      if (challengeError || !challenge) {
        console.error("Failed to fetch challenge:", challengeError);
        setIsSyncMode(false);
        return;
      }

      if (challenge.mode !== "sync") {
        setIsSyncMode(false);
        return;
      }

      setIsSyncMode(true);

      const buddyId =
        challenge.challenger_id === userId
          ? challenge.challenged_id
          : challenge.challenger_id;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", buddyId)
        .single();

      if (profileError || !profile) {
        console.error("Failed to fetch buddy profile:", profileError);
        return;
      }

      setBuddyProfile(profile);
    }

    fetchChallengeAndBuddy();
  }, [challengeId, userId]);

  const { buddyOnline, buddyAnswered, buddySubmitted, broadcastProgress } =
    useSyncTestChannel({
      challengeId,
      userId,
      userName: "Me",
      avatarUrl: null,
      enabled: !!buddyProfile,
    });

  // Watch test store answers and broadcast progress changes
  const answers = useTestStore((s) => s.answers);
  const prevCountRef = useRef(0);

  useEffect(() => {
    const count = Object.keys(answers).filter(
      (k) => answers[parseInt(k)]
    ).length;
    if (count !== prevCountRef.current) {
      prevCountRef.current = count;
      broadcastProgress(count, totalQuestions);
    }
  }, [answers, totalQuestions, broadcastProgress]);

  // Don't render for non-sync or while loading
  if (isSyncMode === null || isSyncMode === false || !buddyProfile) {
    return null;
  }

  const progressPercent =
    totalQuestions > 0 ? (buddyAnswered / totalQuestions) * 100 : 0;

  const avatarFallback = buddyProfile.full_name?.charAt(0)?.toUpperCase() || "?";

  return (
    <>
      {/* Desktop version */}
      <AnimatePresence>
        <motion.div
          initial={{ x: 80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed top-24 right-4 z-30 w-52 hidden sm:block"
        >
          <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl">
            {/* Header: Avatar + Name */}
            <div className="flex items-center gap-2 mb-2">
              {buddyProfile.avatar_url ? (
                <img
                  src={buddyProfile.avatar_url}
                  alt={buddyProfile.full_name}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {avatarFallback}
                </div>
              )}
              <span className="text-sm font-medium text-white truncate">
                {buddyProfile.full_name}
              </span>
            </div>

            {/* Status line */}
            <div className="flex items-center gap-1.5 mb-2">
              {buddySubmitted ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  <span className="text-[11px] text-emerald-400">
                    Finished!
                  </span>
                </>
              ) : buddyOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  <span className="text-[11px] text-zinc-400">
                    Taking test...
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-red-400 flex-shrink-0" />
                  <span className="text-[11px] text-red-400">
                    Went offline
                  </span>
                </>
              )}
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-orange-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Progress text */}
            <p className="text-[10px] text-zinc-500 mt-1">
              {buddyAnswered}/{totalQuestions} answered
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Mobile compact version */}
      <AnimatePresence>
        <motion.div
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed top-24 right-3 z-30 sm:hidden"
        >
          <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-xl p-2 shadow-2xl flex items-center gap-2">
            {buddyProfile.avatar_url ? (
              <img
                src={buddyProfile.avatar_url}
                alt={buddyProfile.full_name}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {avatarFallback}
              </div>
            )}
            <span className="text-[11px] text-zinc-400 font-medium">
              {buddyAnswered}/{totalQuestions}
            </span>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
