"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WidgetId } from "@/types/widget.types";
import { BACKGROUNDS, LOFI_STREAMS } from "@/types/widget.types";
import { trackFeatureUsage } from "@/lib/track";

interface WidgetPosition {
  x: number;
  y: number;
}

interface WidgetState {
  // Active widgets
  activeWidgets: WidgetId[];

  // Focused widget (for z-index management)
  focusedWidget: WidgetId | null;

  // Widget positions (for dragging)
  widgetPositions: Partial<Record<WidgetId, WidgetPosition>>;

  // Background
  currentBackground: string;

  // Music
  isMusicPlaying: boolean;
  isMusicMinimized: boolean;
  currentStreamIndex: number;
  volume: number;

  // Timer
  isTimerMinimized: boolean;

  // Notes (stored locally)
  notes: NoteItem[];

  // Active task for Pomodoro
  activeTaskId: string | null;

  // Chat room selection for widget
  currentChatRoomId: number;

  // Actions
  toggleWidget: (id: WidgetId) => void;
  focusWidget: (id: WidgetId) => void;
  openWidget: (id: WidgetId) => void;
  closeWidget: (id: WidgetId) => void;
  closeAllWidgets: () => void;
  openWidgetExclusive: (id: WidgetId) => void;
  isWidgetOpen: (id: WidgetId) => boolean;

  // Background actions
  setBackground: (url: string) => void;

  // Music actions
  toggleMusic: () => void;
  setVolume: (volume: number) => void;
  nextStream: () => void;
  minimizeMusic: () => void;
  maximizeMusic: () => void;

  // Timer actions
  minimizeTimer: () => void;
  maximizeTimer: () => void;

  // Notes actions
  addNote: (text: string) => void;
  toggleNote: (id: string) => void;
  deleteNote: (id: string) => void;

  // Task actions
  setActiveTask: (taskId: string | null) => void;

  // Chat room actions
  setChatRoom: (roomId: number) => void;

  // Widget position actions
  setWidgetPosition: (id: WidgetId, x: number, y: number) => void;
}

