"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Pin,
  Pencil,
  Trash2,
  MoreVertical,
  Smartphone,
  Globe,
  Mic,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

interface NoteCardProps {
  note: StudyNote;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}

// Source badge component
const SourceBadge = ({ source }: { source: string }) => {
  const config = {
    telegram: {
      icon: MessageCircle,
      label: "Telegram",
      className: "bg-blue-500/20 text-blue-400",
    },
    whatsapp: {
      icon: Smartphone,
      label: "WhatsApp",
      className: "bg-green-500/20 text-green-400",
    },
    voice: {
      icon: Mic,
      label: "Voice",
      className: "bg-purple-500/20 text-purple-400",
    },
    web: {
      icon: Globe,
      label: "Web",
      className: "bg-white/10 text-white/60",
    },
  };

  const { icon: Icon, label, className } = config[source as keyof typeof config] || config.web;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
};

export function NoteCard({ note, onEdit, onDelete, onTogglePin }: NoteCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = () => {
    onDelete();
    setShowDeleteConfirm(false);
  };

  // Format date
  const dateStr = format(new Date(note.created_at), "MMM d, yyyy");
  const timeStr = format(new Date(note.created_at), "h:mm a");

  // Truncate content for preview
  const previewContent = note.content.length > 200
    ? note.content.substring(0, 200) + "..."
    : note.content;

  return (
    <>
      <div
        className={cn(
          "glass-card p-4 h-full flex flex-col",
          note.is_pinned && "ring-1 ring-primary/50"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <SourceBadge source={note.source} />
            {note.is_pinned && (
              <Pin className="w-3 h-3 text-primary fill-primary" />
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onTogglePin}>
                <Pin className="w-4 h-4 mr-2" />
                {note.is_pinned ? "Unpin" : "Pin"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowDeleteConfirm(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Content */}
        <div className="flex-1 mb-3">
          <p className="text-white/80 text-sm whitespace-pre-wrap break-words">
            {previewContent}
          </p>
        </div>

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {note.tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full"
              >
                #{tag}
              </span>
            ))}
            {note.tags.length > 5 && (
              <span className="px-2 py-0.5 text-white/40 text-xs">
                +{note.tags.length - 5} more
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-xs text-white/40 flex items-center justify-between">
          <span>{dateStr}</span>
          <span>{timeStr}</span>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
