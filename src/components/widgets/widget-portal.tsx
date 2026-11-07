"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useWidgetStore } from "@/stores/widget-store";
import { WidgetContainer } from "./widget-container";
import { TimerWidget } from "./timer-widget";
import { TestsWidget } from "./tests-widget";
import { StatsWidget } from "./stats-widget";
import { LeaderboardWidget } from "./leaderboard-widget";
import { ChatWidget } from "./chat-widget";
import { BookmarksWidget } from "./bookmarks-widget";
import { NotesWidget } from "./notes-widget";
import { BackgroundWidget } from "./background-widget";
import { SettingsWidget } from "./settings-widget";
import { MusicWidget } from "./music-widget";
import { NotificationsWidget } from "./notifications-widget";
import { MusicMiniPlayer } from "./music-mini-player";
import { TimerMiniPlayer } from "./timer-mini-player";
import type { WidgetId } from "@/types/widget.types";

const widgetComponents: Record<WidgetId, React.ComponentType> = {
  timer: TimerWidget,
  tests: TestsWidget,
  stats: StatsWidget,
  leaderboard: LeaderboardWidget,
  chat: ChatWidget,
  bookmarks: BookmarksWidget,
  notes: NotesWidget,
  background: BackgroundWidget,
  settings: SettingsWidget,
  music: MusicWidget,
  notifications: NotificationsWidget,
};

// Default cascade positioning for new widgets
const CASCADE_CONFIG = {
  startX: 120,        // After sidebar
  startY: 100,        // After navbar
  offsetX: 40,        // Horizontal cascade offset
  offsetY: 40,        // Vertical cascade offset
};

const getDefaultPosition = (index: number) => {
  const { startX, startY, offsetX, offsetY } = CASCADE_CONFIG;
  return {
    x: startX + (index * offsetX),
    y: startY + (index * offsetY),
  };
};

export function WidgetPortal() {
  const pathname = usePathname();
  const activeWidgets = useWidgetStore((state) => state.activeWidgets);
  const focusedWidget = useWidgetStore((state) => state.focusedWidget);
  const focusWidget = useWidgetStore((state) => state.focusWidget);
  const widgetPositions = useWidgetStore((state) => state.widgetPositions);
  const setWidgetPosition = useWidgetStore((state) => state.setWidgetPosition);
  const isMusicMinimized = useWidgetStore((state) => state.isMusicMinimized);
  const isTimerMinimized = useWidgetStore((state) => state.isTimerMinimized);

  // Drag state
  const [dragging, setDragging] = useState<WidgetId | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Check if we're on a room page - hide chat widget there since room has its own chat
  const isOnRoomPage = pathname?.startsWith("/room/");

  // Filter out chat widget when on room page
  const filteredWidgets = isOnRoomPage
    ? activeWidgets.filter((id) => id !== "chat")
    : activeWidgets;

  // Get position for a widget (stored or default)
  const getWidgetPosition = useCallback((widgetId: WidgetId, index: number) => {
    const stored = widgetPositions[widgetId];
    if (stored) {
      return stored;
    }
    return getDefaultPosition(index);
  }, [widgetPositions]);

  // Handle drag start on widget header
  const handleDragStart = useCallback((e: React.MouseEvent, widgetId: WidgetId, index: number) => {
    // Only start drag if clicking on the header area (top 40px)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    if (clickY > 40) return; // Not on header

    e.preventDefault();
    const position = getWidgetPosition(widgetId, index);
    setDragging(widgetId);
    setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
    focusWidget(widgetId);
  }, [getWidgetPosition, focusWidget]);

  // Handle mouse move during drag
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;

    const newX = Math.max(0, e.clientX - dragOffset.x);
    const newY = Math.max(0, e.clientY - dragOffset.y);
    setWidgetPosition(dragging, newX, newY);
  }, [dragging, dragOffset, setWidgetPosition]);

  // Handle drag end
  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  // Add global mouse listeners for drag
  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  return (
    <>
      <div className="fixed inset-0 z-30 pointer-events-none">
        <AnimatePresence>
          {filteredWidgets.map((widgetId, index) => {
            const Component = widgetComponents[widgetId];
            const position = getWidgetPosition(widgetId, index);
            const isFocused = focusedWidget === widgetId;
            const isDragging = dragging === widgetId;

            return (
              <div
                key={widgetId}
                className="absolute pointer-events-auto"
                style={{
                  left: position.x,
                  top: position.y,
                  zIndex: isFocused ? 35 : 30,
                  cursor: isDragging ? "grabbing" : "default",
                }}
                onMouseDown={(e) => {
                  focusWidget(widgetId);
                  handleDragStart(e, widgetId, index);
                }}
              >
                <WidgetContainer id={widgetId} isDragging={isDragging}>
                  <Component />
                </WidgetContainer>
              </div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Minimized Music Player */}
      <AnimatePresence>
        {isMusicMinimized && <MusicMiniPlayer />}
      </AnimatePresence>

      {/* Minimized Timer Player */}
      <AnimatePresence>
        {isTimerMinimized && <TimerMiniPlayer />}
      </AnimatePresence>
    </>
  );
}
