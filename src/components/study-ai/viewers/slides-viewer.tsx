"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  StickyNote,
  Timer,
} from "lucide-react";
import type { AnimatedSlide } from "@/types/study-ai.types";

// ---------------------------------------------------------------------------
// Animation variants per transition type
// ---------------------------------------------------------------------------
const variants: Record<string, any> = {
  fade: {
    enter: { opacity: 0 },
    center: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideLeft: {
    enter: (d: number) => ({ x: d > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -300 : 300, opacity: 0 }),
  },
  slideUp: {
    enter: { y: 80, opacity: 0 },
    center: { y: 0, opacity: 1 },
    exit: { y: -80, opacity: 0 },
  },
  zoom: {
    enter: { scale: 0.85, opacity: 0 },
    center: { scale: 1, opacity: 1 },
    exit: { scale: 1.1, opacity: 0 },
  },
  flip: {
    enter: { rotateY: 90, opacity: 0 },
    center: { rotateY: 0, opacity: 1 },
    exit: { rotateY: -90, opacity: 0 },
  },
};

// ---------------------------------------------------------------------------
// Theme gradient map
// ---------------------------------------------------------------------------
const themeGradients: Record<string, string> = {
  blue: "from-blue-500/20 to-cyan-500/10",
  green: "from-green-500/20 to-emerald-500/10",
  purple: "from-purple-500/20 to-pink-500/10",
  orange: "from-orange-500/20 to-amber-500/10",
  red: "from-red-500/20 to-rose-500/10",
  cyan: "from-cyan-500/20 to-teal-500/10",
};

const themeAccents: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  cyan: "bg-cyan-500",
};

