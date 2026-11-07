"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Globe, Users } from "lucide-react";

type ChatScope = "room" | "table";

interface ChatToggleProps {
  currentScope: ChatScope;
  onScopeChange: (scope: ChatScope) => void;
  isAtTable: boolean;
  tableUnreadCount?: number;
  roomUnreadCount?: number;
}

export function ChatToggle({
  currentScope,
  onScopeChange,
  isAtTable,
  tableUnreadCount = 0,
  roomUnreadCount = 0,
}: ChatToggleProps) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5">
      {/* Room Chat Button */}
      <button
        onClick={() => onScopeChange("room")}
        className={cn(
          "relative flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
          currentScope === "room"
            ? "bg-primary text-white"
            : "text-white/60 hover:text-white hover:bg-white/5"
        )}
      >
        <Globe className="w-4 h-4" />
        <span>Room</span>
        {roomUnreadCount > 0 && currentScope !== "room" && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-primary text-[10px] text-white"
          >
            {roomUnreadCount > 9 ? "9+" : roomUnreadCount}
          </motion.span>
        )}
      </button>

      {/* Table Chat Button */}
      <button
        onClick={() => isAtTable && onScopeChange("table")}
        disabled={!isAtTable}
        className={cn(
          "relative flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
          !isAtTable && "opacity-40 cursor-not-allowed",
          currentScope === "table"
            ? "bg-primary text-white"
            : isAtTable
            ? "text-white/60 hover:text-white hover:bg-white/5"
            : "text-white/40"
        )}
      >
        <Users className="w-4 h-4" />
        <span>Table</span>
        {tableUnreadCount > 0 && currentScope !== "table" && isAtTable && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-primary text-[10px] text-white"
          >
            {tableUnreadCount > 9 ? "9+" : tableUnreadCount}
          </motion.span>
        )}
      </button>
    </div>
  );
}
