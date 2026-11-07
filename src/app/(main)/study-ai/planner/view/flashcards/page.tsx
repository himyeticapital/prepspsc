"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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

interface Flashcard {
  id: string;
  front: string;
  back: string;
  difficulty?: string;
}

interface PlannerFlashcardsData {
  title: string;
  cards: Flashcard[];
  subject: string;
  topics: string[];
  topicKey?: string;
  planId?: string;
}

export default function PlannerFlashcardsViewerPage() {
  const [data, setData] = useState<PlannerFlashcardsData | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<Set<string>>(new Set());
  const [unknownCards, setUnknownCards] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    try {
      const storedData = sessionStorage.getItem("planner-flashcards-data");
      if (storedData) {
        const parsed = JSON.parse(storedData);
        setData(parsed);
        setCards(parsed.cards || []);
      } else {
        setError("No flashcards data found. Please generate flashcards first.");
      }
    } catch (err) {
      console.error("Failed to load flashcards data:", err);
      setError("Failed to load flashcards data.");
    }
  }, []);

  const handleSave = async () => {
    if (!data || isSaving || isSaved) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/study-ai/save-planner-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          generationType: "flashcards",
          outputData: {
            title: data.title,
            cards: data.cards,
          },
          subject: data.subject,
          topics: data.topics,
        }),
      });

      if (response.ok) {
        setIsSaved(true);
        toast.success("Flashcards saved! Find them in Study with AI → Saved section.");
      } else {
        const result = await response.json();
        toast.error(result.error || "Failed to save");
      }
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save flashcards");
    } finally {
      setIsSaving(false);
    }
  };

  const currentCard = cards[currentIndex];
  const progress = cards.length ? ((currentIndex + 1) / cards.length) * 100 : 0;

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
    if (data) {
      setCards(data.cards || []);
    }
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnownCards(new Set());
    setUnknownCards(new Set());
  };

  const handleMarkKnown = () => {
    if (currentCard) {
      setKnownCards((prev) => new Set(prev).add(currentCard.id));
      setUnknownCards((prev) => {
        const next = new Set(prev);
        next.delete(currentCard.id);
        return next;
      });
      handleNext();
    }
  };

  const handleMarkUnknown = () => {
    if (currentCard) {
      setUnknownCards((prev) => new Set(prev).add(currentCard.id));
      setKnownCards((prev) => {
        const next = new Set(prev);
        next.delete(currentCard.id);
        return next;
      });
      handleNext();
    }
  };

  const getBackUrl = () => {
    if (data?.topicKey) {
      const params = new URLSearchParams({ tab: "planner", expand: data.topicKey });
      if (data.planId) params.set("planId", data.planId);
      params.set("notebook", "true");
      return `/study-ai?${params.toString()}`;
    }
    return "/study-ai?tab=planner";
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-white/60 mb-4">{error}</p>
          <Button asChild className="bg-purple-600 hover:bg-purple-700">
            <Link href={getBackUrl()}>Go Back</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!data || !cards.length) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <div className="text-center">
          <ListChecks className="w-12 h-12 text-white/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No flashcards</h3>
          <p className="text-white/50 mb-4">This generation doesn't have any flashcards.</p>
          <Button asChild className="bg-purple-600 hover:bg-purple-700">
            <Link href={getBackUrl()}>Go Back</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back Button */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <Link
            href={getBackUrl()}
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Study Planner</span>
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-sm border border-white/10 p-4 rounded-2xl"
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-lg font-semibold text-white">{data.title}</h1>
              <p className="text-sm text-white/60">{data.subject} - {data.topics?.join(", ")}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={handleShuffle}>
                <Shuffle className="w-4 h-4 mr-1" />
                Shuffle
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={isSaving || isSaved}
                className={cn(
                  "gap-1 border-white/20 text-white hover:bg-white/10",
                  isSaved && "text-yellow-400 border-yellow-400/50"
                )}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isSaved ? (
                  <BookmarkCheck className="w-4 h-4" />
                ) : (
                  <Bookmark className="w-4 h-4" />
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
        >
          <div
            onClick={handleFlip}
            className="cursor-pointer"
            style={{
              perspective: "1000px",
            }}
          >
            <div
              className="relative h-64 sm:h-80 transition-transform duration-500"
              style={{
                transformStyle: "preserve-3d",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0)",
              }}
            >
              {/* Front */}
              <div
                className={cn(
                  "absolute inset-0 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center",
                  knownCards.has(currentCard?.id) && "border-2 border-green-500/30",
                  unknownCards.has(currentCard?.id) && "border-2 border-red-500/30"
                )}
                style={{ backfaceVisibility: "hidden" }}
              >
                <p className="text-xs text-white/40 mb-4">TAP TO FLIP</p>
                <p className="text-xl text-white text-center font-medium">{currentCard?.front}</p>
              </div>

              {/* Back */}
              <div
                className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl p-6 flex flex-col items-center justify-center"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <p className="text-xs text-yellow-400/60 mb-4">ANSWER</p>
                <p className="text-lg text-white text-center">{currentCard?.back}</p>
              </div>
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
    </div>
  );
}
