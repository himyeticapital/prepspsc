"use client";

import { Heart, Users, Search } from "lucide-react";

interface EmptyStateProps {
  type: "no-candidates" | "no-matches";
}

export function EmptyState({ type }: EmptyStateProps) {
  if (type === "no-candidates") {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-center px-6">
        <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
          <Search className="w-8 h-8 text-zinc-500" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">
          No more study buddies
        </h3>
        <p className="text-sm text-zinc-400 max-w-xs">
          You&apos;ve gone through all available candidates. Check back later as more students join!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-[300px] text-center px-6">
      <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
        <Users className="w-8 h-8 text-zinc-500" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">
        No matches yet
      </h3>
      <p className="text-sm text-zinc-400 max-w-xs">
        Start swiping to find your study partner! When you both like each other, you&apos;ll match.
      </p>
    </div>
  );
}
