"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Swords, Zap, Clock, Check, X, Loader2, Play } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

interface RoomChallengeStatusProps {
  challengeId: number;
  roomId: number;
  userId: string;
}

interface ChallengeData {
  id: number;
  room_id: number;
  creator_id: string;
  test_id: number;
  mode: "sync" | "async";
  status: "pending" | "active" | "completed" | "cancelled";
  test_title: string;
}

interface ParticipantData {
  id: number;
  challenge_id: number;
  user_id: string;
  status: "pending" | "accepted" | "declined" | "completed";
  attempt_id: number | null;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  score: number | null;
  total_marks: number | null;
}

const statusBadge: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
  accepted: { label: "Accepted", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  declined: { label: "Declined", className: "bg-red-500/10 text-red-400 border-red-500/20" },
  completed: { label: "Completed", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
};

export function RoomChallengeStatus({
  challengeId,
  roomId,
  userId,
}: RoomChallengeStatusProps) {
  const router = useRouter();
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResponding, setIsResponding] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  // Fetch challenge + participants
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        // Fetch challenge with test title
        const { data: challengeData, error: cError } = await supabase
          .from("room_challenges")
          .select("id, room_id, creator_id, test_id, mode, status, tests:test_id(title)")
          .eq("id", challengeId)
          .single();

        if (cError || !challengeData) {
          console.error("Failed to fetch challenge:", cError);
          return;
        }

        const testTitle =
          (challengeData as any).tests?.title || "Unknown Test";

        setChallenge({
          id: challengeData.id,
          room_id: challengeData.room_id,
          creator_id: challengeData.creator_id,
          test_id: challengeData.test_id,
          mode: challengeData.mode,
          status: challengeData.status,
          test_title: testTitle,
        });

        // Fetch participants with profiles
        const { data: participantsData, error: pError } = await supabase
          .from("room_challenge_participants")
          .select("id, challenge_id, user_id, status, attempt_id, profiles:user_id(full_name, username, avatar_url)")
          .eq("challenge_id", challengeId);

        if (pError) {
          console.error("Failed to fetch participants:", pError);
          return;
        }

        // Collect attempt IDs for completed participants to fetch scores
        const attemptIds = (participantsData || [])
          .filter((p) => p.attempt_id !== null)
          .map((p) => p.attempt_id as number);

        let scoresMap = new Map<number, { score: number; total_marks: number }>();

        if (attemptIds.length > 0) {
          const { data: attempts } = await supabase
            .from("test_attempts")
            .select("id, score, total_marks")
            .in("id", attemptIds);

          (attempts || []).forEach((a) => {
            scoresMap.set(a.id, {
              score: a.score ?? 0,
              total_marks: a.total_marks ?? 0,
            });
          });
        }

        const enriched: ParticipantData[] = (participantsData || []).map((p) => {
          const profile = (p as any).profiles;
          const scores = p.attempt_id ? scoresMap.get(p.attempt_id) : null;
          return {
            id: p.id,
            challenge_id: p.challenge_id,
            user_id: p.user_id,
            status: p.status,
            attempt_id: p.attempt_id,
            full_name: profile?.full_name || null,
            username: profile?.username || null,
            avatar_url: profile?.avatar_url || null,
            score: scores?.score ?? null,
            total_marks: scores?.total_marks ?? null,
          };
        });

        setParticipants(enriched);
      } catch (err) {
        console.error("Error loading challenge status:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [supabase, challengeId]);

  // Subscribe to realtime changes on room_challenge_participants
  useEffect(() => {
    const channel = supabase
      .channel(`room-challenge-${challengeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_challenge_participants",
          filter: `challenge_id=eq.${challengeId}`,
        },
        async (payload) => {
          const updated = payload.new as any;

          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            // Re-fetch profile for this participant
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, username, avatar_url")
              .eq("id", updated.user_id)
              .single();

            let score: number | null = null;
            let totalMarks: number | null = null;

            if (updated.attempt_id) {
              const { data: attempt } = await supabase
                .from("test_attempts")
                .select("score, total_marks")
                .eq("id", updated.attempt_id)
                .single();
              score = attempt?.score ?? null;
              totalMarks = attempt?.total_marks ?? null;
            }

            setParticipants((prev) => {
              const idx = prev.findIndex((p) => p.id === updated.id);
              const newP: ParticipantData = {
                id: updated.id,
                challenge_id: updated.challenge_id,
                user_id: updated.user_id,
                status: updated.status,
                attempt_id: updated.attempt_id,
                full_name: profile?.full_name || null,
                username: profile?.username || null,
                avatar_url: profile?.avatar_url || null,
                score,
                total_marks: totalMarks,
              };

              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = newP;
                return copy;
              }
              return [...prev, newP];
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "room_challenges",
          filter: `id=eq.${challengeId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setChallenge((prev) =>
            prev ? { ...prev, status: updated.status } : prev
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, challengeId]);

  const myParticipant = participants.find((p) => p.user_id === userId);

  const handleAcceptDecline = async (action: "accept" | "decline") => {
    setIsResponding(true);
    try {
      const res = await fetch("/api/room/challenge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId, action }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to ${action} challenge`);
      }

      toast.success(action === "accept" ? "Challenge accepted!" : "Challenge declined");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setIsResponding(false);
    }
  };

  const handleTakeTest = () => {
    if (!challenge) return;
    router.push(`/test/${challenge.test_id}?room_challenge=${challengeId}`);
  };

  if (isLoading) {
    return (
      <div className="widget-glass rounded-2xl border border-orange-500/20 p-4">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
        </div>
      </div>
    );
  }

  if (!challenge) return null;

  return (
    <div className="widget-glass rounded-2xl border border-orange-500/20 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-orange-400" />
          <span className="text-xs font-semibold text-white">Group Challenge</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-medium border",
              challenge.mode === "sync"
                ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                : "bg-blue-500/10 text-blue-400 border-blue-500/20"
            )}
          >
            {challenge.mode === "sync" ? (
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Sync
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Async
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Test Title */}
      <div className="px-4 py-2 border-b border-white/5">
        <p className="text-sm font-medium text-zinc-200 truncate">
          {challenge.test_title}
        </p>
        <p className="text-[10px] text-zinc-500 mt-0.5">
          {challenge.status === "completed" ? "Challenge completed" : "Challenge in progress"}
        </p>
      </div>

      {/* Participant List */}
      <div className="px-3 py-2 space-y-1.5 max-h-48 overflow-y-auto">
        {participants.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-zinc-800/30"
          >
            <Avatar className="w-6 h-6">
              <AvatarImage src={p.avatar_url || ""} />
              <AvatarFallback className="text-[9px]">
                {getInitials(p.full_name || p.username)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-zinc-300 flex-1 truncate">
              {p.user_id === userId
                ? "You"
                : p.full_name || p.username || "Anonymous"}
            </span>
            <div className="flex items-center gap-1.5">
              {p.status === "completed" && p.score !== null && (
                <span className="text-[10px] text-emerald-400 font-medium">
                  {p.score}/{p.total_marks}
                </span>
              )}
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full border font-medium",
                  statusBadge[p.status]?.className || statusBadge.pending.className
                )}
              >
                {statusBadge[p.status]?.label || p.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      {myParticipant && (
        <div className="px-4 py-3 border-t border-white/5">
          {/* Pending: show Accept/Decline */}
          {myParticipant.status === "pending" && (
            <div className="flex gap-2">
              <button
                onClick={() => handleAcceptDecline("accept")}
                disabled={isResponding}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isResponding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Accept
              </button>
              <button
                onClick={() => handleAcceptDecline("decline")}
                disabled={isResponding}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isResponding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <X className="w-3.5 h-3.5" />
                )}
                Decline
              </button>
            </div>
          )}

          {/* Accepted + challenge active: show Take Test */}
          {myParticipant.status === "accepted" &&
            (challenge.status === "active" || challenge.status === "pending") && (
              <button
                onClick={handleTakeTest}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-all active:scale-[0.98]"
              >
                <Play className="w-4 h-4" />
                Take Test
              </button>
            )}

          {/* Completed: show done message */}
          {myParticipant.status === "completed" && (
            <div className="text-center text-xs text-emerald-400 font-medium py-1">
              <Check className="w-3.5 h-3.5 inline mr-1" />
              You completed this challenge
              {myParticipant.score !== null && (
                <span className="ml-1">
                  ({myParticipant.score}/{myParticipant.total_marks})
                </span>
              )}
            </div>
          )}

          {/* Declined: show declined message */}
          {myParticipant.status === "declined" && (
            <div className="text-center text-xs text-zinc-500 py-1">
              You declined this challenge
            </div>
          )}
        </div>
      )}
    </div>
  );
}
