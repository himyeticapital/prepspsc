"use client";

import { AnimatePresence } from "framer-motion";
import { SwipeCard } from "./swipe-card";
import { EmptyState } from "./empty-state";
import { Loader2 } from "lucide-react";
import { useBuddyStore } from "@/stores/buddy-store";

interface SwipeStackProps {
  userId: string;
}

export function SwipeStack({ userId }: SwipeStackProps) {
  const { candidates, currentIndex, isLoading, swipe } = useBuddyStore();

  const remainingCandidates = candidates.slice(currentIndex);
  const visibleCards = remainingCandidates.slice(0, 3);

  if (isLoading && candidates.length === 0) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (visibleCards.length === 0) {
    return <EmptyState type="no-candidates" />;
  }

  return (
    <div className="relative w-full max-w-sm mx-auto h-[520px]">
      <AnimatePresence mode="popLayout">
        {visibleCards.map((candidate, i) => (
          <SwipeCard
            key={candidate.id}
            candidate={candidate}
            onSwipe={(direction) => swipe(userId, candidate.id, direction)}
            isTop={i === 0}
            index={i}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
