"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AIGenerationRow } from "@/types/database.types";
import type { FlashcardsOutput, Flashcard } from "@/types/study-ai.types";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Shuffle,
  ListChecks,
  Check,
  X,
  Bookmark,
  BookmarkCheck,
  Loader2,
} from "lucide-react";

interface FlashcardsViewerProps {
  generation: AIGenerationRow;
  goalText: string;
}

export function FlashcardsViewer({ generation, goalText }: FlashcardsViewerProps) {
  const searchParams = useSearchParams();
  const fromSaved = searchParams.get("from") === "saved";
  const data = generation.output_data as unknown as FlashcardsOutput;
  const [cards, setCards] = useState<Flashcard[]>(data.cards || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<Set<string>>(new Set());
  const [unknownCards, setUnknownCards] = useState<Set<string>>(new Set());
  const [isSaved, setIsSaved] = useState(generation.is_saved);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/study-ai/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId: generation.id,
          isSaved: !isSaved,
        }),
      });

      if (response.ok) {
        setIsSaved(!isSaved);
      }
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const currentCard = cards[currentIndex];
  const progress = ((currentIndex + 1) / cards.length) * 100;

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleReset = () => {
    setCards(data.cards || []);
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnownCards(new Set());
    setUnknownCards(new Set());
  };

  const handleMarkKnown = () => {
    setKnownCards((prev) => new Set(prev).add(currentCard.id));
    setUnknownCards((prev) => {
      const next = new Set(prev);
      next.delete(currentCard.id);
      return next;
    });
    handleNext();
  };

  const handleMarkUnknown = () => {
    setUnknownCards((prev) => new Set(prev).add(currentCard.id));
    setKnownCards((prev) => {
      const next = new Set(prev);
      next.delete(currentCard.id);
      return next;
    });
    handleNext();
  };

  if (!cards.length) {
    return (
      <div className="widget-glass p-12 rounded-2xl text-center">
        <ListChecks className="w-12 h-12 text-white/30 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No flashcards</h3>
        <p className="text-white/50">This generation doesn't have any flashcards.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Back Button */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Link
          href={fromSaved ? "/study-ai?tab=saved" : `/study-ai/goals/${generation.goal_id}`}
          className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">{fromSaved ? "Back to Saved" : "Back to Goal"}</span>
        </Link>
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="widget-glass p-4 rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">{data.title || "Flashcards"}</h1>
            <p className="text-sm text-white/60">{goalText}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleShuffle}>
              <Shuffle className="w-4 h-4 mr-1" />
              Shuffle
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                isSaved && "text-yellow-400"
              )}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : isSaved ? (
                <BookmarkCheck className="w-4 h-4 mr-1" />
              ) : (
                <Bookmark className="w-4 h-4 mr-1" />
              )}
              {isSaved ? "Saved" : "Save"}
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>Card {currentIndex + 1} of {cards.length}</span>
            <span>{knownCards.size} known · {unknownCards.size} to review</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-yellow-500 to-orange-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </motion.div>

      {/* Flashcard */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="perspective-1000"
      >
        <div
          onClick={handleFlip}
          className={cn(
            "relative h-64 sm:h-80 cursor-pointer transition-transform duration-500 transform-style-3d",
            isFlipped && "rotate-y-180"
          )}
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0)",
          }}
        >
          {/* Front */}
          <div
            className={cn(
              "absolute inset-0 widget-glass rounded-2xl p-6 flex flex-col items-center justify-center backface-hidden",
              knownCards.has(currentCard.id) && "border-2 border-green-500/30",
              unknownCards.has(currentCard.id) && "border-2 border-red-500/30"
            )}
            style={{ backfaceVisibility: "hidden" }}
          >
            <p className="text-xs text-white/40 mb-4">TAP TO FLIP</p>
            <p className="text-xl text-white text-center font-medium">{currentCard.front}</p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 widget-glass rounded-2xl p-6 flex flex-col items-center justify-center bg-gradient-to-br from-yellow-500/10 to-orange-500/10"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <p className="text-xs text-yellow-400/60 mb-4">ANSWER</p>
            <p className="text-lg text-white text-center">{currentCard.back}</p>
          </div>
        </div>
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center justify-between"
      >
        <Button
          variant="ghost"
          size="lg"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="text-white/60 hover:text-white"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleMarkUnknown}
            variant="outline"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <X className="w-4 h-4 mr-1" />
            Don't Know
          </Button>
          <Button
            onClick={handleMarkKnown}
            variant="outline"
            className="border-green-500/30 text-green-400 hover:bg-green-500/10"
          >
            <Check className="w-4 h-4 mr-1" />
            Know It
          </Button>
        </div>

        <Button
          variant="ghost"
          size="lg"
          onClick={handleNext}
          disabled={currentIndex === cards.length - 1}
          className="text-white/60 hover:text-white"
        >
          <ChevronRight className="w-6 h-6" />
        </Button>
      </motion.div>

      {/* Card Navigation Dots */}
      <div className="flex justify-center gap-1 flex-wrap">
        {cards.map((card, index) => (
          <button
            key={card.id}
            onClick={() => {
              setCurrentIndex(index);
              setIsFlipped(false);
            }}
            className={cn(
              "w-2 h-2 rounded-full transition-all",
              index === currentIndex
                ? "bg-yellow-500 w-4"
                : knownCards.has(card.id)
                ? "bg-green-500"
                : unknownCards.has(card.id)
                ? "bg-red-500"
                : "bg-white/20 hover:bg-white/40"
            )}
          />
        ))}
      </div>
    </div>
  );
}
