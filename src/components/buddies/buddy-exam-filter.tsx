"use client";

import { useBuddyStore } from "@/stores/buddy-store";
import { useAuthStore } from "@/stores/auth-store";
import { getExamLabel } from "@/lib/exam-options";
import { cn } from "@/lib/utils";


interface BuddyExamFilterProps {
  userId: string;
}

export function BuddyExamFilter({ userId }: BuddyExamFilterProps) {
  const { profile } = useAuthStore();
  const { examFilter, setExamFilter } = useBuddyStore();

  const userExams = profile?.preparing_for || [];

  // Don't show filter if user hasn't set any exams
  if (userExams.length === 0) return null;

  const handleFilter = (exam: string | null) => {
    setExamFilter(exam);
    // Re-fetch candidates with the new filter
    // Need to call fetchCandidates after state updates
    setTimeout(() => {
      useBuddyStore.getState().fetchCandidates(userId);
    }, 0);
  };

  return (
    <div className="mb-3">
      <p className="text-[10px] text-zinc-500 mb-1.5 uppercase tracking-wider font-medium">Filter by exam</p>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => handleFilter(null)}
          className={cn(
            "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
            examFilter === null
              ? "bg-primary text-primary-foreground"
              : "bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700"
          )}
        >
          All
        </button>
        {userExams.map((exam) => (
          <button
            key={exam}
            onClick={() => handleFilter(exam === examFilter ? null : exam)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              examFilter === exam
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700"
            )}
          >
            {getExamLabel(exam)}
          </button>
        ))}
      </div>
    </div>
  );
}
