"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, PenLine, X, Check, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { proxyNotebook } from "@/lib/notebook-proxy";
import { toast } from "sonner";

interface NotebookNoteCardProps {
  note: {
    id: string;
    title: string;
    content: string;
    note_type: "user" | "ai";
    created: string;
  };
  onDelete: () => void;
  onUpdate?: (updated: { title: string; content: string }) => void;
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function NotebookNoteCard({ note, onDelete, onUpdate }: NotebookNoteCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [fullContent, setFullContent] = useState<string | null>(note.content || null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title || "");
  const [editContent, setEditContent] = useState(note.content || "");
  const [isSaving, setIsSaving] = useState(false);

  const fetchFullNote = async () => {
    if (fullContent) return;
    setIsLoadingContent(true);
    try {
      const data = await proxyNotebook({ action: "get_note", note_id: note.id });
      const content = data.content || "";
      setFullContent(content);
      setEditContent(content);
    } catch {
      setFullContent("");
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleExpand = async () => {
    setIsExpanded(true);
    fetchFullNote();
  };

  const handleSave = async () => {
    if (!editTitle.trim() || !editContent.trim()) return;
    setIsSaving(true);
    try {
      await proxyNotebook({
        action: "update_note",
        note_id: note.id,
        title: editTitle.trim(),
        content: editContent.trim(),
      });
      toast.success("Note updated");
      setFullContent(editContent.trim());
      onUpdate?.({ title: editTitle.trim(), content: editContent.trim() });
      setIsEditing(false);
    } catch {
      toast.error("Failed to update note");
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(note.title || "");
    setIsEditing(true);
    setIsExpanded(true);
    if (!fullContent) {
      await fetchFullNote();
    } else {
      setEditContent(fullContent);
    }
  };

  return (
    <>
      {/* Card */}
      <div
        onClick={() => !isEditing && handleExpand()}
        className="group relative p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {note.note_type === "ai" && (
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">
                AI Generated
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={startEdit}
              className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all"
            >
              <PenLine className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <h4 className="text-sm font-semibold text-white mb-1">{note.title}</h4>
        <p className="text-xs text-white/50 line-clamp-3">{note.content || ""}</p>
        <p className="text-[10px] text-white/30 mt-2">{formatTimeAgo(note.created)}</p>
      </div>

      {/* Expanded modal */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => { if (!isEditing) setIsExpanded(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[80vh] mx-4 rounded-2xl bg-[#0a0a0b] border border-white/10 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  {note.note_type === "ai" && (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">
                      AI Generated
                    </span>
                  )}
                  <span className="text-[10px] text-white/30">{formatTimeAgo(note.created)}</span>
                </div>
                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs transition-all disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Save
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setEditTitle(note.title || ""); setEditContent(fullContent || ""); setIsEditing(true); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs transition-all"
                      >
                        <PenLine className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => setIsExpanded(false)}
                        className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4">
                {isEditing ? (
                  <div className="space-y-3">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="text-base font-semibold bg-white/5 border-white/10 text-white"
                      placeholder="Note title"
                    />
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={15}
                      className="text-sm bg-white/5 border-white/10 text-white resize-none"
                      placeholder="Note content..."
                    />
                  </div>
                ) : isLoadingContent ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-white/40" />
                  </div>
                ) : (
                  <>
                    <h2 className="text-lg font-semibold text-white mb-3">{note.title}</h2>
                    <div className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">
                      {fullContent || ""}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
