"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PREDEFINED_EXAMS,
  EXAM_CATEGORIES,
  getExamLabel,
  toExamSlug,
} from "@/lib/exam-options";

interface ExamSelectorProps {
  selected: string[];
  onChange: (exams: string[]) => void;
  maxSelections?: number;
}

export function ExamSelector({
  selected,
  onChange,
  maxSelections = 5,
}: ExamSelectorProps) {
  const [customInput, setCustomInput] = useState("");

  const atLimit = selected.length >= maxSelections;

  const handleToggle = (slug: string) => {
    if (selected.includes(slug)) {
      onChange(selected.filter((s) => s !== slug));
    } else if (!atLimit) {
      onChange([...selected, slug]);
    }
  };

  const handleRemove = (slug: string) => {
    onChange(selected.filter((s) => s !== slug));
  };

  const handleCustomAdd = () => {
    const slug = toExamSlug(customInput);
    if (!slug || selected.includes(slug) || atLimit) return;
    onChange([...selected, slug]);
    setCustomInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCustomAdd();
    }
  };

  return (
    <div className="space-y-4">
      {/* Selected badges */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((slug) => (
            <span
              key={slug}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-primary/10 text-primary border border-primary/30"
            >
              {getExamLabel(slug)}
              <button
                type="button"
                onClick={() => handleRemove(slug)}
                className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <span className="text-xs text-zinc-500 self-center">
            {selected.length}/{maxSelections}
          </span>
        </div>
      )}

      {/* Grouped predefined exams */}
      <div className="space-y-3">
        {EXAM_CATEGORIES.map((category) => {
          const exams = PREDEFINED_EXAMS.filter(
            (e) => e.category === category.key
          );
          if (exams.length === 0) return null;

          return (
            <div key={category.key}>
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-2">
                {category.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {exams.map((exam) => {
                  const isSelected = selected.includes(exam.value);
                  return (
                    <button
                      key={exam.value}
                      type="button"
                      onClick={() => handleToggle(exam.value)}
                      disabled={atLimit && !isSelected}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm transition-all",
                        isSelected
                          ? "bg-primary/20 text-primary border border-primary/40"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-500",
                        atLimit &&
                          !isSelected &&
                          "opacity-40 cursor-not-allowed"
                      )}
                    >
                      {exam.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom exam input */}
      <div>
        <div className="relative">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add custom exam..."
            disabled={atLimit}
            className={cn(
              "w-full px-3 py-2 pl-9 rounded-lg text-sm outline-none transition-colors",
              "bg-zinc-800/50 border border-zinc-700 text-white placeholder:text-zinc-500",
              "focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/30",
              atLimit && "opacity-40 cursor-not-allowed"
            )}
          />
          <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        </div>
        {atLimit && (
          <p className="text-xs text-zinc-500 mt-1">
            Maximum {maxSelections} exams selected
          </p>
        )}
      </div>
    </div>
  );
}