const SPEED_OPTIONS = [
  { label: "4s", value: 4000 },
  { label: "6s", value: 6000 },
  { label: "8s", value: 8000 },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface SlidesViewerProps {
  slides: AnimatedSlide[];
  title: string;
  themeColor?: string;
}

// ---------------------------------------------------------------------------
// Layout renderers
// ---------------------------------------------------------------------------

function TitleLayout({ slide, gradient }: { slide: AnimatedSlide; gradient: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center h-full text-center px-6 bg-gradient-to-br", gradient)}>
      <span className="text-5xl mb-4">{slide.emoji || "📚"}</span>
      <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">{slide.title}</h2>
      {slide.bullets?.[0] && (
        <p className="text-base text-white/60 max-w-md">{slide.bullets[0]}</p>
      )}
    </div>
  );
}

function BulletsLayout({ slide, accent }: { slide: AnimatedSlide; accent: string }) {
  return (
    <div className="flex flex-col h-full px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">{slide.emoji || "📌"}</span>
        <h2 className="text-xl font-semibold text-white">{slide.title}</h2>
      </div>
      <div className="flex-1 flex flex-col justify-center gap-3">
        {slide.bullets?.map((bullet, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 * i }}
            className="flex items-start gap-3"
          >
            <div className={cn("w-1.5 h-1.5 rounded-full mt-2 shrink-0", accent)} />
            <p className="text-white/85 text-sm sm:text-base leading-relaxed">{bullet}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function TwoColumnLayout({ slide }: { slide: AnimatedSlide }) {
  return (
    <div className="flex flex-col h-full px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">{slide.emoji || "📊"}</span>
        <h2 className="text-xl font-semibold text-white">{slide.title}</h2>
      </div>
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {slide.leftColumn && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/5 border border-white/10 rounded-xl p-4"
          >
            <h3 className="text-sm font-semibold text-cyan-400 mb-3">{slide.leftColumn.heading}</h3>
            <ul className="space-y-2">
              {slide.leftColumn.items.map((item, i) => (
                <li key={i} className="text-white/75 text-sm flex items-start gap-2">
                  <span className="text-cyan-400 mt-0.5">•</span> {item}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
        {slide.rightColumn && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/5 border border-white/10 rounded-xl p-4"
          >
            <h3 className="text-sm font-semibold text-purple-400 mb-3">{slide.rightColumn.heading}</h3>
            <ul className="space-y-2">
              {slide.rightColumn.items.map((item, i) => (
                <li key={i} className="text-white/75 text-sm flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5">•</span> {item}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function HighlightLayout({ slide, gradient }: { slide: AnimatedSlide; gradient: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center h-full text-center px-8 bg-gradient-to-br", gradient)}>
      <span className="text-3xl mb-4">{slide.emoji || "💡"}</span>
      <motion.h2
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-xl sm:text-2xl font-bold text-white mb-3 max-w-lg leading-snug"
      >
        {slide.highlightText || slide.title}
      </motion.h2>
      {slide.highlightSubtext && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-white/60 text-sm sm:text-base max-w-md"
        >
          {slide.highlightSubtext}
        </motion.p>
      )}
    </div>
  );
}

function ComparisonLayout({ slide }: { slide: AnimatedSlide }) {
  return (
    <div className="flex flex-col h-full px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">{slide.emoji || "⚖️"}</span>
        <h2 className="text-xl font-semibold text-white">{slide.title}</h2>
      </div>
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {slide.leftColumn && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-green-500/10 border border-green-500/20 rounded-xl p-4"
          >
            <h3 className="text-sm font-semibold text-green-400 mb-3">{slide.leftColumn.heading}</h3>
            <ul className="space-y-2">
              {slide.leftColumn.items.map((item, i) => (
                <li key={i} className="text-white/75 text-sm flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span> {item}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
        {slide.rightColumn && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-red-500/10 border border-red-500/20 rounded-xl p-4"
          >
            <h3 className="text-sm font-semibold text-red-400 mb-3">{slide.rightColumn.heading}</h3>
            <ul className="space-y-2">
              {slide.rightColumn.items.map((item, i) => (
                <li key={i} className="text-white/75 text-sm flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">✗</span> {item}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function TimelineLayout({ slide, accent }: { slide: AnimatedSlide; accent: string }) {
  return (
    <div className="flex flex-col h-full px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">{slide.emoji || "📅"}</span>
        <h2 className="text-xl font-semibold text-white">{slide.title}</h2>
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <div className="relative pl-6 border-l-2 border-white/10 space-y-5">
          {slide.timelineItems?.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 * i }}
              className="relative"
            >
              <div className={cn("absolute -left-[25px] w-3 h-3 rounded-full border-2 border-[#0a0a12]", accent)} />
              <p className="text-xs font-semibold text-cyan-400 mb-0.5">{item.label}</p>
              <p className="text-white/75 text-sm">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClosingLayout({ slide, accent }: { slide: AnimatedSlide; accent: string }) {
  return (
    <div className="flex flex-col h-full px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">{slide.emoji || "🎯"}</span>
        <h2 className="text-xl font-semibold text-white">{slide.title}</h2>
      </div>
      <div className="flex-1 flex flex-col justify-center gap-3">
        {slide.bullets?.map((bullet, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.12 * i }}
            className="flex items-start gap-3 bg-white/5 rounded-lg px-4 py-3 border border-white/10"
          >
            <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold shrink-0 mt-0.5", accent)}>
              {i + 1}
            </div>
            <p className="text-white/85 text-sm">{bullet}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main SlidesViewer
// ---------------------------------------------------------------------------
export function SlidesViewer({ slides, title, themeColor = "blue" }: SlidesViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [autoPlaySpeed, setAutoPlaySpeed] = useState(6000);
  const [showNotes, setShowNotes] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const gradient = themeGradients[themeColor] || themeGradients.blue;
  const accent = themeAccents[themeColor] || themeAccents.blue;
  const currentSlide = slides[currentIndex];
  const transition = currentSlide?.transition || "fade";
  const v = variants[transition] || variants.fade;

  const handleNext = useCallback(() => {
    if (currentIndex < slides.length - 1) {
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsAutoPlaying(false);
    }
  }, [currentIndex, slides.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  // Auto-play
  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(handleNext, autoPlaySpeed);
    return () => clearInterval(timer);
  }, [isAutoPlaying, autoPlaySpeed, handleNext]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); handleNext(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); handlePrev(); }
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      if (e.key === "n" || e.key === "N") setShowNotes(prev => !prev);
      if (e.key === "Escape" && isFullscreen) exitFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNext, handlePrev, isFullscreen]);

  // Fullscreen change listener
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
  };

  // Swipe handling
  const dragEnd = (_: any, info: { offset: { x: number } }) => {
    if (info.offset.x < -80) handleNext();
    else if (info.offset.x > 80) handlePrev();
  };

  // Render layout
  const renderSlide = (slide: AnimatedSlide) => {
    switch (slide.layout) {
      case "title": return <TitleLayout slide={slide} gradient={gradient} />;
      case "bullets": return <BulletsLayout slide={slide} accent={accent} />;
      case "two-column": return <TwoColumnLayout slide={slide} />;
      case "highlight": return <HighlightLayout slide={slide} gradient={gradient} />;
      case "comparison": return <ComparisonLayout slide={slide} />;
      case "timeline": return <TimelineLayout slide={slide} accent={accent} />;
      case "closing": return <ClosingLayout slide={slide} accent={accent} />;
      default: return <BulletsLayout slide={slide} accent={accent} />;
    }
  };

  if (!slides.length) return null;

  return (
    <div ref={containerRef} className={cn("flex flex-col", isFullscreen ? "h-screen bg-[#0a0a12]" : "")}>
      {/* Slide Area */}
      <div className="relative bg-[#0e0e1a] border border-white/10 rounded-2xl overflow-hidden min-h-[340px] sm:min-h-[400px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={v}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="absolute inset-0"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={dragEnd}
          >
            {renderSlide(currentSlide)}
          </motion.div>
        </AnimatePresence>

        {/* Slide counter badge */}
        <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white/60 text-xs px-2.5 py-1 rounded-full">
          {currentIndex + 1} / {slides.length}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-4 px-1">
        {/* Prev */}
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 disabled:opacity-20 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Center controls */}
        <div className="flex items-center gap-2">
          {/* Auto-play toggle */}
          <button
            onClick={() => setIsAutoPlaying(prev => !prev)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              isAutoPlaying ? "text-cyan-400 bg-cyan-500/10" : "text-white/50 hover:text-white hover:bg-white/5"
            )}
            title={isAutoPlaying ? "Pause" : "Auto-play"}
          >
            {isAutoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          {/* Speed selector */}
          <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5">
            {SPEED_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setAutoPlaySpeed(opt.value)}
                className={cn(
                  "px-2 py-1 text-xs rounded-md transition-colors",
                  autoPlaySpeed === opt.value
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white/70"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Notes toggle */}
          <button
            onClick={() => setShowNotes(prev => !prev)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              showNotes ? "text-yellow-400 bg-yellow-500/10" : "text-white/50 hover:text-white hover:bg-white/5"
            )}
            title="Speaker notes (N)"
          >
            <StickyNote className="w-4 h-4" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
            title="Fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Next */}
        <button
          onClick={handleNext}
          disabled={currentIndex === slides.length - 1}
          className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 disabled:opacity-20 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 mt-3 flex-wrap">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => { setDirection(i > currentIndex ? 1 : -1); setCurrentIndex(i); }}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === currentIndex ? cn("w-5", accent) : "w-1.5 bg-white/20 hover:bg-white/40"
            )}
          />
        ))}
      </div>

      {/* Speaker Notes */}
      <AnimatePresence>
        {showNotes && currentSlide.speakerNotes && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden"
          >
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <StickyNote className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-xs font-medium text-yellow-400">Speaker Notes</span>
              </div>
              <p className="text-white/70 text-sm leading-relaxed">{currentSlide.speakerNotes}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
