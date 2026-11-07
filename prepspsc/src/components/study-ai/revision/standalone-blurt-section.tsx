"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
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
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { PaperBlurtUpload } from "./paper-blurt-upload";
import { UpgradeModal } from "@/components/tests/upgrade-modal";
import { createClient } from "@/lib/supabase/client";
import type { StudyAIGoalRow } from "@/types/database.types";

interface StandaloneBlurtSectionProps {
  goals: StudyAIGoalRow[];
  isPro: boolean;
  userId: string;
}

type BlurtState = "idle" | "selecting" | "blurting" | "results";

interface GapAnalysis {
  score: number;
  matchedPoints: string[];
  missedConcepts: string[];
  corrections: string[];
  feedback: string;
}

export function StandaloneBlurtSection({
  goals,
  isPro,
  userId,
}: StandaloneBlurtSectionProps) {
  const isDev = process.env.NODE_ENV === "development";
  const effectiveIsPro = isPro || isDev;

  const [state, setState] = useState<BlurtState>("idle");
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const [customTopic, setCustomTopic] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Blurting state
  const [mode, setMode] = useState<"digital" | "paper">("digital");
  const [userInput, setUserInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<GapAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Timer
  useEffect(() => {
    if (state !== "blurting" || mode !== "digital" || analysis) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [state, mode, analysis, startTime]);

  const topicText = selectedGoalId
    ? goals.find((g) => g.id === selectedGoalId)?.goal_text || ""
    : customTopic;

  const handleStartSession = async () => {
    if (!topicText.trim()) return;

    // If goal selected, fetch source content
    if (selectedGoalId) {
      setIsLoadingContent(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("study_uploads")
          .select("extracted_text")
          .eq("goal_id", selectedGoalId);

        const content =
          data
            ?.map((u) => u.extracted_text)
            .filter(Boolean)
            .join("\n\n") || "";
        setSourceContent(content);
      } catch (err) {
        console.error("Failed to fetch source content:", err);
      } finally {
        setIsLoadingContent(false);
      }
    } else {
      setSourceContent("");
    }

    setStartTime(Date.now());
    setElapsedSeconds(0);
    setState("blurting");
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
          goalId: selectedGoalId || null,
          goalText: topicText,
          sourceContent: sourceContent || null,
          userInput: userInput.trim(),
          mode,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze");
      }

      const data = await response.json();
      setAnalysis(data.analysis);
      setXpEarned(data.xpEarned || 0);
      setState("results");
    } catch (err) {
      setError("Failed to analyze your response. Please try again.");
      console.error("Blurt analysis error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePaperBlurtText = (extractedText: string) => {
    setUserInput(extractedText);
    setMode("digital");
  };

  const handleNewSession = () => {
    setState("selecting");
    setUserInput("");
    setAnalysis(null);
    setError(null);
    setMode("digital");
    setXpEarned(0);
    setSelectedGoalId(null);
    setCustomTopic("");
    setSourceContent("");
  };

  const handleDone = () => {
    setState("idle");
    setUserInput("");
    setAnalysis(null);
    setError(null);
    setMode("digital");
    setXpEarned(0);
    setSelectedGoalId(null);
    setCustomTopic("");
    setSourceContent("");
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
    <>
      <AnimatePresence mode="wait">
        {state === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <button
              onClick={() => setState("selecting")}
              className="w-full p-4 rounded-2xl text-left transition-all duration-200 bg-gradient-to-r from-purple-600/90 to-blue-600/90 hover:from-purple-600 hover:to-blue-600 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 hover:scale-[1.01] active:scale-[0.99]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">
                      Start Active Recall Session
                    </p>
                    <p className="text-sm text-white/70 mt-0.5">
                      Test your knowledge on any topic
                    </p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              </div>
            </button>
          </motion.div>
        )}

        {state === "selecting" && (
          <motion.div
            key="selecting"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="widget-glass p-5 rounded-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                Choose a Topic
              </h3>
              <button
                onClick={handleDone}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Goal Selector */}
            {goals.length > 0 && (
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">
                  Select an existing goal
                </label>
                <select
                  value={selectedGoalId || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedGoalId(val ? parseInt(val) : null);
                    if (val) setCustomTopic("");
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-purple-500/50 focus:outline-none appearance-none"
                >
                  <option value="" className="bg-gray-900">
                    -- Select a goal --
                  </option>
                  {goals.map((goal) => (
                    <option
                      key={goal.id}
                      value={goal.id}
                      className="bg-gray-900"
                    >
                      {goal.goal_text}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Divider */}
            {goals.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-white/40">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
            )}

            {/* Custom Topic */}
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">
                Type a custom topic
              </label>
              <Input
                value={customTopic}
                onChange={(e) => {
                  setCustomTopic(e.target.value);
                  if (e.target.value) setSelectedGoalId(null);
                }}
                placeholder="e.g., Indian Polity, Photosynthesis, WW2 Causes..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDone}
                className="text-white/60"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleStartSession}
                disabled={
                  (!selectedGoalId && !customTopic.trim()) || isLoadingContent
                }
                className="gap-2 bg-purple-600 hover:bg-purple-700"
              >
                {isLoadingContent ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Start Session
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {state === "blurting" && (
          <motion.div
            key="blurting"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="widget-glass p-5 rounded-2xl space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-white flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-400" />
                  Active Recall
                </h3>
                <p className="text-sm text-white/50 mt-0.5">{topicText}</p>
              </div>
              <div className="flex items-center gap-3">
                {mode === "digital" && (
                  <div className="flex items-center gap-1.5 text-white/50">
                    <Timer className="w-3.5 h-3.5" />
                    <span className="text-xs font-mono">
                      {formatTime(elapsedSeconds)}
                    </span>
                  </div>
                )}
                <button
                  onClick={handleDone}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <p className="text-sm text-white/70">
                Write everything you remember about{" "}
                <span className="text-purple-400 font-medium">{topicText}</span>
                .{" "}
                {!sourceContent
                  ? "AI will evaluate based on general knowledge."
                  : "Don't worry about organization - just dump from memory!"}
              </p>
            </div>

            {/* Mode Tabs */}
            <Tabs
              value={mode}
              onValueChange={(v) => setMode(v as "digital" | "paper")}
              className="w-full"
            >
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
                  Paper
                </TabsTrigger>
              </TabsList>

              <TabsContent value="digital" className="mt-3">
                <div className="space-y-3">
                  <Textarea
                    ref={textareaRef}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Start writing everything you remember..."
                    className="min-h-[200px] bg-white/5 border-white/10 focus:border-purple-500 resize-none text-sm leading-relaxed"
                    autoFocus
                  />

                  {error && (
                    <p className="text-red-400 text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </p>
                  )}

                  <div className="flex justify-between items-center">
                    <p className="text-xs text-white/40">
                      {userInput.length} chars •{" "}
                      {userInput.split(/\s+/).filter(Boolean).length} words
                    </p>
                    <Button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || !userInput.trim()}
                      size="sm"
                      className="gap-2"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          Analyze
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="paper" className="mt-3">
                <PaperBlurtUpload
                  isPro={effectiveIsPro}
                  onTextExtracted={handlePaperBlurtText}
                  onProRequired={() => setUpgradeModalOpen(true)}
                />

                {userInput && mode === "paper" && (
                  <div className="mt-3 space-y-3">
                    <div className="p-3 rounded-lg bg-white/5">
                      <h4 className="font-medium text-xs text-white/50 mb-1.5">
                        Extracted Text:
                      </h4>
                      <p className="text-sm text-white/80 whitespace-pre-wrap">
                        {userInput}
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || !userInput.trim()}
                        size="sm"
                        className="gap-2"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            Analyze Notes
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        )}

        {state === "results" && analysis && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="widget-glass p-5 rounded-2xl space-y-4"
          >
            {/* Score */}
            <div className="text-center py-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className={cn(
                  "text-5xl font-bold mb-1",
                  getScoreColor(analysis.score)
                )}
              >
                {analysis.score}%
              </motion.div>
              <p className="text-sm text-white/60">
                {getScoreMessage(analysis.score)}
              </p>
              <div className="flex justify-center gap-4 mt-2 text-xs">
                <span className="text-white/40">
                  Time: {formatTime(timeSpent)}
                </span>
                {xpEarned > 0 && (
                  <span className="text-purple-400 flex items-center gap-1">
                    <Trophy className="w-3 h-3" />+{xpEarned} XP
                  </span>
                )}
              </div>
              <p className="text-xs text-white/40 mt-1">{topicText}</p>
            </div>

            {/* Feedback */}
            <div className="p-3 rounded-lg bg-white/5">
              <p className="text-sm text-white/70">{analysis.feedback}</p>
            </div>

            {/* Matched Points */}
            {analysis.matchedPoints.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-sm font-medium text-green-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Correct ({analysis.matchedPoints.length})
                </h4>
                <ul className="space-y-1">
                  {analysis.matchedPoints.map((point, index) => (
                    <li
                      key={index}
                      className="text-xs text-white/60 flex items-start gap-2 pl-5"
                    >
                      <CheckCircle2 className="w-3 h-3 text-green-400/60 shrink-0 mt-0.5" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missed Concepts */}
            {analysis.missedConcepts.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-sm font-medium text-orange-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  Missed ({analysis.missedConcepts.length})
                </h4>
                <ul className="space-y-1">
                  {analysis.missedConcepts.map((concept, index) => (
                    <li
                      key={index}
                      className="text-xs text-white/60 flex items-start gap-2 pl-5"
                    >
                      <AlertCircle className="w-3 h-3 text-orange-400/60 shrink-0 mt-0.5" />
                      {concept}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Corrections */}
            {analysis.corrections.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-sm font-medium text-red-400 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" />
                  Corrections ({analysis.corrections.length})
                </h4>
                <ul className="space-y-1">
                  {analysis.corrections.map((correction, index) => (
                    <li
                      key={index}
                      className="text-xs text-white/60 flex items-start gap-2 pl-5"
                    >
                      <XCircle className="w-3 h-3 text-red-400/60 shrink-0 mt-0.5" />
                      {correction}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewSession}
                className="gap-1.5 border-white/10"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                New Session
              </Button>
              <Button size="sm" onClick={handleDone} className="gap-1.5">
                Done
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <UpgradeModal open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen} />
    </>
  );
}
