"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles, Target } from "lucide-react";

interface StudyGoalInputProps {
  onSubmit: (goalText: string) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

const EXAMPLE_GOALS = [
  "Learn Sikkim History Chapter 1",
  "Master Indian Constitution Articles 1-30",
  "Understand Geography of Northeast India",
  "Study Current Affairs - January 2026",
];

export function StudyGoalInput({ onSubmit, isLoading = false, className }: StudyGoalInputProps) {
  const [goalText, setGoalText] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalText.trim() || isLoading) return;
    await onSubmit(goalText.trim());
    setGoalText("");
  };

  const handleExampleClick = (example: string) => {
    setGoalText(example);
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4", className)}>
      <div className="relative">
        <Textarea
          placeholder="What do you want to study? e.g., 'Learn Sikkim History Chapter 1'"
          value={goalText}
          onChange={(e) => setGoalText(e.target.value)}
          className="min-h-[100px] bg-white/10 backdrop-blur-sm border-white/15 text-white placeholder:text-white/50 resize-none pr-4"
          disabled={isLoading}
        />
        <div className="absolute bottom-3 right-3 text-xs text-white/40">
          {goalText.length}/200
        </div>
      </div>

      {/* Example Goals */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-white/40">Try:</span>
        {EXAMPLE_GOALS.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => handleExampleClick(example)}
            className="text-xs px-2 py-1 rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            {example}
          </button>
        ))}
      </div>

      <Button
        type="submit"
        disabled={!goalText.trim() || isLoading}
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating Goal...
          </>
        ) : (
          <>
            <Target className="w-4 h-4 mr-2" />
            Create Study Goal
          </>
        )}
      </Button>
    </form>
  );
}