interface NoteItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export const useWidgetStore = create<WidgetState>()(
  persist(
    (set, get) => ({
      // Initial state
      activeWidgets: [],
      focusedWidget: null,
      widgetPositions: {},
      currentBackground: BACKGROUNDS[0].url,
      isMusicPlaying: false,
      isMusicMinimized: false,
      currentStreamIndex: 0,
      volume: 50,
      isTimerMinimized: false,
      notes: [],
      activeTaskId: null,
      currentChatRoomId: 1,

      // Widget actions
      toggleWidget: (id) => {
        const { activeWidgets, isMusicMinimized, isTimerMinimized } = get();
        if (activeWidgets.includes(id)) {
          set({ activeWidgets: activeWidgets.filter((w) => w !== id) });
        } else {
          // If opening music/timer widget, clear minimized state
          const updates: Partial<WidgetState> = { activeWidgets: [...activeWidgets, id] };
          trackFeatureUsage(`widget:${id}`, "open");
          if (id === "music" && isMusicMinimized) {
            updates.isMusicMinimized = false;
          }
          if (id === "timer" && isTimerMinimized) {
            updates.isTimerMinimized = false;
          }
          set(updates);
        }
      },

      openWidget: (id) => {
        const { activeWidgets, isMusicMinimized, isTimerMinimized } = get();
        if (!activeWidgets.includes(id)) {
          // If opening music/timer widget, clear minimized state
          const updates: Partial<WidgetState> = { activeWidgets: [...activeWidgets, id] };
          trackFeatureUsage(`widget:${id}`, "open");
          if (id === "music" && isMusicMinimized) {
            updates.isMusicMinimized = false;
          }
          if (id === "timer" && isTimerMinimized) {
            updates.isTimerMinimized = false;
          }
          set(updates);
        }
      },

      closeWidget: (id) => {
        const { activeWidgets } = get();
        // If closing music/timer widget via X button, also clear minimized state
        const updates: Partial<WidgetState> = {
          activeWidgets: activeWidgets.filter((w) => w !== id)
        };
        if (id === "music") {
          updates.isMusicMinimized = false;
        }
        if (id === "timer") {
          updates.isTimerMinimized = false;
        }
        set(updates);
      },

      closeAllWidgets: () => {
        set({ activeWidgets: [] });
      },

      openWidgetExclusive: (id) => {
        const { activeWidgets, isMusicMinimized, isTimerMinimized } = get();

        // If widget is already open, close it (toggle behavior)
        if (activeWidgets.includes(id)) {
          const updates: Partial<WidgetState> = {
            activeWidgets: activeWidgets.filter((w) => w !== id),
          };
          // Clear minimized state if closing timer/music
          if (id === "music") updates.isMusicMinimized = false;
          if (id === "timer") updates.isTimerMinimized = false;
          set(updates);
          return;
        }

        // Build new state
        const updates: Partial<WidgetState> = {
          activeWidgets: [id], // Only the new widget
          focusedWidget: id,
        };
        trackFeatureUsage(`widget:${id}`, "open");

        // If timer was open, minimize it (keep running in background)
        if (activeWidgets.includes("timer") && id !== "timer") {
          updates.isTimerMinimized = true;
        }

        // If music was open, minimize it (keep playing in background)
        if (activeWidgets.includes("music") && id !== "music") {
          updates.isMusicMinimized = true;
        }

        // Clear minimized state if opening timer/music
        if (id === "timer" && isTimerMinimized) {
          updates.isTimerMinimized = false;
        }
        if (id === "music" && isMusicMinimized) {
          updates.isMusicMinimized = false;
        }

        set(updates);
      },

      isWidgetOpen: (id) => {
        return get().activeWidgets.includes(id);
      },

      focusWidget: (id) => {
        set({ focusedWidget: id });
      },

      // Background actions
      setBackground: (url) => {
        set({ currentBackground: url });
      },

      // Music actions
      toggleMusic: () => {
        set({ isMusicPlaying: !get().isMusicPlaying });
      },

      setVolume: (volume) => {
        set({ volume: Math.max(0, Math.min(100, volume)) });
      },

      nextStream: () => {
        const { currentStreamIndex } = get();
        const nextIndex = (currentStreamIndex + 1) % LOFI_STREAMS.length;
        set({ currentStreamIndex: nextIndex });
      },

      minimizeMusic: () => {
        const { activeWidgets } = get();
        // Close music widget and set minimized state
        set({
          isMusicMinimized: true,
          activeWidgets: activeWidgets.filter((w) => w !== "music"),
        });
      },

      maximizeMusic: () => {
        const { activeWidgets } = get();
        // Open music widget and clear minimized state
        set({
          isMusicMinimized: false,
          activeWidgets: activeWidgets.includes("music")
            ? activeWidgets
            : [...activeWidgets, "music"],
        });
      },

      // Timer actions
      minimizeTimer: () => {
        const { activeWidgets } = get();
        // Close timer widget and set minimized state
        set({
          isTimerMinimized: true,
          activeWidgets: activeWidgets.filter((w) => w !== "timer"),
        });
      },

      maximizeTimer: () => {
        const { activeWidgets } = get();
        // Open timer widget and clear minimized state
        set({
          isTimerMinimized: false,
          activeWidgets: activeWidgets.includes("timer")
            ? activeWidgets
            : [...activeWidgets, "timer"],
        });
      },

      // Notes actions
      addNote: (text) => {
        const newNote: NoteItem = {
          id: Date.now().toString(),
          text,
          completed: false,
          createdAt: Date.now(),
        };
        set({ notes: [...get().notes, newNote] });
      },

      toggleNote: (id) => {
        const { notes } = get();
        set({
          notes: notes.map((note) =>
            note.id === id ? { ...note, completed: !note.completed } : note
          ),
        });
      },

      deleteNote: (id) => {
        const { notes, activeTaskId } = get();
        // If deleting active task, clear it
        const updates: Partial<WidgetState> = {
          notes: notes.filter((note) => note.id !== id)
        };
        if (activeTaskId === id) {
          updates.activeTaskId = null;
        }
        set(updates);
      },

      // Task actions
      setActiveTask: (taskId) => {
        set({ activeTaskId: taskId });
      },

      // Chat room actions
      setChatRoom: (roomId) => {
        set({ currentChatRoomId: roomId });
      },

      // Widget position actions
      setWidgetPosition: (id, x, y) => {
        const { widgetPositions } = get();
        set({
          widgetPositions: {
            ...widgetPositions,
            [id]: { x, y },
          },
        });
      },
    }),
    {
      name: "prepspsc-widget-store",
      partialize: (state) => ({
        currentBackground: state.currentBackground,
        volume: state.volume,
        notes: state.notes,
        currentStreamIndex: state.currentStreamIndex,
        currentChatRoomId: state.currentChatRoomId,
        widgetPositions: state.widgetPositions,
      }),
    }
  )
);
