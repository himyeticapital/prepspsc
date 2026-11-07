"use client";

import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TABLE_CONSTANTS } from "@/lib/constants";
import type { TableWithMembers } from "@/stores/table-store";
import { Users, LogIn, LogOut, Loader2 } from "lucide-react";

interface TableCardProps {
  table: TableWithMembers;
  isUserTable: boolean;
  isJoining: boolean;
  isLeaving: boolean;
  onJoin: () => void;
  onLeave: () => void;
}

export function TableCard({
  table,
  isUserTable,
  isJoining,
  isLeaving,
  onJoin,
  onLeave,
}: TableCardProps) {
  const memberCount = table.members?.length || 0;
  const maxCapacity = table.max_capacity || TABLE_CONSTANTS.MAX_CAPACITY;
  const isFull = memberCount >= maxCapacity;

  // Create array of 4 slots
  const slots = Array.from({ length: maxCapacity }, (_, i) => {
    return table.members?.[i] || null;
  });

  const getInitials = (name?: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "widget-glass p-4 rounded-xl transition-all duration-200",
        isUserTable && "ring-2 ring-primary ring-offset-2 ring-offset-zinc-900"
      )}
    >
      {/* Table Name */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white truncate flex-1">
          {table.name}
        </h3>
        {isUserTable && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary ml-2">
            You're here
          </span>
        )}
      </div>

      {/* Avatar Slots */}
      <div className="flex items-center justify-center gap-2 mb-3">
        {slots.map((member, index) => (
          <div
            key={member?.user_id || `empty-${index}`}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-all",
              member
                ? "bg-white/10"
                : "bg-white/5 border-2 border-dashed border-white/20"
            )}
          >
            {member ? (
              <Avatar className="w-10 h-10">
                <AvatarImage src={member.profile?.avatar_url || undefined} />
                <AvatarFallback className="text-xs bg-primary/20 text-primary">
                  {getInitials(
                    member.profile?.full_name || member.profile?.username
                  )}
                </AvatarFallback>
              </Avatar>
            ) : (
              <Users className="w-4 h-4 text-white/20" />
            )}
          </div>
        ))}
      </div>

      {/* Capacity Indicator */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <span
          className={cn(
            "text-xs",
            isFull ? "text-red-400" : "text-white/50"
          )}
        >
          {memberCount}/{maxCapacity}
        </span>
        {isFull && !isUserTable && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
            Full
          </span>
        )}
      </div>

      {/* Action Button */}
      {isUserTable ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onLeave}
          disabled={isLeaving}
          className="w-full bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
        >
          {isLeaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4 mr-2" />
          )}
          Leave Table
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={onJoin}
          disabled={isFull || isJoining}
          className={cn(
            "w-full",
            isFull
              ? "bg-white/5 text-white/40 cursor-not-allowed"
              : "bg-primary hover:bg-primary/90"
          )}
        >
          {isJoining ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <LogIn className="w-4 h-4 mr-2" />
          )}
          {isFull ? "Table Full" : "Join Table"}
        </Button>
      )}
    </motion.div>
  );
}
