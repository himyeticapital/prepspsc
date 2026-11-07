"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Timer,
  Users,
  Trophy,
  BarChart3,
  Bookmark,
  ListTodo,
  Music,
  Image,
  Settings,
  Maximize,
  Medal,
  Pin,
  PanelLeftClose,
} from "lucide-react";
import { useWidgetStore } from "@/stores/widget-store";
import type { WidgetId } from "@/types/widget.types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type DockMode = "static" | "dynamic";

interface DockItem {
  id: WidgetId | "fullscreen" | "achievements";
  icon: React.ElementType;
  label: string;
  action?: "fullscreen" | "navigate";
  href?: string;
}

const mainItems: DockItem[] = [
  { id: "timer", icon: Timer, label: "Study Timer" },
  { id: "notes", icon: ListTodo, label: "Tasks" },
  { id: "chat", icon: Users, label: "Study Room" },
  { id: "leaderboard", icon: Trophy, label: "Leaderboard" },
  { id: "achievements", icon: Medal, label: "Achievements", action: "navigate", href: "/achievements" },
  { id: "stats", icon: BarChart3, label: "My Stats" },
  { id: "bookmarks", icon: Bookmark, label: "Saved Questions" },
];

const utilityItems: DockItem[] = [
  { id: "music", icon: Music, label: "Lofi Music" },
  { id: "background", icon: Image, label: "Background" },
  { id: "settings", icon: Settings, label: "Settings" },
  { id: "fullscreen", icon: Maximize, label: "Fullscreen", action: "fullscreen" },
];

export function SidebarDock({ className }: { className?: string }) {
  const router = useRouter();
  const { activeWidgets, openWidgetExclusive, isMusicPlaying } = useWidgetStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dockMode, setDockMode] = useState<DockMode>("static");
  const [isVisible, setIsVisible] = useState(true);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved dock mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("dock-mode") as DockMode | null;
    if (saved === "static" || saved === "dynamic") {
      setDockMode(saved);
      setIsVisible(saved === "static");
    }
  }, []);

  // Track fullscreen state and auto-hide dock in fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      // Auto-hide dock when entering fullscreen
      if (isNowFullscreen) {
        setIsVisible(false);
      } else if (dockMode === "static") {
        // Restore visibility when exiting fullscreen if dock is pinned
        setIsVisible(true);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [dockMode]);

  // Check if dock should auto-hide (dynamic mode OR fullscreen)
  const shouldAutoHide = dockMode === "dynamic" || isFullscreen;

  // Handle mouse near left edge for auto-hide mode
  useEffect(() => {
    if (!shouldAutoHide) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientX <= 8) {
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = null;
        }
        setIsVisible(true);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [shouldAutoHide]);

  const handleDockMouseEnter = useCallback(() => {
    if (!shouldAutoHide) return;
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsVisible(true);
  }, [shouldAutoHide]);

  const handleDockMouseLeave = useCallback(() => {
    if (!shouldAutoHide) return;
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 400);
  }, [shouldAutoHide]);

  const toggleDockMode = () => {
    const newMode: DockMode = dockMode === "static" ? "dynamic" : "static";
    setDockMode(newMode);
    localStorage.setItem("dock-mode", newMode);
    if (newMode === "static") {
      setIsVisible(true);
    }
  };

  const handleClick = (item: DockItem) => {
    if (item.action === "fullscreen") {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen();
      }
      return;
    }
    if (item.action === "navigate" && item.href) {
      router.push(item.href);
      return;
    }
    openWidgetExclusive(item.id as WidgetId);
  };

  const isActive = (id: string) => {
    if (id === "fullscreen") return isFullscreen;
    return activeWidgets.includes(id as WidgetId);
  };

  return (
    <TooltipProvider delayDuration={200}>
      {/* Hover trigger zone - when auto-hiding and hidden */}
      {shouldAutoHide && !isVisible && (
        <div
          className="fixed left-0 top-0 w-2 h-full z-50"
          onMouseEnter={handleDockMouseEnter}
        />
      )}

      <motion.aside
        initial={{ x: -64, opacity: 0 }}
        animate={{
          x: isVisible ? 0 : -72,
          opacity: isVisible ? 1 : 0,
        }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        onMouseEnter={handleDockMouseEnter}
        onMouseLeave={handleDockMouseLeave}
        className={cn(
          "fixed left-0 top-20 z-40",
          "w-16 py-4 px-2",
          "dock-glass rounded-r-2xl",
          "flex flex-col items-center gap-1",
          "max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-hide",
          className
        )}
      >
        {/* Dock Mode Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleDockMode}
              className={cn(
                "dock-button relative mb-1",
                dockMode === "static" && "active"
              )}
            >
              {dockMode === "static" ? (
                <Pin className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </motion.button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={12}>
            <p>{dockMode === "static" ? "Auto-hide dock" : "Pin dock"}</p>
          </TooltipContent>
        </Tooltip>

        {/* Divider */}
        <div className="w-8 h-px bg-white/10 my-1" />

        {/* Main Items */}
        <div className="flex flex-col items-center gap-1">
          {mainItems.map((item) => (
            <DockButton
              key={item.id}
              item={item}
              isActive={isActive(item.id)}
              onClick={() => handleClick(item)}
              showEqualizer={item.id === "music" && isMusicPlaying}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="w-8 h-px bg-white/10 my-2" />

        {/* Utility Items */}
        <div className="flex flex-col items-center gap-1">
          {utilityItems.map((item) => (
            <DockButton
              key={item.id}
              item={item}
              isActive={isActive(item.id)}
              onClick={() => handleClick(item)}
              showEqualizer={item.id === "music" && isMusicPlaying}
            />
          ))}
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}

interface DockButtonProps {
  item: DockItem;
  isActive: boolean;
  onClick: () => void;
  showEqualizer?: boolean;
}

function DockButton({ item, isActive, onClick, showEqualizer }: DockButtonProps) {
  const Icon = item.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClick}
          className={cn("dock-button relative", isActive && "active")}
        >
          {showEqualizer ? (
            <div className="flex items-end gap-0.5 h-5">
              <div className="equalizer-bar" />
              <div className="equalizer-bar" />
              <div className="equalizer-bar" />
            </div>
          ) : (
            <Icon className="w-5 h-5" />
          )}

          {/* Active indicator dot */}
          {isActive && (
            <motion.div
              layoutId="dock-indicator"
              className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded-full"
            />
          )}
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={12}>
        <p>{item.label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
