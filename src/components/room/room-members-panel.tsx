"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, getInitials } from "@/lib/utils";
import {
  X,
  Users,
  UserPlus,
  BarChart3,
  Crown,
  Wifi,
  WifiOff,
} from "lucide-react";
import { InviteBuddyModal } from "@/components/room/invite-buddy-modal";
import type { Room } from "@/types/database.types";

interface MemberProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  xp_level: number;
}

interface RoomMembersPanelProps {
  roomId: number;
  userId: string;
  room: Room;
  onClose: () => void;
  onCompare?: (memberId: string) => void;
}

export function RoomMembersPanel({
  roomId,
  userId,
  room,
  onClose,
  onCompare,
}: RoomMembersPanelProps) {
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  const currentMemberIds = useMemo(
    () => members.map((m) => m.id),
    [members]
  );

  // Fetch room members
  useEffect(() => {
    const fetchMembers = async () => {
      setIsLoading(true);

      const { data, error } = await supabase
        .from("user_room_subscriptions")
        .select(
          "user_id, profiles:user_id (id, full_name, username, avatar_url, xp_level)"
        )
        .eq("room_id", roomId);

      if (!error && data) {
        const memberProfiles: MemberProfile[] = data
          .map((sub: any) => sub.profiles)
          .filter(Boolean);
        setMembers(memberProfiles);
      }

      setIsLoading(false);
    };

    fetchMembers();
  }, [roomId, supabase]);

  // Fetch room presence for online status
  useEffect(() => {
    const fetchPresence = async () => {
      const fiveMinutesAgo = new Date(
        Date.now() - 5 * 60 * 1000
      ).toISOString();

      const { data } = await supabase
        .from("room_presence")
        .select("user_id")
        .eq("room_id", roomId)
        .gte("last_seen_at", fiveMinutesAgo);

      if (data) {
        setOnlineUserIds(new Set(data.map((p) => p.user_id)));
      }
    };

    fetchPresence();

    // Refresh presence every 30 seconds
    const interval = setInterval(fetchPresence, 30_000);
    return () => clearInterval(interval);
  }, [roomId, supabase]);

  const handleInviteSent = () => {
    // Refresh members after an invite is sent (the invitee isn't a member yet,
    // but we may want to refresh to show updated state)
  };

  const canInvite = members.length < room.max_members;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/40"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full w-80 z-[101] flex flex-col border-l border-white/10 bg-zinc-950/95 backdrop-blur-xl shadow-2xl"
      >
          {/* Header */}
          <div className="flex items-center gap-2 p-4 border-b border-white/10">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-white text-lg">Members</h2>
            <span className="text-sm text-white/50">
              ({members.length}/{room.max_members})
            </span>
          </div>

          {/* Member List */}
          <ScrollArea className="flex-1 p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => {
                  const isOnline = onlineUserIds.has(member.id);
                  const isOwner = room.owner_id === member.id;
                  const isSelf = member.id === userId;

                  return (
                    <div
                      key={member.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl transition-colors",
                        "bg-white/5 hover:bg-white/10 border border-white/5"
                      )}
                    >
                      {/* Avatar with online indicator */}
                      <div className="relative flex-shrink-0">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={member.avatar_url || ""} />
                          <AvatarFallback className="text-sm bg-zinc-800">
                            {getInitials(
                              member.full_name || member.username
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-zinc-950",
                            isOnline ? "bg-emerald-500" : "bg-zinc-600"
                          )}
                        />
                      </div>

                      {/* Member info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-white truncate">
                            {member.full_name || member.username || "User"}
                            {isSelf && (
                              <span className="text-white/40 ml-1">
                                (you)
                              </span>
                            )}
                          </p>
                          {isOwner && (
                            <Crown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/40">
                            Lv. {member.xp_level}
                          </span>
                          <span className="flex items-center gap-1 text-xs">
                            {isOnline ? (
                              <>
                                <Wifi className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">
                                  Online
                                </span>
                              </>
                            ) : (
                              <>
                                <WifiOff className="w-3 h-3 text-zinc-500" />
                                <span className="text-zinc-500">
                                  Offline
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Compare Stats button */}
                      {!isSelf && onCompare && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0 w-8 h-8 text-white/40 hover:text-primary hover:bg-primary/10"
                          onClick={() => onCompare(member.id)}
                          title="Compare Stats"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Invite Button */}
          {canInvite && (
            <div className="p-4 border-t border-white/10">
              <Button
                onClick={() => setShowInviteModal(true)}
                className="w-full bg-primary hover:bg-primary/90 text-white gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Invite Buddy
              </Button>
            </div>
          )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteBuddyModal
          roomId={roomId}
          userId={userId}
          currentMemberIds={currentMemberIds}
          onClose={() => setShowInviteModal(false)}
          onInviteSent={handleInviteSent}
        />
      )}
    </>,
    document.body
  );
}
