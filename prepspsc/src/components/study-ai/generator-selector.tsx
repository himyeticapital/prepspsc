"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AIGenerationRow, StudyAIGenerationType } from "@/types/database.types";
import type { GenerationOutput } from "@/types/study-ai.types";
import {
  Map,
  FileText,
  ListChecks,
  HelpCircle,
  BarChart3,
  Loader2,
  Sparkles,
} from "lucide-react";

interface GeneratorSelectorProps {
  userId: string;
  goalId: number;
  sourceContent: string;
  isPro: boolean;
  onGenerationComplete: (generation: AIGenerationRow) => void;
  onCancel: () => void;
}

interface GenerationOption {
  type: StudyAIGenerationType;
  label: string;
  icon: typeof Map;
  description: string;
  color: string;
  bgColor: string;
}

const GENERATION_OPTIONS: GenerationOption[] = [
  {
    type: "summary",
    label: "Summary",
    icon: FileText,
    description: "Key points & bullet points",
    color: "text-green-400",
    bgColor: "bg-green-500/20",
  },
  {
    type: "mindmap",
    label: "Mind Map",
    icon: Map,
    description: "Visual hierarchy of concepts",
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
  },
  {
    type: "flashcards",
    label: "Flashcards",
    icon: ListChecks,
    description: "Term/definition cards",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
  },
  {
    type: "quiz",
    label: "Quiz",
    icon: HelpCircle,
    description: "10 MCQs with explanations",
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
  },
  {
    type: "infographic",
    label: "Infographic",
    icon: BarChart3,
    description: "Charts & visualizations",
    color: "text-red-400",
    bgColor: "bg-red-500/20",
  },
];

export function GeneratorSelector({
  userId,
  goalId,
  sourceContent,
  isPro,
  onGenerationComplete,
  onCancel,
}: GeneratorSelectorProps) {
  const [selectedType, setSelectedType] = useState<StudyAIGenerationType | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!selectedType || !sourceContent.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/study-ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          goalId,
          generationType: selectedType,
          sourceContent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "DAILY_LIMIT") {
          setError("You've reached your daily limit. Upgrade to Pro for unlimited generations.");
        } else if (data.code === "INSUFFICIENT_CONTENT") {
          // Show both error and details for insufficient content
          setError(data.details || data.error || "Not enough content to generate study materials.");
        } else {
          setError(data.error || "Failed to generate. Please try again.");
        }
        return;
      }

      onGenerationComplete(data.generation);
    } catch (err) {
      console.error("Generation error:", err);
      setError("Failed to generate. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Options Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {GENERATION_OPTIONS.map((option) => (
          <button
            key={option.type}
            onClick={() => setSelectedType(option.type)}
            disabled={isGenerating}
            className={cn(
              "p-3 rounded-xl border transition-all text-center",
              selectedType === option.type
                ? `${option.bgColor} border-current`
                : "bg-white/5 border-white/10 hover:bg-white/10"
            )}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center",
                option.bgColor
              )}
            >
              <option.icon className={cn("w-5 h-5", option.color)} />
            </div>
            <div className={cn("text-sm font-medium", selectedType === option.type ? option.color : "text-white")}>
              {option.label}
            </div>
            <p className="text-xs text-white/40 mt-1">{option.description}</p>
          </button>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={isGenerating} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={!selectedType || isGenerating}
          className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate {selectedType ? GENERATION_OPTIONS.find((o) => o.type === selectedType)?.label : ""}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
