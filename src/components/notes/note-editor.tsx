"use client";

import { useState, useEffect } from "react";
import { X, Plus, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface NoteEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: string, tags: string[]) => Promise<void>;
  initialContent?: string;
  initialTags?: string[];
  isEditing?: boolean;
}

export function NoteEditor({
  isOpen,
  onClose,
  onSave,
  initialContent = "",
  initialTags = [],
  isEditing = false,
}: NoteEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [newTag, setNewTag] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
      setTags(initialTags);
      setNewTag("");
    }
  }, [isOpen, initialContent, initialTags]);

  const handleAddTag = () => {
    const tag = newTag.trim().toLowerCase().replace(/\s+/g, "-");
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleGenerateTags = async () => {
    if (!content.trim()) return;

    setIsGeneratingTags(true);
    try {
      const response = await fetch("/api/bot/extract-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        const { tags: generatedTags } = await response.json();
        // Merge with existing tags, avoiding duplicates
        const mergedTags = [...new Set([...tags, ...generatedTags])];
        setTags(mergedTags);
      }
    } catch (error) {
      console.error("Error generating tags:", error);
    } finally {
      setIsGeneratingTags(false);
    }
  };

  const handleSave = async () => {
    if (!content.trim()) return;

    setIsSaving(true);
    try {
      await onSave(content.trim(), tags);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Note" : "New Note"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Content */}
          <div>
            <Label htmlFor="content">Note</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your study note..."
              className="mt-1.5 min-h-[150px] bg-white/5 border-white/10"
              autoFocus
            />
          </div>

          {/* Tags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label>Tags</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGenerateTags}
                disabled={!content.trim() || isGeneratingTags}
                className="h-7 text-xs gap-1"
              >
                {isGeneratingTags ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Auto-tag
              </Button>
            </div>

            {/* Existing Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-primary/80"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add Tag Input */}
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a tag..."
                className="bg-white/5 border-white/10"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddTag}
                disabled={!newTag.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-white/40 mt-1">
              Press Enter to add a tag
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!content.trim() || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                "Update Note"
              ) : (
                "Save Note"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
