"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Loader2, StickyNote, X, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { NotebookNoteCard } from "./notebook-note-card";
import { proxyNotebook } from "@/lib/notebook-proxy";
import { toast } from "sonner";

interface Note {
  id: string;
  title: string;
  content: string;
  note_type: "user" | "ai";
  created: string;
}

interface NotesPanelProps {
  notebookId: string;
}

export function NotesPanel({ notebookId }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewNote, setShowNewNote] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchNotes = useCallback(async () => {
    try {
      const data = await proxyNotebook({ action: "list_notes", notebook_id: notebookId });
      setNotes(Array.isArray(data) ? data : (data.notes || []));
    } catch (err) {
      console.error("Failed to fetch notes:", err);
    } finally {
      setIsLoading(false);
    }
  }, [notebookId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Refresh notes when generate bar produces content
  useEffect(() => {
    const handler = () => {
      // Small delay to let the backend finish saving
      setTimeout(fetchNotes, 1500);
    };
    window.addEventListener("notebook:notes-refresh", handler);
    return () => window.removeEventListener("notebook:notes-refresh", handler);
  }, [fetchNotes]);

  const handleSaveNote = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setIsSaving(true);

    try {
      await proxyNotebook({
        action: "create_note",
        notebook_id: notebookId,
        title: newTitle.trim(),
        content: newContent.trim(),
      });

      toast.success("Note saved");
      setNewTitle("");
      setNewContent("");
      setShowNewNote(false);
      fetchNotes();
    } catch (err) {
      toast.error("Failed to save note");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await proxyNotebook({ action: "delete_note", note_id: noteId });

      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success("Note deleted");
    } catch (err) {
      toast.error("Failed to delete note");
    }
  };

  const generateNotes = async () => {
    setIsGenerating(true);
    try {
      const data = await proxyNotebook({ action: "generate_notes", notebook_id: notebookId });
      const newNotes = Array.isArray(data) ? data : (data.notes || []);
      if (newNotes.length > 0) {
        setNotes((prev) => [...newNotes, ...prev]);
        toast.success(`Generated ${newNotes.length} note${newNotes.length > 1 ? "s" : ""}`);
      } else {
        toast.info("No content found to generate notes from. Try adding sources first.");
      }
    } catch (err) {
      toast.error("Failed to generate notes");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white">Notes</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={generateNotes}
            disabled={isGenerating}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-xs transition-all disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generate
          </button>
          <button
            onClick={() => setShowNewNote(!showNewNote)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all"
          >
            {showNewNote ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showNewNote ? "Cancel" : "Write Note"}
          </button>
        </div>
      </div>

      {/* New note form */}
      <AnimatePresence>
        {showNewNote && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-white/10"
          >
            <div className="p-3 space-y-2">
              <Input
                placeholder="Note title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="h-8 text-sm bg-white/5 border-white/10 text-white"
              />
              <Textarea
                placeholder="Write your note..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={4}
                className="text-sm bg-white/5 border-white/10 text-white resize-none"
              />
              <Button
                size="sm"
                onClick={handleSaveNote}
                disabled={!newTitle.trim() || !newContent.trim() || isSaving}
                className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700"
              >
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Save Note
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-white/40" />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8">
            <StickyNote className="w-8 h-8 text-white/20 mx-auto mb-2" />
            <p className="text-xs text-white/40">No notes yet. Write one or generate from sources.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            {notes.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <NotebookNoteCard
                  note={note}
                  onDelete={() => handleDeleteNote(note.id)}
                  onUpdate={(updated) => setNotes((prev) => prev.map((n) => n.id === note.id ? { ...n, ...updated } : n))}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
