"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { StudyUploadRow } from "@/types/database.types";
import { formatDistanceToNow } from "date-fns";
import {
  FileText,
  Image as ImageIcon,
  Youtube,
  Layers,
  ExternalLink,
  Trash2,
  Loader2,
} from "lucide-react";

interface GoalUploadsProps {
  uploads: StudyUploadRow[];
  onDelete?: (uploadId: number) => Promise<boolean>;
  className?: string;
}

const UPLOAD_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  image: ImageIcon,
  youtube: Youtube,
  anki: Layers,
};

const UPLOAD_COLORS: Record<string, string> = {
  pdf: "text-red-400 bg-red-500/20",
  image: "text-blue-400 bg-blue-500/20",
  youtube: "text-red-400 bg-red-500/20",
  anki: "text-purple-400 bg-purple-500/20",
};

export function GoalUploads({ uploads, onDelete, className }: GoalUploadsProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (uploadId: number) => {
    if (confirmDeleteId !== uploadId) {
      setConfirmDeleteId(uploadId);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }

    if (!onDelete) return;
    setDeletingId(uploadId);
    await onDelete(uploadId);
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  if (uploads.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {uploads.map((upload) => {
        const Icon = UPLOAD_ICONS[upload.upload_type] || FileText;
        const colorClass = UPLOAD_COLORS[upload.upload_type] || "text-white/60 bg-white/10";

        return (
          <div
            key={upload.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
          >
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", colorClass)}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">
                {upload.file_name || `${upload.upload_type} file`}
              </p>
              <p className="text-xs text-white/40">
                {formatDistanceToNow(new Date(upload.created_at), { addSuffix: true })}
                {upload.extracted_text && (
                  <span className="ml-2 text-green-400">Text extracted</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {upload.file_url && (
                <a
                  href={upload.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              {onDelete && (
                <button
                  onClick={() => handleDelete(upload.id)}
                  disabled={deletingId === upload.id}
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    confirmDeleteId === upload.id
                      ? "bg-red-500/20 text-red-400 opacity-100"
                      : "opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-white/40 hover:text-red-400"
                  )}
                  title={confirmDeleteId === upload.id ? "Click again to confirm" : "Delete upload"}
                >
                  {deletingId === upload.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
