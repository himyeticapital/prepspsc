"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn, getInitials } from "@/lib/utils";
import { Check, X, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";

interface RoomInviteBadgeProps {
  invite: {
    id: number;
    room_id: number;
    room_name: string;
    inviter_name: string;
    inviter_avatar: string | null;
  };
  onRespond: () => void;
}

export function RoomInviteBadge({ invite, onRespond }: RoomInviteBadgeProps) {
  const router = useRouter();
  const [isResponding, setIsResponding] = useState<"accept" | "decline" | null>(
    null
  );

  const handleRespond = async (action: "accept" | "decline") => {
    setIsResponding(action);

    try {
      const response = await fetch("/api/room/invite", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_id: invite.id, action }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || `Failed to ${action} invite`);
        return;
      }

      if (action === "accept") {
        toast.success(`Joined "${invite.room_name}"!`);
        onRespond();
        router.push(`/room/${invite.room_id}`);
      } else {
        toast.success("Invite declined");
        onRespond();
      }
    } catch {
      toast.error(`Failed to ${action} invite`);
    } finally {
      setIsResponding(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl",
        "bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors"
      )}
    >
      {/* Inviter avatar */}
      <Avatar className="w-9 h-9 flex-shrink-0">
        <AvatarImage src={invite.inviter_avatar || ""} />
        <AvatarFallback className="text-xs bg-zinc-800">
          {getInitials(invite.inviter_name)}
        </AvatarFallback>
      </Avatar>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <p className="text-sm font-medium text-white truncate">
            {invite.room_name}
          </p>
        </div>
        <p className="text-xs text-white/40 truncate">
          Invited by {invite.inviter_name}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Button
          size="icon"
          onClick={() => handleRespond("accept")}
          disabled={isResponding !== null}
          className="w-8 h-8 bg-emerald-600 hover:bg-emerald-500 text-white"
          title="Accept"
        >
          {isResponding === "accept" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => handleRespond("decline")}
          disabled={isResponding !== null}
          className="w-8 h-8 text-white/50 hover:text-red-400 hover:bg-red-500/10"
          title="Decline"
        >
          {isResponding === "decline" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <X className="w-4 h-4" />
          )}
        </Button>
      </div>
    </motion.div>
  );
}
