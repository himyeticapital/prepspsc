"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useStatusNoteStore } from "@/stores/status-note-store";
import { useAuthStore } from "@/stores/auth-store";
import { searchTracks, type DeezerTrack } from "@/lib/deezer";
import { cn } from "@/lib/utils";
import { MessageCircle, Music, Search, Loader2, Play, Pause, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";

function AppleMusicLogo() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="opacity-30">
      <path
        d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 0 0-1.877-.726 10.496 10.496 0 0 0-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03c.525 0 1.048-.034 1.57-.1.823-.106 1.597-.35 2.296-.81a5.046 5.046 0 0 0 1.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.166-1.068.192-.538.04-1.01-.077-1.427-.396-.654-.5-.838-1.27-.49-2.04.175-.382.463-.665.824-.867.376-.212.784-.335 1.199-.424.313-.067.628-.122.942-.184.238-.05.347-.17.364-.412.005-.065.007-.13.007-.195V9.694a.63.63 0 0 0-.01-.134c-.027-.138-.126-.224-.26-.21-.07.007-.14.027-.207.046l-4.478 1.2c-.034.01-.068.02-.1.034-.106.048-.157.14-.166.253-.004.06-.005.122-.005.182v7.394c0 .09-.003.178-.01.267-.028.377-.09.748-.305 1.076-.346.524-.827.827-1.443.95-.282.058-.568.1-.855.126-.516.045-.987-.07-1.396-.388-.558-.436-.78-1.05-.58-1.756.124-.435.396-.77.763-1.018.34-.23.716-.376 1.103-.483.317-.09.637-.164.956-.242.17-.04.298-.14.337-.316.013-.06.02-.123.02-.184V7.816c0-.193.05-.368.186-.516.1-.112.223-.186.365-.22.08-.02.16-.04.24-.055L16.476 5.55c.156-.04.314-.072.475-.082.303-.02.506.166.53.472.004.06.006.122.006.183l.003 3.99h.08z"
        fill="currentColor"
      />
    </svg>
  );
}

interface CreateStatusNoteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateStatusNote({ open, onOpenChange }: CreateStatusNoteProps) {
  const { profile, user } = useAuthStore();
  const { myNote, createNote, deleteMyNote } = useStatusNoteStore();

  const [noteType, setNoteType] = useState<"note" | "music">("note");
  const [textContent, setTextContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DeezerTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<DeezerTrack | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchTracks(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
    }, 400);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setNoteType(myNote?.note_type || "note");
      setTextContent(myNote?.note_type === "note" ? myNote.content : "");
      setSelectedTrack(null);
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [open, myNote]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const togglePreview = useCallback((url: string) => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.addEventListener("ended", () => setIsPreviewPlaying(false));
    }

