"use client";

import { useBuddyStore } from "@/stores/buddy-store";
import { EmptyState } from "./empty-state";
import { Loader2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatchListProps {
  userId: string;
  onOpenChat: (matchId: number) => void;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function MatchList({ userId, onOpenChat }: MatchListProps) {
  const { matches, isLoadingMatches } = useBuddyStore();

  if (isLoadingMatches && matches.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (matches.length === 0) {
    return <EmptyState type="no-matches" />;
  }

  return (
    <div className="space-y-2">
      {matches.map((match) => (
        <button
          key={match.id}
          onClick={() => onOpenChat(match.id)}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-900/60 border border-white/5 hover:border-white/10 hover:bg-zinc-800/60 transition-all text-left"
        >
          {/* Avatar */}
          <div className="relative shrink-0">
            {match.buddy.avatar_url ? (
              <img
                src={match.buddy.avatar_url}
                alt=""
                className="w-12 h-12 rounded-full object-cover border border-white/10"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-lg font-bold text-primary">
                {(match.buddy.full_name || match.buddy.username || "?")[0].toUpperCase()}
              </div>
            )}
            {match.unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                {match.unreadCount > 9 ? "9+" : match.unreadCount}
              </span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className={cn(
                "font-medium text-sm truncate",
                match.unreadCount > 0 ? "text-white" : "text-zinc-300"
              )}>
                {match.buddy.full_name || match.buddy.username || "Study Buddy"}
              </span>
              <span className="text-[10px] text-zinc-500 shrink-0 ml-2">
                {match.lastMessage ? timeAgo(match.lastMessage.created_at) : timeAgo(match.matched_at)}
              </span>
            </div>
            <p className={cn(
              "text-xs truncate mt-0.5",
              match.unreadCount > 0 ? "text-zinc-300 font-medium" : "text-zinc-500"
            )}>
              {match.lastMessage ? (
                <>
                  {match.lastMessage.sender_id === userId ? "You: " : ""}
                  {match.lastMessage.content}
                </>
              ) : (
                <span className="text-zinc-500 italic flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" />
                  Say hello!
                </span>
              )}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
