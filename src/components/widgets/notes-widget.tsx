"use client";

import { useState } from "react";
import { Plus, Check, Trash2, Circle } from "lucide-react";
import { useWidgetStore } from "@/stores/widget-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function NotesWidget() {
  const { notes, addNote, toggleNote, deleteNote } = useWidgetStore();
  const [newNote, setNewNote] = useState("");

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addNote(newNote.trim());
    setNewNote("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddNote();
    }
  };

  const pendingNotes = notes.filter((n) => !n.completed);
  const completedNotes = notes.filter((n) => n.completed);

  return (
    <ScrollArea className="h-[420px]">
      {/* Add Note - Sticky Header */}
      <div className="p-3 border-b border-white/10 sticky top-0 bg-zinc-900/95 backdrop-blur-sm z-10">
        <div className="flex gap-2">
          <Input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a task..."
            className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/40"
          />
          <Button
            size="icon"
            onClick={handleAddNote}
            disabled={!newNote.trim()}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Notes List */}
      <div className="p-3 space-y-4">
        {/* Pending Tasks */}
        {pendingNotes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-wide">
              To Do ({pendingNotes.length})
            </p>
            {pendingNotes.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                onToggle={() => toggleNote(note.id)}
                onDelete={() => deleteNote(note.id)}
              />
            ))}
          </div>
        )}

        {/* Completed Tasks */}
        {completedNotes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-wide">
              Completed ({completedNotes.length})
            </p>
            {completedNotes.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                onToggle={() => toggleNote(note.id)}
                onDelete={() => deleteNote(note.id)}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {notes.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-white/40">No tasks yet</p>
            <p className="text-xs text-white/30 mt-1">
              Add a task to get started
            </p>
          </div>
        )}

        {/* Quick Add Suggestions */}
        <div className="pt-3 border-t border-white/10">
          <p className="text-xs text-white/30 mb-2">Quick add:</p>
          <div className="flex flex-wrap gap-1">
            {["Study GS", "Practice MCQs", "Revise notes", "Mock test"].map(
              (suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => addNote(suggestion)}
                  className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded-full text-white/60 transition-colors"
                >
                  + {suggestion}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

interface NoteItemProps {
  note: { id: string; text: string; completed: boolean };
  onToggle: () => void;
  onDelete: () => void;
}

function NoteItem({ note, onToggle, onDelete }: NoteItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-2 rounded-lg transition-colors group",
        "bg-white/5 hover:bg-white/10"
      )}
    >
      <button
        onClick={onToggle}
        className={cn(
          "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
          note.completed
            ? "bg-primary border-primary"
            : "border-white/30 hover:border-primary"
        )}
      >
        {note.completed ? (
          <Check className="w-3 h-3 text-primary-foreground" />
        ) : (
          <Circle className="w-3 h-3 text-transparent" />
        )}
      </button>
      <span
        className={cn(
          "flex-1 text-sm",
          note.completed ? "text-white/40 line-through" : "text-white"
        )}
      >
        {note.text}
      </span>
      <button
        onClick={onDelete}
        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-white/40 hover:text-destructive transition-all"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
