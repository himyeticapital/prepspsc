"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { AIGenerationRow } from "@/types/database.types";
import { formatDistanceToNow } from "date-fns";
import {
  Map,
  FileText,
  ListChecks,
  HelpCircle,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  Eye,
  Loader2,
  Trash2,
} from "lucide-react";

interface GoalMaterialsProps {
  generations: AIGenerationRow[];
  goalId: number;
  className?: string;
  onDelete?: (generationId: number) => void;
}

const GENERATION_ICONS: Record<string, typeof Map> = {
  mindmap: Map,
  summary: FileText,
  flashcards: ListChecks,
  quiz: HelpCircle,
  infographic: BarChart3,
};

const GENERATION_COLORS: Record<string, string> = {
  mindmap: "text-blue-400 bg-blue-500/20",
  summary: "text-green-400 bg-green-500/20",
  flashcards: "text-yellow-400 bg-yellow-500/20",
  quiz: "text-purple-400 bg-purple-500/20",
  infographic: "text-red-400 bg-red-500/20",
};

const GENERATION_LABELS: Record<string, string> = {
  mindmap: "Mind Map",
  summary: "Summary",
  flashcards: "Flashcards",
  quiz: "Quiz",
  infographic: "Infographic",
};

const GENERATION_PLURALS: Record<string, string> = {
  mindmap: "Mind Maps",
  summary: "Summaries",
  flashcards: "Flashcards",
  quiz: "Quizzes",
  infographic: "Infographics",
};

export function GoalMaterials({ generations: initialGenerations, goalId, className, onDelete }: GoalMaterialsProps) {
  const [generations, setGenerations] = useState(initialGenerations);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    setGenerations(initialGenerations);
  }, [initialGenerations]);

  const handleToggleSave = async (generationId: number) => {
    const generation = generations.find((g) => g.id === generationId);
    if (!generation) return;

    setSavingIds((prev) => new Set(prev).add(generationId));

    try {
      const response = await fetch("/api/study-ai/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId,
          isSaved: !generation.is_saved,
        }),
      });

      if (response.ok) {
        setGenerations((prev) =>
          prev.map((g) =>
            g.id === generationId ? { ...g, is_saved: !g.is_saved } : g
          )
        );
      }
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(generationId);
        return next;
      });
    }
  };

  const handleDelete = async (generationId: number) => {
    if (!confirm("Are you sure you want to delete this material? This cannot be undone.")) {
      return;
    }

    setDeletingIds((prev) => new Set(prev).add(generationId));

    try {
      const response = await fetch("/api/study-ai/delete-generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId }),
      });

      if (response.ok) {
        setGenerations((prev) => prev.filter((g) => g.id !== generationId));
        onDelete?.(generationId);
      } else {
        console.error("Failed to delete generation");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(generationId);
        return next;
      });
    }
  };

  // Group generations by type
  const groupedGenerations = generations.reduce((acc, gen) => {
    if (!acc[gen.generation_type]) {
      acc[gen.generation_type] = [];
    }
    acc[gen.generation_type].push(gen);
    return acc;
  }, {} as Record<string, AIGenerationRow[]>);

  return (
    <div className={cn("space-y-4", className)}>
      {Object.entries(groupedGenerations).map(([type, gens]) => {
        const Icon = GENERATION_ICONS[type] || FileText;
        const colorClass = GENERATION_COLORS[type] || "text-white/60 bg-white/10";
        const label = GENERATION_LABELS[type] || type;
        const pluralLabel = GENERATION_PLURALS[type] || `${label}s`;

        return (
          <div key={type} className="widget-glass p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", colorClass)}>
                <Icon className="w-4 h-4" />
              </div>
              <h3 className="font-medium text-white">{pluralLabel}</h3>
              <span className="text-xs text-white/40">({gens.length})</span>
            </div>

            <div className="space-y-2">
              {gens.map((gen) => (
                <div
                  key={gen.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">
                      {gen.title || `${label} - ${formatDistanceToNow(new Date(gen.created_at), { addSuffix: true })}`}
                    </p>
                    <p className="text-xs text-white/40">
                      {formatDistanceToNow(new Date(gen.created_at), { addSuffix: true })}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Save/Bookmark Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleSave(gen.id)}
                      disabled={savingIds.has(gen.id)}
                      className={cn(
                        "h-8 w-8 p-0",
                        gen.is_saved ? "text-yellow-400" : "text-white/40 hover:text-white"
                      )}
                    >
                      {savingIds.has(gen.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : gen.is_saved ? (
                        <BookmarkCheck className="w-4 h-4" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </Button>

                    {/* View Button */}
                    <Link href={`/study-ai/view/${type}/${gen.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-white/40 hover:text-white"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>

                    {/* Delete Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(gen.id)}
                      disabled={deletingIds.has(gen.id)}
                      className="h-8 w-8 p-0 text-white/40 hover:text-red-400"
                    >
                      {deletingIds.has(gen.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
