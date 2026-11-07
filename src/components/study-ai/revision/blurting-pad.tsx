"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Brain,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  Loader2,
  Timer,
  Trophy,
  RefreshCw,
  Keyboard,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { PaperBlurtUpload } from "./paper-blurt-upload";
import { UpgradeModal } from "@/components/tests/upgrade-modal";
import type { StudyAIGoal } from "@/types/study-ai.types";

interface BlurtingPadProps {
  goal: StudyAIGoal & {
    study_uploads?: any[];
    ai_generations?: any[];
  };
  sourceContent: string;
  isPro: boolean;
}

interface GapAnalysis {
  score: number;
  matchedPoints: string[];
  missedConcepts: string[];
  corrections: string[];
  feedback: string;
}

export function BlurtingPad({ goal, sourceContent, isPro }: BlurtingPadProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [mode, setMode] = useState<"digital" | "paper">("digital");
  const [userInput, setUserInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<GapAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startTime] = useState(Date.now());
  const [timeSpent, setTimeSpent] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // Live timer that ticks every second (only in digital mode, before analysis)
  useEffect(() => {
    if (mode !== "digital" || analysis) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [mode, analysis, startTime]);

  const handlePaperBlurtText = (extractedText: string) => {
    setUserInput(extractedText);
    setMode("digital"); // Switch to digital mode to show and edit the text
  };

  const handleAnalyze = async () => {
    if (!userInput.trim()) {
      setError("Please write something first!");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setTimeSpent(Math.floor((Date.now() - startTime) / 1000));

    try {
      const response = await fetch("/api/study-ai/blurt-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalId: goal.id,
          goalText: goal.goal_text,
          sourceContent,
          userInput: userInput.trim(),
          mode: mode,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze");
      }

      const data = await response.json();
      setAnalysis(data.analysis);
      setXpEarned(data.xpEarned || 0);
    } catch (err) {
      setError("Failed to analyze your response. Please try again.");
      console.error("Blurt analysis error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setUserInput("");
    setAnalysis(null);
    setError(null);
    setMode("digital");
    textareaRef.current?.focus();
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const getScoreMessage = (score: number) => {
    if (score >= 90) return "Excellent! You've mastered this topic!";
    if (score >= 80) return "Great job! Just a few concepts to review.";
    if (score >= 60) return "Good effort! Review the missed concepts.";
    if (score >= 40) return "Keep practicing! Focus on the key points.";
    return "Don't give up! Review the material and try again.";
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="text-white/70 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  Blurting Pad
                </h1>
                <p className="text-sm text-white/60">{goal.goal_text}</p>
              </div>
            </div>

            {!analysis && mode === "digital" && (
              <div className="flex items-center gap-2 text-white/60">
                <Timer className="w-4 h-4" />
                <span className="text-sm font-mono">
                  {formatTime(elapsedSeconds)}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <AnimatePresence mode="wait">
          {!analysis ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Instructions */}
              <div className="glass-card p-4 rounded-xl border border-primary/20">
                <h2 className="font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Active Recall Exercise
                </h2>
                <p className="text-sm text-white/70">
                  Without looking at your notes, write down everything you remember about{" "}
                  <span className="text-primary font-medium">{goal.goal_text}</span>.
                  Don't worry about organization - just dump everything from your memory!
                </p>
              </div>

              {/* Mode Tabs */}
              <Tabs value={mode} onValueChange={(v) => setMode(v as "digital" | "paper")} className="w-full">
                <TabsList className="grid grid-cols-2 bg-white/5 p-1 rounded-xl">
                  <TabsTrigger
                    value="digital"
                    className="flex items-center gap-2 data-[state=active]:bg-white/10"
                  >
                    <Keyboard className="w-4 h-4" />
                    Type
                  </TabsTrigger>
                  <TabsTrigger
                    value="paper"
                    className="flex items-center gap-2 data-[state=active]:bg-white/10"
                  >
                    <Camera className="w-4 h-4" />
                    Paper Blurt
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="digital" className="mt-4">
                  <div className="space-y-4">
                    <Textarea
                      ref={textareaRef}
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      placeholder="Start writing everything you remember..."
                      className="min-h-[400px] bg-white/5 border-white/10 focus:border-primary resize-none text-base leading-relaxed"
                      autoFocus
                    />

                    {error && (
                      <p className="text-red-400 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                      </p>
                    )}

                    <div className="flex justify-between items-center">
                      <p className="text-sm text-white/50">
                        {userInput.length} characters • {userInput.split(/\s+/).filter(Boolean).length} words
                      </p>
                      <Button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || !userInput.trim()}
                        className="gap-2"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Analyze My Response
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="paper" className="mt-4">
                  <PaperBlurtUpload
                    isPro={isPro}
                    onTextExtracted={handlePaperBlurtText}
                    onProRequired={() => setUpgradeModalOpen(true)}
                  />

                  {userInput && mode === "paper" && (
                    <div className="mt-4 space-y-4">
                      <div className="glass-card p-4 rounded-xl">
                        <h3 className="font-medium text-sm text-white/60 mb-2">Extracted Text:</h3>
                        <p className="text-sm text-white/80 whitespace-pre-wrap">{userInput}</p>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          onClick={handleAnalyze}
                          disabled={isAnalyzing || !userInput.trim()}
                          className="gap-2"
                        >
                          {isAnalyzing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              Analyze Handwritten Notes
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Score Card */}
              <div className="glass-card p-6 rounded-2xl text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.5 }}
                  className={cn(
                    "text-7xl font-bold mb-2",
                    getScoreColor(analysis.score)
                  )}
                >
                  {analysis.score}%
                </motion.div>
                <p className="text-white/70 mb-4">{getScoreMessage(analysis.score)}</p>

                <div className="flex justify-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="text-white/50">Time Spent</p>
                    <p className="font-semibold">{formatTime(timeSpent)}</p>
                  </div>
                  {xpEarned > 0 && (
                    <div className="text-center">
                      <p className="text-white/50">XP Earned</p>
                      <p className="font-semibold text-primary flex items-center justify-center gap-1">
                        <Trophy className="w-4 h-4" />
                        +{xpEarned}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Feedback */}
              <div className="glass-card p-4 rounded-xl">
                <p className="text-white/80">{analysis.feedback}</p>
              </div>

              {/* Matched Points */}
              {analysis.matchedPoints.length > 0 && (
                <div className="glass-card p-4 rounded-xl">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                    What You Got Right ({analysis.matchedPoints.length})
                  </h3>
                  <ul className="space-y-2">
                    {analysis.matchedPoints.map((point, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="text-sm text-white/70 flex items-start gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                        {point}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missed Concepts */}
              {analysis.missedConcepts.length > 0 && (
                <div className="glass-card p-4 rounded-xl">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-orange-400">
                    <AlertCircle className="w-5 h-5" />
                    Concepts to Review ({analysis.missedConcepts.length})
                  </h3>
                  <ul className="space-y-2">
                    {analysis.missedConcepts.map((concept, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + index * 0.05 }}
                        className="text-sm text-white/70 flex items-start gap-2"
                      >
                        <AlertCircle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                        {concept}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Corrections */}
              {analysis.corrections.length > 0 && (
                <div className="glass-card p-4 rounded-xl">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-red-400">
                    <XCircle className="w-5 h-5" />
                    Corrections ({analysis.corrections.length})
                  </h3>
                  <ul className="space-y-2">
                    {analysis.corrections.map((correction, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + index * 0.05 }}
                        className="text-sm text-white/70 flex items-start gap-2"
                      >
                        <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        {correction}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={handleReset} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Button>
                <Button onClick={() => router.back()} className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Goal
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Upgrade Modal */}
      <UpgradeModal open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen} />
    </div>
  );
}
