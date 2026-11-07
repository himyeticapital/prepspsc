"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useBuddyStore } from "@/stores/buddy-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Loader2, BarChart3, Swords, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { BuddyComparison } from "./buddy-comparison";
import { BuddyChallenge } from "./buddy-challenge";

interface BuddyChatProps {
  matchId: number;
  userId: string;
  onBack: () => void;
}

export function BuddyChat({ matchId, userId, onBack }: BuddyChatProps) {
  const [input, setInput] = useState("");
  const [showComparison, setShowComparison] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState<{
    id: number;
    test_id: number;
    mode: "sync" | "async";
    status: string;
    challenger_id: string;
    challenged_id: string;
    challenger_attempt_id: number | null;
    challenged_attempt_id: number | null;
  } | null>(null);
  const [respondingToChallenge, setRespondingToChallenge] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const {
    messages,
    isLoadingMessages,
    sendMessage,
    markRead,
    matches,
    fetchMessages,
  } = useBuddyStore();

  const match = matches.find((m) => m.id === matchId);
  const buddy = match?.buddy;

  useEffect(() => {
    fetchMessages(matchId);
    markRead(matchId, userId);
  }, [matchId, userId, fetchMessages, markRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark new messages as read when they arrive
  useEffect(() => {
    if (messages.some((m) => m.sender_id !== userId && !m.is_read)) {
      markRead(matchId, userId);
    }
  }, [messages, matchId, userId, markRead]);

  // Fetch active challenge for this match
  useEffect(() => {
    const fetchChallenge = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("buddy_challenges")
        .select("id, test_id, mode, status, challenger_id, challenged_id, challenger_attempt_id, challenged_attempt_id")
        .eq("match_id", matchId)
        .in("status", ["pending", "accepted"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setActiveChallenge(data);
    };
    fetchChallenge();
  }, [matchId, messages]);

  // Subscribe to buddy_challenges realtime for sync mode
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`challenge-${matchId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "buddy_challenges",
        filter: `match_id=eq.${matchId}`,
      }, (payload) => {
        const updated = payload.new as any;
        setActiveChallenge(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev);

        // Sync mode: auto-navigate when challenge is accepted and I'm the challenger
        if (updated.status === "accepted" && updated.mode === "sync" && updated.challenger_id === userId) {
          router.push(`/test/${updated.test_id}?challenge=${updated.id}`);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId, userId, router]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendMessage(matchId, userId, text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCreateRoom = async () => {
    try {
      const res = await fetch("/api/buddy/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create room");
      }

      const data = await res.json();
      if (!data.existing) {
        toast.success("Study room created!");
      }
      router.push(`/room/${data.roomId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create room";
      toast.error(message);
    }
  };

  const handleAcceptChallenge = async () => {
    if (!activeChallenge) return;
    setRespondingToChallenge(true);
    try {
      const res = await fetch("/api/buddy/challenge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: activeChallenge.id, action: "accept" }),
      });
      if (res.ok) {
        setActiveChallenge(prev => prev ? { ...prev, status: "accepted" } : null);
        // Sync mode: navigate immediately
        if (activeChallenge.mode === "sync") {
          router.push(`/test/${activeChallenge.test_id}?challenge=${activeChallenge.id}`);
        }
      }
    } catch {
      toast.error("Failed to accept challenge");
    } finally {
      setRespondingToChallenge(false);
    }
  };

  const handleDeclineChallenge = async () => {
    if (!activeChallenge) return;
    setRespondingToChallenge(true);
    try {
      await fetch("/api/buddy/challenge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: activeChallenge.id, action: "decline" }),
      });
      setActiveChallenge(null);
    } catch {
      toast.error("Failed to decline challenge");
    } finally {
      setRespondingToChallenge(false);
    }
  };

  const handleTakeTest = () => {
    if (!activeChallenge) return;
    router.push(`/test/${activeChallenge.test_id}?challenge=${activeChallenge.id}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-white/10">
        <button onClick={onBack} className="text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        {buddy?.avatar_url ? (
          <img src={buddy.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
            {(buddy?.full_name || "?")[0].toUpperCase()}
          </div>
        )}
        <div>
          <h3 className="text-sm font-medium text-white">
            {buddy?.full_name || buddy?.username || "Study Buddy"}
          </h3>
          <p className="text-[10px] text-zinc-500">
            Lv.{buddy?.xp_level || 1}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10">
        <button
          onClick={() => setShowComparison(!showComparison)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
            showComparison
              ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
              : "bg-zinc-800 text-zinc-400 hover:text-white"
          )}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Compare
        </button>
        <button
          onClick={() => setShowChallenge(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          <Swords className="w-3.5 h-3.5" />
          Challenge
        </button>
        <button
          onClick={handleCreateRoom}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          <Users className="w-3.5 h-3.5" />
          Study Room
        </button>
      </div>

      {/* Comparison Widget */}
      {showComparison && match && (
        <BuddyComparison
          userId={userId}
          buddyId={match.buddy.id}
          onClose={() => setShowComparison(false)}
        />
      )}

      {/* Challenge Dialog */}
      {showChallenge && (
        <BuddyChallenge
          matchId={matchId}
          userId={userId}
          buddyName={buddy?.full_name || buddy?.username || "Buddy"}
          onClose={() => setShowChallenge(false)}
          onChallengeSent={() => {
            setShowChallenge(false);
            toast.success("Challenge sent!");
          }}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-zinc-500 text-sm">No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === userId;
            const isChallenge = msg.content.startsWith("\u{1F3C6} Challenge!");
            const isChallengeAccepted = msg.content.startsWith("\u2705 Challenge accepted!");
            const isChallengeDeclined = msg.content.startsWith("\u274C Challenge declined");
            const isChallengeComplete = msg.content.startsWith("\u{1F3C6} Challenge complete!");
            const isStudyRoom = msg.content.startsWith("\u{1F4DA} I created a private study room");
            const isSystemMessage = isChallenge || isChallengeAccepted || isChallengeDeclined || isChallengeComplete || isStudyRoom;

            if (isSystemMessage) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-zinc-800/80 border border-orange-500/20 text-sm">
                    <p className="text-zinc-200 break-words">{msg.content}</p>

                    {/* Show Accept/Decline for pending challenges (only for challenged user) */}
                    {isChallenge && activeChallenge?.status === "pending" && activeChallenge?.challenged_id === userId && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={handleAcceptChallenge}
                          disabled={respondingToChallenge}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
                        >
                          {respondingToChallenge ? "..." : "Accept"}
                        </button>
                        <button
                          onClick={handleDeclineChallenge}
                          disabled={respondingToChallenge}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-zinc-700 text-zinc-300 hover:bg-zinc-600 disabled:opacity-50 transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    )}

                    {/* Show Take Test button for accepted challenges */}
                    {isChallengeAccepted && activeChallenge?.status === "accepted" && (
                      <button
                        onClick={handleTakeTest}
                        className="w-full mt-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                      >
                        {activeChallenge.mode === "sync" ? "Start Test Now!" : "Take Test"}
                      </button>
                    )}

                    {/* Show Join Room button for study room messages */}
                    {isStudyRoom && (() => {
                      const roomMatch = msg.content.match(/\/room\/(\d+)/);
                      return roomMatch ? (
                        <button
                          onClick={() => router.push(`/room/${roomMatch[1]}`)}
                          className="w-full mt-3 py-1.5 rounded-lg text-xs font-semibold bg-pink-500 text-white hover:bg-pink-600 transition-colors"
                        >
                          Join Study Room
                        </button>
                      ) : null;
                    })()}

                    <p className="text-[10px] text-zinc-500 mt-1.5">
                      {new Date(msg.created_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                    isMine
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-zinc-800 text-zinc-200 rounded-bl-md"
                  )}
                >
                  <p className="break-words">{msg.content}</p>
                  <p className={cn(
                    "text-[10px] mt-1",
                    isMine ? "text-primary-foreground/60" : "text-zinc-500"
                  )}>
                    {new Date(msg.created_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim()}
            size="icon"
            className="shrink-0 bg-primary hover:bg-primary/90"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
