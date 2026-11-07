"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useWidgetStore } from "@/stores/widget-store";
import type { WidgetId } from "@/types/widget.types";
import { WIDGET_CONFIGS } from "@/types/widget.types";
import { cn } from "@/lib/utils";

interface WidgetContainerProps {
  id: WidgetId;
  children: React.ReactNode;
  className?: string;
  isDragging?: boolean;
}

const sizeClasses = {
  sm: "widget-sm",
  md: "widget-md",
  lg: "widget-lg",
};

const widgetVariants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: {
      duration: 0.15,
    },
  },
};

export function WidgetContainer({ id, children, className, isDragging }: WidgetContainerProps) {
  const closeWidget = useWidgetStore((state) => state.closeWidget);
  const config = WIDGET_CONFIGS[id];
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeWidget(id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [id, closeWidget]);

  return (
    <motion.div
      ref={containerRef}
      variants={widgetVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn(
        "widget-glass overflow-hidden flex flex-col",
        sizeClasses[config.size],
        className
      )}
    >
      {/* Header - Draggable area */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0 select-none",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        <h3 className="text-sm font-semibold text-white">{config.title}</h3>
        <button
          onClick={() => closeWidget(id)}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {children}
      </div>
    </motion.div>
  );
}
