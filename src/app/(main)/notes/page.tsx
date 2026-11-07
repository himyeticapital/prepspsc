"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NoteCard } from "@/components/notes/note-card";
import { NoteEditor } from "@/components/notes/note-editor";
import {
  Plus,
  Search,
  StickyNote,
  Loader2,
  Filter,
  Smartphone,
  Globe,
  Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StudyNote {
  id: string;
  content: string;
  source: "web" | "telegram" | "whatsapp" | "voice";
  tags: string[];
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

type SourceFilter = "all" | "web" | "telegram" | "whatsapp" | "voice";

export default function NotesPage() {
  const { user } = useAuthStore();
  const supabase = createClient();

  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<StudyNote | null>(null);

  // Fetch notes on mount
  useEffect(() => {
    if (!user) return;

    const fetchNotes = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("study_notes")
        .select("*")
        .eq("user_id", user.id)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching notes:", error);
      } else {
        setNotes(data || []);
      }
      setIsLoading(false);
    };

    fetchNotes();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("study_notes_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "study_notes",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setNotes((prev) => [payload.new as StudyNote, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setNotes((prev) =>
              prev.map((n) =>
                n.id === payload.new.id ? (payload.new as StudyNote) : n
              )
            );
          } else if (payload.eventType === "DELETE") {
            setNotes((prev) => prev.filter((n) => n.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  // Get all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((note) => {
      note.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [notes]);

  // Filter notes
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesContent = note.content.toLowerCase().includes(query);
        const matchesTags = note.tags?.some((tag) =>
          tag.toLowerCase().includes(query)
        );
        if (!matchesContent && !matchesTags) return false;
      }

      // Tag filter
      if (selectedTag && !note.tags?.includes(selectedTag)) {
        return false;
      }

      // Source filter
      if (sourceFilter !== "all" && note.source !== sourceFilter) {
        return false;
      }

      return true;
    });
  }, [notes, searchQuery, selectedTag, sourceFilter]);

  // Handle note actions
  const handleCreateNote = () => {
    setEditingNote(null);
    setIsEditorOpen(true);
  };

  const handleEditNote = (note: StudyNote) => {
    setEditingNote(note);
    setIsEditorOpen(true);
  };

  const handleDeleteNote = async (noteId: string) => {
    const { error } = await supabase
      .from("study_notes")
      .delete()
      .eq("id", noteId);

    if (error) {
      console.error("Error deleting note:", error);
    }
  };

  const handleTogglePin = async (noteId: string, isPinned: boolean) => {
    const { error } = await supabase
      .from("study_notes")
      .update({ is_pinned: !isPinned })
      .eq("id", noteId);

    if (error) {
      console.error("Error toggling pin:", error);
    }
  };

  const handleSaveNote = async (content: string, tags: string[]) => {
    if (editingNote) {
      // Update existing note
      const { error } = await supabase
        .from("study_notes")
        .update({ content, tags, updated_at: new Date().toISOString() })
        .eq("id", editingNote.id);

      if (error) {
        console.error("Error updating note:", error);
        return;
      }
    } else {
      // Create new note
      const { error } = await supabase.from("study_notes").insert({
        user_id: user!.id,
        content,
        tags,
        source: "web",
      });

      if (error) {
        console.error("Error creating note:", error);
        return;
      }
    }

    setIsEditorOpen(false);
    setEditingNote(null);
  };

  // Source icon component
  const SourceIcon = ({ source }: { source: string }) => {
    switch (source) {
      case "telegram":
        return <Smartphone className="w-3 h-3" />;
      case "whatsapp":
        return <Smartphone className="w-3 h-3" />;
      case "voice":
        return <Mic className="w-3 h-3" />;
      default:
        return <Globe className="w-3 h-3" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <StickyNote className="w-6 h-6 text-primary" />
            Study Notes
          </h1>
          <p className="text-white/60 text-sm mt-1">
            {notes.length} notes synced from web & bot
          </p>
        </div>

        <Button onClick={handleCreateNote} className="gap-2">
          <Plus className="w-4 h-4" />
          New Note
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="glass-card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/5 border-white/10"
            />
          </div>

          {/* Source Filter */}
          <div className="flex gap-2">
            {(["all", "web", "telegram", "voice"] as SourceFilter[]).map(
              (source) => (
                <Button
                  key={source}
                  variant={sourceFilter === source ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSourceFilter(source)}
                  className={cn(
                    "gap-1.5",
                    sourceFilter !== source && "bg-white/5 border-white/10"
                  )}
                >
                  {source === "all" ? (
                    <Filter className="w-3 h-3" />
                  ) : (
                    <SourceIcon source={source} />
                  )}
                  <span className="hidden sm:inline capitalize">{source}</span>
                </Button>
              )
            )}
          </div>
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              variant={selectedTag === null ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedTag(null)}
              className="h-7 text-xs"
            >
              All
            </Button>
            {allTags.map((tag) => (
              <Button
                key={tag}
                variant={selectedTag === tag ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedTag(tag)}
                className="h-7 text-xs"
              >
                #{tag}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <StickyNote className="w-12 h-12 mx-auto mb-4 text-white/20" />
          <h3 className="text-lg font-medium text-white/60 mb-2">
            {searchQuery || selectedTag
              ? "No matching notes"
              : "No notes yet"}
          </h3>
          <p className="text-sm text-white/40 mb-4">
            {searchQuery || selectedTag
              ? "Try a different search or filter"
              : "Create a note or save one from Telegram!"}
          </p>
          {!searchQuery && !selectedTag && (
            <Button onClick={handleCreateNote} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Create First Note
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredNotes.map((note) => (
              <motion.div
                key={note.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <NoteCard
                  note={note}
                  onEdit={() => handleEditNote(note)}
                  onDelete={() => handleDeleteNote(note.id)}
                  onTogglePin={() => handleTogglePin(note.id, note.is_pinned)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Note Editor Modal */}
      <NoteEditor
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingNote(null);
        }}
        onSave={handleSaveNote}
        initialContent={editingNote?.content}
        initialTags={editingNote?.tags}
        isEditing={!!editingNote}
      />
    </div>
  );
}
