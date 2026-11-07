import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";

// Type matches the database.types.ts definition
export interface UserStatusNote {
  id: number;
  user_id: string;
  note_type: "note" | "music";
  content: string;
  music_artist: string | null;
  music_preview_url: string | null;
  music_album_art: string | null;
  music_deezer_id: number | null;
  expires_at: string;
  created_at: string;
}

interface MusicData {
  artist: string;
  previewUrl: string;
  albumArt: string;
  deezerId: number;
}

interface StatusNoteState {
  myNote: UserStatusNote | null;
  notesByUser: Record<string, UserStatusNote>;
  playingUserId: string | null;
  isLoading: boolean;

  fetchMyNote: (userId: string) => Promise<void>;
  fetchNotesForUsers: (userIds: string[]) => Promise<void>;
  createNote: (
    userId: string,
    noteType: "note" | "music",
    content: string,
    musicData?: MusicData
  ) => Promise<boolean>;
  deleteMyNote: (userId: string) => Promise<boolean>;
  setPlaying: (userId: string | null) => void;
  getNoteForUser: (userId: string) => UserStatusNote | null;
  subscribeToRealtime: () => () => void;
  clearExpiredFromCache: () => void;
}

export const useStatusNoteStore = create<StatusNoteState>((set, get) => ({
  myNote: null,
  notesByUser: {},
  playingUserId: null,
  isLoading: false,

  fetchMyNote: async (userId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("user_status_notes")
      .select("*")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    set({
      myNote: data as UserStatusNote | null,
      notesByUser: data
        ? { ...get().notesByUser, [userId]: data as UserStatusNote }
        : get().notesByUser,
    });
  },

  fetchNotesForUsers: async (userIds: string[]) => {
    if (userIds.length === 0) return;
    const supabase = createClient();

    const { data } = await supabase.rpc("get_active_status_notes", {
      user_ids: userIds,
    });

    if (data && Array.isArray(data)) {
      const notesMap: Record<string, UserStatusNote> = { ...get().notesByUser };
      // Only keep the latest note per user (function already orders by created_at DESC)
      const seen = new Set<string>();
      for (const note of data as UserStatusNote[]) {
        if (!seen.has(note.user_id)) {
          notesMap[note.user_id] = note;
          seen.add(note.user_id);
        }
      }
      set({ notesByUser: notesMap });
    }
  },

  createNote: async (
    userId: string,
    noteType: "note" | "music",
    content: string,
    musicData?: MusicData
  ) => {
    const supabase = createClient();

    // Delete any existing active note first
    await supabase
      .from("user_status_notes")
      .delete()
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString());

    const insertData: any = {
      user_id: userId,
      note_type: noteType,
      content,
    };

    if (noteType === "music" && musicData) {
      insertData.music_artist = musicData.artist;
      insertData.music_preview_url = musicData.previewUrl;
      insertData.music_album_art = musicData.albumArt;
      insertData.music_deezer_id = musicData.deezerId;
    }

    const { data, error } = await supabase
      .from("user_status_notes")
      .insert(insertData)
      .select()
      .single();

    if (error || !data) return false;

    const note = data as UserStatusNote;
    set({
      myNote: note,
      notesByUser: { ...get().notesByUser, [userId]: note },
    });
    return true;
  },

  deleteMyNote: async (userId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("user_status_notes")
      .delete()
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString());

    if (error) return false;

    const notesByUser = { ...get().notesByUser };
    delete notesByUser[userId];
    set({ myNote: null, notesByUser, playingUserId: get().playingUserId === userId ? null : get().playingUserId });
    return true;
  },

  setPlaying: (userId: string | null) => {
    set({ playingUserId: userId });
  },

  getNoteForUser: (userId: string) => {
    const note = get().notesByUser[userId];
    if (!note) return null;
    // Check if expired
    if (new Date(note.expires_at) <= new Date()) {
      // Remove from cache
      const notesByUser = { ...get().notesByUser };
      delete notesByUser[userId];
      set({ notesByUser });
      if (get().myNote?.user_id === userId) set({ myNote: null });
      return null;
    }
    return note;
  },

  subscribeToRealtime: () => {
    const supabase = createClient();
    const channel = supabase
      .channel("status-notes-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_status_notes" },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;

          if (eventType === "INSERT" || eventType === "UPDATE") {
            const note = newRow as UserStatusNote;
            if (new Date(note.expires_at) > new Date()) {
              set({
                notesByUser: { ...get().notesByUser, [note.user_id]: note },
              });
            }
          }

          if (eventType === "DELETE" && oldRow) {
            const userId = (oldRow as any).user_id;
            if (userId) {
              const notesByUser = { ...get().notesByUser };
              delete notesByUser[userId];
              set({ notesByUser });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  clearExpiredFromCache: () => {
    const now = new Date();
    const notesByUser = { ...get().notesByUser };
    let changed = false;
    for (const [userId, note] of Object.entries(notesByUser)) {
      if (new Date(note.expires_at) <= now) {
        delete notesByUser[userId];
        changed = true;
      }
    }
    if (changed) {
      set({ notesByUser });
      if (get().myNote && new Date(get().myNote!.expires_at) <= now) {
        set({ myNote: null });
      }
    }
  },
}));
