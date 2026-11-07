"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Users, X } from "lucide-react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import { CollabPlanModal, type ExamTypeOption, type CollabBuddyInfo } from "./collab-plan-modal";
import type { Profile } from "@/types/database.types";

interface RoomMember {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface BuddyMatch {
  id: number;
  user_a_id: string;
  user_b_id: string;
  buddy: RoomMember;
}

interface CollabPlanEntryFromRoomProps {
  roomId: number;
  userId: string;
  userProfile?: Profile | null;
  onClose: () => void;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

export function CollabPlanEntryFromRoom({
  roomId,
  userId,
  userProfile,
  onClose,
}: CollabPlanEntryFromRoomProps) {
  const [buddiesInRoom, setBuddiesInRoom] = useState<BuddyMatch[]>([]);
  const [examTypes, setExamTypes] = useState<ExamTypeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedBuddy, setSelectedBuddy] = useState<BuddyMatch | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();

      // Get room members (online in this room)
      const { data: presence } = await supabase
        .from("room_presence")
        .select("user_id, profiles:user_id(id, full_name, username, avatar_url)")
        .eq("room_id", roomId)
        .neq("user_id", userId);

      const memberIds = (presence || []).map((p) => p.user_id).filter(Boolean);

      if (memberIds.length === 0) {
        setIsLoading(false);
        return;
      }

      // Get active buddy matches that overlap with room members
      const { data: matches } = await supabase
        .from("buddy_matches")
        .select("id, user_a_id, user_b_id")
        .eq("status", "active")
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

      const buddyMatchesInRoom: BuddyMatch[] = [];
      for (const match of matches || []) {
        const buddyId = match.user_a_id === userId ? match.user_b_id : match.user_a_id;
        if (!memberIds.includes(buddyId)) continue;

        const memberEntry = presence?.find((p) => p.user_id === buddyId);
        const profile = Array.isArray(memberEntry?.profiles)
          ? memberEntry?.profiles[0]
          : memberEntry?.profiles;

        if (profile) {
          buddyMatchesInRoom.push({
            id: match.id,
            user_a_id: match.user_a_id,
            user_b_id: match.user_b_id,
            buddy: {
              id: buddyId,
              full_name: (profile as any).full_name || null,
              username: (profile as any).username || null,
              avatar_url: (profile as any).avatar_url || null,
            },
          });
        }
      }

      setBuddiesInRoom(buddyMatchesInRoom);

      // Load exam types for the modal
      const examsRes = await fetch("/api/study-ai/exams");
      if (examsRes.ok) {
        const data = await examsRes.json();
        setExamTypes(data.exams || []);
      }
    } catch (err) {
      console.error("[collab-entry-room] load error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectBuddy = async (match: BuddyMatch) => {
    setIsCreating(true);
    setSelectedBuddy(match);
    try {
      const res = await fetch("/api/study-ai/collab-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId: match.buddy.id, matchId: match.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create session");
      setSessionId(data.sessionId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start session";
      toast.error(msg);
      setSelectedBuddy(null);
    } finally {
      setIsCreating(false);
    }
  };

  const buddyInfo: CollabBuddyInfo | null = selectedBuddy
    ? selectedBuddy.buddy
    : null;

  // Show main collab modal once session is created
  if (sessionId && selectedBuddy && buddyInfo) {
    return (
      <CollabPlanModal
        sessionId={sessionId}
        isHost={true}
        userId={userId}
        userFullName={userProfile?.full_name || userProfile?.username || ""}
        userAvatarUrl={userProfile?.avatar_url || null}
        buddy={buddyInfo}
        matchId={selectedBuddy.id}
        examTypes={examTypes}
        onClose={onClose}
        onPlanSaved={() => {
          toast.success("Study plan created! Open Study with AI to view it.");
          onClose();
        }}
      />
    );
  }

  const pickerContent = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-semibold text-white text-base">Plan Together</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white/60 hover:text-white hover:bg-white/10 w-8 h-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : buddiesInRoom.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-white/60 text-sm">No matched buddies in this room right now.</p>
              <p className="text-white/30 text-xs">
                Your buddies need to be in the same room to plan together.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-white/60 text-sm mb-4">
                Select a buddy to create a study plan together:
              </p>
              {buddiesInRoom.map((match) => (
                <button
                  key={match.id}
                  onClick={() => handleSelectBuddy(match)}
                  disabled={isCreating}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-primary/30 hover:bg-primary/5 transition-all text-left disabled:opacity-50"
                >
                  <Avatar className="w-9 h-9 flex-shrink-0">
                    <AvatarImage src={match.buddy.avatar_url || ""} />
                    <AvatarFallback className="text-xs bg-zinc-800 text-white">
                      {getInitials(match.buddy.full_name || match.buddy.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {match.buddy.full_name || match.buddy.username}
                    </p>
                    <p className="text-xs text-emerald-400">● Online in room</p>
                  </div>
                  {isCreating && selectedBuddy?.id === match.id && (
                    <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(pickerContent, document.body);
}