    if (previewAudioUrl === url && isPreviewPlaying) {
      audioRef.current.pause();
      setIsPreviewPlaying(false);
    } else {
      audioRef.current.pause();
      audioRef.current.src = url;
      audioRef.current.play().catch(() => {});
      setPreviewAudioUrl(url);
      setIsPreviewPlaying(true);
    }
  }, [previewAudioUrl, isPreviewPlaying]);

  const handleSelectTrack = (track: DeezerTrack) => {
    setSelectedTrack(track);
    setSearchQuery("");
    setSearchResults([]);
    // Stop any preview
    audioRef.current?.pause();
    setIsPreviewPlaying(false);
  };

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);

    let success = false;
    if (noteType === "note") {
      if (!textContent.trim()) {
        toast.error("Write something first!");
        setIsSubmitting(false);
        return;
      }
      success = await createNote(user.id, "note", textContent.trim());
    } else {
      if (!selectedTrack) {
        toast.error("Select a song first!");
        setIsSubmitting(false);
        return;
      }
      success = await createNote(user.id, "music", selectedTrack.title, {
        artist: selectedTrack.artist.name,
        previewUrl: selectedTrack.preview,
        albumArt: selectedTrack.album.cover_medium,
        deezerId: selectedTrack.id,
      });
    }

    setIsSubmitting(false);
    if (success) {
      toast.success("Note shared!");
      onOpenChange(false);
    } else {
      toast.error("Failed to share note");
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    const success = await deleteMyNote(user.id);
    if (success) {
      toast.success("Note removed");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-950 border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white text-center">New note</DialogTitle>
        </DialogHeader>

        {/* Type Toggle */}
        <div className="flex gap-2 justify-center">
          {(["note", "music"] as const).map((type) => (
            <button
              key={type}
              onClick={() => {
                setNoteType(type);
                audioRef.current?.pause();
                setIsPreviewPlaying(false);
              }}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all",
                noteType === type
                  ? type === "music"
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-white/15 text-white border border-white/20"
                  : "bg-white/5 text-white/50 border border-white/5 hover:bg-white/10"
              )}
            >
              {type === "note" ? (
                <MessageCircle className="w-4 h-4" />
              ) : (
                <Music className="w-4 h-4" />
              )}
              {type === "note" ? "Note" : "Music"}
            </button>
          ))}
        </div>

        {/* Live Preview */}
        <div className="flex justify-center py-4">
          <div className="relative inline-flex flex-col items-center">
            {/* Preview bubble */}
            <AnimatePresence mode="wait">
              {((noteType === "note" && textContent.trim()) ||
                (noteType === "music" && selectedTrack)) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 4 }}
                  className={cn(
                    "mb-2 px-2.5 py-1 rounded-full text-[11px] max-w-[160px] truncate",
                    "backdrop-blur-sm border",
                    noteType === "music"
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-white/10 text-white/80 border-white/10"
                  )}
                >
                  <span className="flex items-center gap-1">
                    {noteType === "music" ? (
                      <Music className="w-3 h-3 flex-shrink-0" />
                    ) : (
                      <MessageCircle className="w-3 h-3 flex-shrink-0" />
                    )}
                    <span className="truncate">
                      {noteType === "note" ? textContent : selectedTrack?.title}
                    </span>
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <Avatar className="w-16 h-16 border border-white/10">
              <AvatarImage src={profile?.avatar_url || ""} />
              <AvatarFallback className="bg-white/10 text-white text-lg">
                {profile?.full_name?.charAt(0)?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Input Area */}
        <div className="space-y-3">
          {noteType === "note" ? (
            <div>
              <Input
                value={textContent}
                onChange={(e) => setTextContent(e.target.value.slice(0, 60))}
                placeholder="Share a thought..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                autoFocus
              />
              <p className="text-[10px] text-white/30 text-right mt-1">
                {textContent.length}/60
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Selected Track */}
              {selectedTrack ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20"
                >
                  {selectedTrack.album.cover_small && (
                    <img
                      src={selectedTrack.album.cover_small}
                      alt=""
                      className="w-10 h-10 rounded-lg"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {selectedTrack.title}
                    </p>
                    <p className="text-xs text-white/50 truncate">
                      {selectedTrack.artist.name}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      togglePreview(selectedTrack.preview);
                    }}
                    className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center"
                  >
                    {isPreviewPlaying && previewAudioUrl === selectedTrack.preview ? (
                      <Pause className="w-4 h-4 text-primary" />
                    ) : (
                      <Play className="w-4 h-4 text-primary ml-0.5" />
                    )}
                  </button>
                  <button
                    onClick={() => setSelectedTrack(null)}
                    className="text-white/30 hover:text-white/60"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ) : (
                <>
                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search for a song..."
                      className="pl-9 pr-28 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      autoFocus
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {isSearching ? (
                        <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
                      ) : (
                        <>
                          <AppleMusicLogo />
                          <span className="text-[8px] text-white/20 font-medium tracking-wider uppercase">Music</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="max-h-[200px] overflow-y-auto overflow-x-hidden space-y-1 rounded-xl bg-white/5 p-2">
                      {searchResults.map((track) => (
                        <div
                          key={track.id}
                          onClick={() => handleSelectTrack(track)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSelectTrack(track); }}
                          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 transition-colors text-left cursor-pointer overflow-hidden"
                        >
                          {track.album.cover_small && (
                            <img
                              src={track.album.cover_small}
                              alt=""
                              className="w-9 h-9 rounded-md flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <p className="text-xs font-medium text-white truncate">
                              {track.title}
                            </p>
                            <p className="text-[10px] text-white/40 truncate">
                              {track.artist.name}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePreview(track.preview);
                            }}
                            className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"
                          >
                            {isPreviewPlaying && previewAudioUrl === track.preview ? (
                              <Pause className="w-3 h-3 text-white/60" />
                            ) : (
                              <Play className="w-3 h-3 text-white/60 ml-0.5" />
                            )}
                          </button>
                        </div>
                      ))}
                      {/* Apple Music attribution */}
                      <div className="flex items-center justify-center gap-1.5 pt-1.5 pb-0.5">
                        <AppleMusicLogo />
                        <span className="text-[9px] text-white/25 font-medium tracking-wide uppercase">Apple Music</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Expiry Note */}
        <div className="flex items-center justify-center gap-1 text-white/30 text-[10px]">
          <Clock className="w-3 h-3" />
          Disappears in 24 hours
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {myNote && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Remove
            </Button>
          )}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-white/50"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              (noteType === "note" && !textContent.trim()) ||
              (noteType === "music" && !selectedTrack)
            }
            className="bg-primary hover:bg-primary/80"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : myNote ? (
              "Replace"
            ) : (
              "Share"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
