"use client";

import { Loader2, Trash2, Link, FileText, Youtube, Mic, PenLine, RotateCcw } from "lucide-react";

interface SourceCardProps {
  source: {
    id: string;
    title: string;
    type: "url" | "pdf" | "youtube" | "audio" | "text";
    status: string | null;
    insights_count: number;
    embedded?: boolean;
    embedded_chunks?: number;
  };
  onDelete: () => void;
  onRetry?: () => void;
}

const TYPE_ICONS = {
  url: Link,
  pdf: FileText,
  youtube: Youtube,
  audio: Mic,
  text: PenLine,
};

export function SourceCard({ source, onDelete, onRetry }: SourceCardProps) {
  const Icon = TYPE_ICONS[source.type] || Link;
  const isStuck = source.title === "Processing..." && source.status === "new" && !source.embedded;
  // Completed but never embedded = ghost source (worker claimed done but didn't process)
  const isGhost = source.status === "completed" && !source.embedded && source.title === "Processing...";
  const isFailed = source.status === "failed" || isGhost;
  const showRetry = (isStuck || isFailed) && onRetry;

  return (
    <div className="group relative p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        {showRetry && (
          <button
            onClick={onRetry}
            className="p-1 rounded-lg hover:bg-blue-500/20 text-white/40 hover:text-blue-400 transition-all"
            title="Retry processing"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-1 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-white/60" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate pr-6">
            {source.title === "Processing..." && source.embedded ? "Text Source" : source.title}
          </p>
          <div className="mt-1">
            {source.status === "failed" ? (
              <span className="inline-flex items-center gap-1 text-xs text-red-400">
                Error processing
                {onRetry && <button onClick={onRetry} className="underline hover:text-red-300 ml-1">Retry</button>}
              </span>
            ) : isStuck ? (
              <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                Stuck — worker offline
                {onRetry && <button onClick={onRetry} className="underline hover:text-amber-300 ml-1">Retry</button>}
              </span>
            ) : source.status === "new" || source.status === "queued" || source.status === "running" ? (
              <span className="inline-flex items-center gap-1 text-xs text-white/40">
                <Loader2 className="w-3 h-3 animate-spin" />
                {source.status === "running" ? "Processing..." : "Queued..."}
              </span>
            ) : source.title === "Processing..." && !source.embedded ? (
              <span className="inline-flex items-center gap-1 text-xs text-white/40">
                <Loader2 className="w-3 h-3 animate-spin" />
                Processing...
              </span>
            ) : (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                source.embedded ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400"
              }`}>
                {source.embedded ? "Ready" : "Embedding..."}
                {source.insights_count > 0 && ` · ${source.insights_count} insights`}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
