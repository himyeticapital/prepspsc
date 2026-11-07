"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, getInitials } from "@/lib/utils";
import { X, UserPlus, Loader2, Clock, Users } from "lucide-react";
import { toast } from "sonner";

interface BuddyProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface InviteBuddyModalProps {
  roomId: number;
  userId: string;
  currentMemberIds: string[];
  onClose: () => void;
  onInviteSent: () => void;
}

export function InviteBuddyModal({
  roomId,
  userId,
  currentMemberIds,
  onClose,
  onInviteSent,
}: InviteBuddyModalProps) {
  const [buddies, setBuddies] = useState<BuddyProfile[]>([]);
  const [pendingInviteIds, setPendingInviteIds] = useState<Set<string>>(
    new Set()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  // Fetch active buddies + pending invites
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);

      // 1. Fetch active buddy matches
      const { data: matches } = await supabase
        .from("buddy_matches")
        .select("id, user_a_id, user_b_id")
        .eq("status", "active")
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

      if (!matches || matches.length === 0) {
        setBuddies([]);
        setIsLoading(false);
        return;
      }

      // Extract buddy IDs (the other person in each match)
      const buddyIds = matches.map((m) =>
        m.user_a_id === userId ? m.user_b_id : m.user_a_id
      );

      // Filter out users already in the room
      const eligibleIds = buddyIds.filter(
        (id) => !currentMemberIds.includes(id)
      );

      if (eligibleIds.length === 0) {
        setBuddies([]);
        setIsLoading(false);
        return;
      }

      // 2. Fetch profiles for eligible buddies
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .in("id", eligibleIds);

      setBuddies(profiles || []);

      // 3. Fetch pending invites for this room
      const { data: pendingInvites } = await supabase
        .from("room_invites")
        .select("invitee_id")
        .eq("room_id", roomId)
        .eq("status", "pending");

      if (pendingInvites) {
        setPendingInviteIds(
          new Set(pendingInvites.map((inv) => inv.invitee_id))
        );
      }

      setIsLoading(false);
    };

    fetchData();
  }, [roomId, userId, currentMemberIds, supabase]);

  const handleInvite = async (inviteeId: string) => {
    setSendingTo(inviteeId);

    try {
      const response = await fetch("/api/room/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomId, invitee_id: inviteeId }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to send invite");
        return;
      }

      toast.success("Invite sent!");
      setPendingInviteIds((prev) => new Set([...prev, inviteeId]));
      onInviteSent();
    } catch {
      toast.error("Failed to send invite");
    } finally {
      setSendingTo(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative z-10 w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-lg">
                Invite Buddy
              </h3>
              <p className="text-xs text-white/40">
                Invite your study buddies to this room
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Buddy List */}
        <ScrollArea className="max-h-[400px]">
          <div className="p-4 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : buddies.length === 0 ? (
              <div className="text-center py-10">
                <Users className="w-10 h-10 mx-auto mb-3 text-white/20" />
                <p className="text-sm text-white/50">
                  No buddies available to invite
                </p>
                <p className="text-xs text-white/30 mt-1">
                  All your buddies are already in this room, or you have no
                  active buddies yet.
                </p>
              </div>
            ) : (
              buddies.map((buddy) => {
                const isPending = pendingInviteIds.has(buddy.id);
                const isSending = sendingTo === buddy.id;

                return (
                  <div
                    key={buddy.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl",
                      "bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                    )}
                  >
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarImage src={buddy.avatar_url || ""} />
                      <AvatarFallback className="text-sm bg-zinc-800">
                        {getInitials(
                          buddy.full_name || buddy.username
                        )}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {buddy.full_name || buddy.username || "User"}
                      </p>
                      {buddy.username && (
                        <p className="text-xs text-white/40 truncate">
                          @{buddy.username}
                        </p>
                      )}
                    </div>

                    {isPending ? (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleInvite(buddy.id)}
                        disabled={isSending}
                        className="bg-primary hover:bg-primary/90 text-white text-xs gap-1.5"
                      >
                        {isSending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="w-3.5 h-3.5" />
                        )}
                        Invite
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </motion.div>
    </div>
  );
}
