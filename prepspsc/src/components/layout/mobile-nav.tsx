"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { cn } from "@/lib/utils";
import { useWidgetStore } from "@/stores/widget-store";
import { useTimerStore } from "@/stores/timer-store";
import { useNewsStore } from "@/stores/news-store";
import type { WidgetId } from "@/types/widget.types";
import {
  Timer,
  BookOpen,
  Users,
  User,
  Music,
  Brain,
  Home,
  Newspaper,
  Plus,
  X,
  ListTodo,
  Trophy,
  Image,
  Bookmark,
  Medal,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface NavItem {
  type: "link" | "widget";
  href?: string;
  widgetId?: WidgetId;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { type: "link", href: "/dashboard", label: "Home", icon: Home },
  { type: "link", href: "/rooms", label: "Rooms", icon: Users },
  { type: "link", href: "/tests", label: "Tests", icon: BookOpen },
  { type: "link", href: "/study-ai", label: "Study", icon: Brain },
  { type: "link", href: "/profile", label: "Profile", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const { activeWidgets, toggleWidget, isMusicPlaying } = useWidgetStore();
  const { status, elapsedSeconds, targetSeconds, mode } = useTimerStore();
  const { isOpen: isNewsOpen, toggleOpen: toggleNews } = useNewsStore();

  const handleItemClick = (item: NavItem) => {
    if (item.type === "widget" && item.widgetId) {
      toggleWidget(item.widgetId);
    }
  };

  const isItemActive = (item: NavItem) => {
    if (item.type === "link" && item.href) {
      return pathname.startsWith(item.href);
    }
    if (item.type === "widget" && item.widgetId) {
      return activeWidgets.includes(item.widgetId);
    }
    return false;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getDisplayTime = () => {
    if (mode === "stopwatch") {
      return formatTime(elapsedSeconds);
    }
    const remaining = Math.max(0, targetSeconds - elapsedSeconds);
    return formatTime(remaining);
  };

  const isTimerActive = activeWidgets.includes("timer");
  const isTimerRunning = status === "running";
  const isMusicActive = activeWidgets.includes("music");

  const isTasksActive = activeWidgets.includes("notes");
  const isBookmarksActive = activeWidgets.includes("bookmarks");
  const isBackgroundActive = activeWidgets.includes("background");
  const isLeaderboardActive = activeWidgets.includes("leaderboard");

  const fabItems = [
    {
      id: "timer",
      icon: Timer,
      label: "Timer",
      isActive: isTimerActive,
      hasIndicator: isTimerRunning,
      indicatorColor: "bg-green-400",
      onClick: () => {
        toggleWidget("timer");
        setIsFabOpen(false);
      },
    },
    {
      id: "music",
      icon: Music,
      label: "Music",
      isActive: isMusicActive,
      hasIndicator: isMusicPlaying,
      indicatorColor: "bg-green-500",
      onClick: () => {
        toggleWidget("music");
        setIsFabOpen(false);
      },
    },
    {
      id: "news",
      icon: Newspaper,
      label: "News",
      isActive: isNewsOpen,
      hasIndicator: false,
      onClick: () => {
        toggleNews();
        setIsFabOpen(false);
      },
    },
    {
      id: "tasks",
      icon: ListTodo,
      label: "Tasks",
      isActive: isTasksActive,
      hasIndicator: false,
      onClick: () => {
        toggleWidget("notes");
        setIsFabOpen(false);
      },
    },
    {
      id: "achievements",
      icon: Trophy,
      label: "Achievements",
      isActive: pathname === "/achievements",
      hasIndicator: false,
      onClick: () => {
        router.push("/achievements");
        setIsFabOpen(false);
      },
    },
    {
      id: "background",
      icon: Image,
      label: "Background",
      isActive: isBackgroundActive,
      hasIndicator: false,
      onClick: () => {
        toggleWidget("background");
        setIsFabOpen(false);
      },
    },
    {
      id: "bookmarks",
      icon: Bookmark,
      label: "Saved",
      isActive: isBookmarksActive,
      hasIndicator: false,
      onClick: () => {
        toggleWidget("bookmarks");
        setIsFabOpen(false);
      },
    },
    {
      id: "leaderboard",
      icon: Medal,
      label: "Leaderboard",
      isActive: isLeaderboardActive,
      hasIndicator: false,
      onClick: () => {
        toggleWidget("leaderboard");
        setIsFabOpen(false);
      },
    },
  ];

  return (
    <>
      {/* Drag constraints container - covers the whole screen */}
      <div
        ref={constraintsRef}
        className="fixed inset-0 pointer-events-none z-40 md:hidden"
        style={{ top: 60, bottom: 80 }} // Leave space for header and bottom nav
      />

      {/* Floating Action Button Menu - Draggable */}
      <motion.div
        className="fixed z-50 md:hidden flex flex-col-reverse items-center gap-3 touch-none"
        drag
        dragConstraints={constraintsRef}
        dragElastic={0.1}
        dragMomentum={false}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setTimeout(() => setIsDragging(false), 100)}
        initial={{ right: 16, bottom: 96 }}
        style={{ right: 16, bottom: 96 }}
      >
        {/* FAB Items */}
        <AnimatePresence>
          {isFabOpen && fabItems.map((item, index) => (
            <motion.button
              key={item.id}
              initial={{ scale: 0, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0, y: 20 }}
              transition={{ delay: index * 0.05 }}
              onClick={item.onClick}
              className={cn(
                "w-12 h-12 rounded-full shadow-lg",
                "flex items-center justify-center",
                "border border-white/20",
                item.isActive
                  ? "bg-primary text-primary-foreground"
                  : "dock-glass text-white/80"
              )}
            >
              <div className="relative">
                <item.icon className="w-5 h-5" />
                {item.hasIndicator && (
                  <span className={cn("absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse", item.indicatorColor)} />
                )}
              </div>
            </motion.button>
          ))}
        </AnimatePresence>

        {/* Main FAB Button */}
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={() => {
            // Only toggle if not dragging
            if (!isDragging) {
              setIsFabOpen(!isFabOpen);
            }
          }}
          className={cn(
            "w-14 h-14 rounded-full shadow-lg",
            "flex items-center justify-center",
            "border border-white/20",
            isFabOpen
              ? "bg-primary text-primary-foreground"
              : isTimerRunning || isMusicPlaying
              ? "bg-gradient-to-r from-primary to-accent text-white"
              : "dock-glass text-white/80"
          )}
        >
          <motion.div
            animate={{ rotate: isFabOpen ? 45 : 0 }}
            transition={{ duration: 0.2 }}
          >
            {isFabOpen ? (
              <X className="w-6 h-6" />
            ) : isTimerRunning ? (
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold tabular-nums">{getDisplayTime()}</span>
              </div>
            ) : (
              <Plus className="w-6 h-6" />
            )}
          </motion.div>
          {/* Indicator when something is active */}
          {!isFabOpen && (isTimerRunning || isMusicPlaying) && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
          )}
        </motion.button>
      </motion.div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden dock-glass border-t border-white/10 safe-area-bottom">
        <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = isItemActive(item);
          const Icon = item.icon;

          if (item.type === "link" && item.href) {
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 w-full h-full relative transition-colors",
                  isActive ? "text-primary" : "text-white/60"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-nav-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-full"
                  />
                )}
                <Icon className="w-5 h-5" />
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          }

          return (
            <button
              key={item.label}
              onClick={() => handleItemClick(item)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-full h-full relative transition-colors",
                isActive ? "text-primary" : "text-white/60"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-full"
                />
              )}
              <Icon className="w-5 h-5" />
              <span className="text-xs">{item.label}</span>
            </button>
          );
        })}

      </div>
    </nav>
    </>
  );
}
