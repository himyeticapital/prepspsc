"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ArrowUp,
  Loader2,
  Sparkles,
  Zap,
  Bot,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ExamPatternCard } from "./exam-pattern-card";
import type { ExamPatternData } from "./exam-pattern-card";
import { TestReadyCard } from "./test-ready-card";

// ---------------------------------------------------------------------------
// Edge Function name (called via supabase.functions.invoke)
// ---------------------------------------------------------------------------

const EDGE_FUNCTION_NAME = "mock-test";

// ---------------------------------------------------------------------------
// Suggested chips for empty state
// ---------------------------------------------------------------------------

const SUGGESTED_CHIPS = [
  "SPSC Under Secretary Prelims",
  "SI Police Prelims",
  "Quick 30-Question Practice",
  "UPSC Prelims",
  "CDS Exam",
];

// ---------------------------------------------------------------------------
// All 64 SPSC pattern names + popular non-SPSC exams for autocomplete
// ---------------------------------------------------------------------------

const EXAM_SUGGESTIONS: string[] = [
  // SPSC patterns (64)
  "Under Secretary Preliminary Examination",
  "Sub Inspector of Police Preliminary Examination",
  "General Preliminary Examination",
  "SPSC Mains General Studies Paper 1",
  "SPSC Mains General Studies Paper 2",
  "Junior Engineer Preliminary Examination",
  "Forest Ranger Preliminary Examination",
  "Quick 30-Question Practice Test",
  "Combined Mains General Studies Paper 3",
  "Combined Mains English Paper",
  "Sikkim State Civil Service Preliminary Examination",
  "Sub Inspector Police Mains Examination",
  "Sub Inspector Excise Examination",
  "Sub Jailer Examination",
  "Sub Fire Officer Examination",
  "Assistant Engineer (Civil) Examination",
  "Assistant Engineer (Electrical) Examination",
  "Assistant Engineer (Mechanical) Examination",
  "Assistant Engineer (Agriculture) Examination",
  "General Duty Medical Officer Examination",
  "Veterinary Officer Examination",
  "Dental Surgeon (Junior Grade) Examination",
  "Specialist (Senior Grade) Medical Examination",
  "Staff Nurse (GNM) Examination",
  "Paramedical Various Posts Examination",
  "Health Educator Examination",
  "Multi Purpose Health Worker (Male/Female) Examination",
  "Drug Inspector Examination",
  "Food Safety Officer Examination",
  "Pharmacist AYUSH (Ayurveda/Homeopathy) Examination",
  "Yoga Instructor (AYUSH) Examination",
  "Scientific Officer (AYUSH) Examination",
  "Tutor / Clinical Instructor Examination",
  "Lower Division Clerk (LDC) Examination",
  "Accounts Clerk / Junior Store Keeper Examination",
  "Stenographer Grade III Examination",
  "Cooperative Inspector / Auditor Examination",
  "Statistical Inspector Examination",
  "Revenue Inspector Examination",
  "Revenue Surveyor / Assistant Revenue Surveyor Examination",
  "Commercial Tax Inspector Examination",
  "Block Officer (Fisheries) Examination",
  "Assistant Director (Fisheries) Examination",
  "Stockman / Livestock Assistant Examination",
  "Lecturer DIETs Examination",
  "ITI Instructor Examination",
  "Principal ITI Examination",
  "Assistant Professor SHEDA Examination",
  "Assistant Town Planner Examination",
  "Assistant Architect Examination",
  "Assistant Geologist Examination",
  "Digital Project Analyst / Software Developer Examination",
  "Assistant Programmer Examination",
  "Assistant Director (IT) Examination",
  "Laboratory Assistant Examination",
  "Field Assistant Examination",
  "ADO/WDO/HDO (Agriculture/Women/Horticulture Development Officer) Examination",
  "Senior Information Assistant Examination",
  "Assistant Sub-Editor / Sub-Editor Examination",
  "Inspector Legal Metrology Examination",
  "Photographer Examination",
  "Script Writer Examination",
  "Feed Mill Operator Examination",
  "Printing & Stationery Various Posts Examination",
  // Non-SPSC popular exams
  "UPSC Civil Services Prelims",
  "UPSC Civil Services Mains",
  "CAT (MBA Entrance)",
  "CDS (Combined Defence Services)",
  "SSC CGL",
  "SSC CHSL",
  "JEE Main",
  "NEET UG",
  "GATE",
  "NDA",
];

// ---------------------------------------------------------------------------
// Chat message types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  type: "text" | "exam_pattern" | "test_ready" | "generating";
  examPattern?: ExamPatternData;
  patternSource?: "spsc" | "ai";
  patternId?: string;
  testId?: string;
  totalQuestions?: number;
  generationTimeMs?: number;
  examName?: string;
  isStreaming?: boolean;
}

// ---------------------------------------------------------------------------
// Fuzzy match helper
// ---------------------------------------------------------------------------

function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return true;
  // Simple token match: every query word must appear somewhere in target
  const words = q.split(/\s+/).filter(Boolean);
  return words.every((w) => t.includes(w));
}

// ---------------------------------------------------------------------------
// Simple inline markdown renderer (reused pattern from chat-message.tsx)
// ---------------------------------------------------------------------------

function renderInline(text: string) {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const codeMatch = remaining.match(/`(.+?)`/);

    let firstMatch: { type: "bold" | "code"; match: RegExpMatchArray } | null =
      null;

    if (
      boldMatch &&
      (!codeMatch || (boldMatch.index ?? 0) < (codeMatch.index ?? 0))
    ) {
      firstMatch = { type: "bold", match: boldMatch };
    } else if (codeMatch) {
      firstMatch = { type: "code", match: codeMatch };
    }

    if (!firstMatch) {
      parts.push(remaining);
      break;
    }

    const index = firstMatch.match.index ?? 0;
    if (index > 0) {
      parts.push(remaining.slice(0, index));
    }

    if (firstMatch.type === "bold") {
      parts.push(
        <strong key={key++} className="text-white font-semibold">
          {firstMatch.match[1]}
        </strong>
      );
    } else {
      parts.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 text-xs"
        >
          {firstMatch.match[1]}
        </code>
      );
    }

    remaining = remaining.slice(index + firstMatch.match[0].length);
  }

  return parts;
}

function renderContent(content: string) {
  const paragraphs = content.split(/\n\n+/);

  return paragraphs.map((paragraph, pIndex) => {
    const lines = paragraph.split("\n");
    const isUnorderedList = lines.every((line) => /^[-*]\s/.test(line.trim()));
    const isOrderedList = lines.every((line) => /^\d+\.\s/.test(line.trim()));

    if (isUnorderedList) {
      return (
        <ul
          key={pIndex}
          className="list-disc list-inside space-y-1 text-white/80 my-2"
        >
          {lines.map((line, lIndex) => (
            <li key={lIndex}>{renderInline(line.replace(/^[-*]\s/, ""))}</li>
          ))}
        </ul>
      );
    }

    if (isOrderedList) {
      return (
        <ol
          key={pIndex}
          className="list-decimal list-inside space-y-1 text-white/80 my-2"
        >
          {lines.map((line, lIndex) => (
            <li key={lIndex}>
              {renderInline(line.replace(/^\d+\.\s/, ""))}
            </li>
          ))}
        </ol>
      );
    }

    return (
      <p
        key={pIndex}
        className="text-white/90 leading-relaxed mb-2 last:mb-0"
      >
        {renderInline(paragraph)}
      </p>
    );
  });
}

// ---------------------------------------------------------------------------
// MockTestChat Component
// ---------------------------------------------------------------------------

export default function MockTestChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [generatingPatternId, setGeneratingPatternId] = useState<string | null>(
    null
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(e.target as Node)
      ) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter autocomplete suggestions
  const filteredSuggestions = useMemo(() => {
    if (!inputValue.trim() || inputValue.trim().length < 2) return [];
    return EXAM_SUGGESTIONS.filter((s) => fuzzyMatch(inputValue.trim(), s)).slice(
      0,
      8
    );
  }, [inputValue]);

  // Unique ID generator
  const genId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // ---------------------------------------------------------------------------
  // Send message to the AI (via mock-test edge function)
  // For now, this directly calls the mock-test GET endpoint for patterns
  // and POST endpoint for generation. The "chat" behavior is simulated
  // client-side by matching user input to known patterns.
  // ---------------------------------------------------------------------------

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: genId(),
      role: "user",
      content: content.trim(),
      type: "text",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    try {
      const supabase = createClient();

      // Force session refresh (getSession() alone can return stale tokens)
      await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error("Please sign in to continue");
        setIsLoading(false);
        return;
      }

      // Fetch patterns with explicit fresh token
      const { data: patternsData, error: patternsError } = await supabase.functions.invoke(
        EDGE_FUNCTION_NAME,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (patternsError) {
        console.error("[mock-test-chat] GET failed:", patternsError);
        throw new Error("Failed to fetch exam patterns");
      }

      const patterns = (patternsData as { patterns: Array<ExamPatternData & { id: string }> }).patterns;

      // Find the best matching pattern using fuzzy search
      const query = content.trim().toLowerCase();
      let bestMatch: (ExamPatternData & { id: string }) | null = null;
      let bestScore = 0;

      for (const p of patterns) {
        const name = p.name.toLowerCase();
        const desc = p.description.toLowerCase();

        // Exact ID match
        if (query === p.id) {
          bestMatch = p;
          bestScore = 100;
          break;
        }

        // Check how many query words match in name or description
        const queryWords = query.split(/\s+/).filter((w) => w.length > 2);
        let score = 0;
        for (const word of queryWords) {
          if (name.includes(word)) score += 3;
          else if (desc.includes(word)) score += 1;
        }

        // Bonus for name containing query
        if (name.includes(query)) score += 10;

        if (score > bestScore) {
          bestScore = score;
          bestMatch = p;
        }
      }

      if (bestMatch && bestScore >= 2) {
        // Found a matching pattern -- show it as an ExamPatternCard
        const assistantMsg: ChatMessage = {
          id: genId(),
          role: "assistant",
          content: `I found a matching exam pattern for your request. Here are the details:`,
          type: "text",
        };

        const patternMsg: ChatMessage = {
          id: genId(),
          role: "assistant",
          content: "",
          type: "exam_pattern",
          examPattern: {
            name: bestMatch.name,
            description: bestMatch.description,
            total_questions: bestMatch.total_questions,
            duration_minutes: bestMatch.duration_minutes,
            negative_marking: bestMatch.negative_marking,
            negative_mark_value: bestMatch.negative_mark_value,
            marks_per_question: bestMatch.marks_per_question,
            sections: bestMatch.sections,
          },
          patternSource: "spsc",
          patternId: bestMatch.id,
        };

        setMessages((prev) => [...prev, assistantMsg, patternMsg]);
      } else {
        // No strong match -- suggest closest options or give a helpful message
        const topMatches = patterns
          .map((p) => {
            const name = p.name.toLowerCase();
            const desc = p.description.toLowerCase();
            const queryWords = query.split(/\s+/).filter((w) => w.length > 2);
            let score = 0;
            for (const word of queryWords) {
              if (name.includes(word)) score += 3;
              else if (desc.includes(word)) score += 1;
            }
            return { pattern: p, score };
          })
          .filter((m) => m.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        if (topMatches.length > 0) {
          const suggestions = topMatches
            .map((m) => `- **${m.pattern.name}** (${m.pattern.total_questions} questions, ${m.pattern.duration_minutes} min)`)
            .join("\n");

          const assistantMsg: ChatMessage = {
            id: genId(),
            role: "assistant",
            content: `I couldn't find an exact match, but here are some similar exams I can generate:\n\n${suggestions}\n\nTry typing one of these exam names to get started.`,
            type: "text",
          };
          setMessages((prev) => [...prev, assistantMsg]);
        } else {
          const assistantMsg: ChatMessage = {
            id: genId(),
            role: "assistant",
            content: `I have **64 Sikkim PSC exam patterns** with real PYQ questions available. Try asking for a specific exam like:\n\n- **Under Secretary Prelims** (100 Qs, 120 min)\n- **SI Police Prelims** (100 Qs, 120 min)\n- **LDC Examination** (100 Qs, 120 min)\n- **Quick 30-Question Practice** (30 Qs, 30 min)\n- **Forest Ranger Prelims** (100 Qs, 120 min)\n\nJust describe the exam you want, and I'll find the best matching pattern!`,
            type: "text",
          };
          setMessages((prev) => [...prev, assistantMsg]);
        }
      }
    } catch (error) {
      console.error("[mock-test-chat] Error:", error);
      const errorMsg: ChatMessage = {
        id: genId(),
        role: "assistant",
        content:
          "Sorry, something went wrong while searching for exam patterns. Please try again.",
        type: "text",
      };
      setMessages((prev) => [...prev, errorMsg]);
      toast.error("Failed to process your request");
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handle generate from ExamPatternCard
  // ---------------------------------------------------------------------------

  const handleGenerate = async (
    pattern: ExamPatternData,
    source: "spsc" | "ai",
    patternId: string
  ) => {
    setGeneratingPatternId(patternId);

    // Add generating status message
    const generatingMsg: ChatMessage = {
      id: genId(),
      role: "assistant",
      content: `Generating your **${pattern.name}** mock test with ${pattern.total_questions} real PYQ questions...`,
      type: "generating",
    };
    setMessages((prev) => [...prev, generatingMsg]);

    try {
      const supabase = createClient();

      // Force session refresh and get fresh token
      await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error("Please sign in to continue");
        setMessages((prev) => prev.filter((m) => m.id !== generatingMsg.id));
        setGeneratingPatternId(null);
        return;
      }

      const { data, error: genError } = await supabase.functions.invoke(
        EDGE_FUNCTION_NAME,
        {
          body: { pattern: patternId },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (genError) {
        throw new Error(genError.message || "Failed to generate mock test");
      }

      // Remove generating message and add test ready card
      setMessages((prev) => {
        const updated = prev.filter((m) => m.id !== generatingMsg.id);
        const readyMsg: ChatMessage = {
          id: genId(),
          role: "assistant",
          content: "",
          type: "test_ready",
          testId: data.test_id,
          totalQuestions: data.total_questions,
          generationTimeMs: data.generation_time_ms,
          examName: pattern.name,
        };
        return [...updated, readyMsg];
      });

      toast.success(
        `Mock test generated with ${data.total_questions} questions!`
      );
    } catch (error) {
      console.error("[mock-test-chat] Generation error:", error);
      // Remove generating message and show error
      setMessages((prev) => {
        const updated = prev.filter((m) => m.id !== generatingMsg.id);
        const errorMsg: ChatMessage = {
          id: genId(),
          role: "assistant",
          content: `Failed to generate the mock test. ${error instanceof Error ? error.message : "Please try again."}`,
          type: "text",
        };
        return [...updated, errorMsg];
      });
      toast.error("Failed to generate mock test");
    } finally {
      setGeneratingPatternId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Handle modify from ExamPatternCard
  // ---------------------------------------------------------------------------

  const handleModify = (pattern: ExamPatternData) => {
    const modifyMsg: ChatMessage = {
      id: genId(),
      role: "assistant",
      content: `You can ask me to adjust this pattern. For example:\n\n- "Make it 50 questions instead"\n- "Remove the English section"\n- "Add more History questions"\n- "Make it a quick 30-minute test"\n\nOr just describe a different exam you'd like to practice!`,
      type: "text",
    };
    setMessages((prev) => [...prev, modifyMsg]);
  };

  // ---------------------------------------------------------------------------
  // Handle suggested chip click
  // ---------------------------------------------------------------------------

  const handleChipClick = (chip: string) => {
    sendMessage(chip);
  };

  // ---------------------------------------------------------------------------
  // Handle autocomplete selection
  // ---------------------------------------------------------------------------

  const handleAutocompletePick = (suggestion: string) => {
    setShowAutocomplete(false);
    sendMessage(suggestion);
  };

  // ---------------------------------------------------------------------------
  // Handle key press
  // ---------------------------------------------------------------------------

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      setShowAutocomplete(false);
      sendMessage(inputValue);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden h-[380px]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
        <Zap className="w-5 h-5 text-cyan-400" />
        <h2 className="text-sm font-semibold text-white">AI Mock Tests</h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
          Real PYQ Questions
        </span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-cyan-400" />
            </div>
            <h3 className="text-base font-medium text-white mb-1.5">
              Describe the exam you want to practice for
            </h3>
            <p className="text-xs text-white/40 mb-5 max-w-xs">
              64 SPSC exams + other Indian competitive exams. I'll generate
              a unique mock test with real PYQ questions.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {SUGGESTED_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleChipClick(chip)}
                  className="text-xs px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-500/40 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Messages list
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
                    message.role === "assistant"
                      ? "bg-gradient-to-br from-cyan-500 to-blue-600"
                      : "bg-white/10"
                  )}
                >
                  {message.role === "assistant" ? (
                    <Bot className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-white/70" />
                  )}
                </div>

                {/* Content */}
                <div
                  className={cn(
                    "flex-1 max-w-[85%]",
                    message.role === "user" ? "ml-8" : "mr-8"
                  )}
                >
                  {/* Text message */}
                  {(message.type === "text" || message.type === "generating") &&
                    message.content && (
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-3",
                          message.role === "user"
                            ? "bg-primary/20 border border-primary/30 rounded-tr-sm"
                            : "bg-white/5 border border-white/10 rounded-tl-sm"
                        )}
                      >
                        <div className="text-sm">
                          {renderContent(message.content)}
                          {message.type === "generating" && (
                            <span className="inline-flex items-center gap-1 ml-1">
                              <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Exam pattern card */}
                  {message.type === "exam_pattern" && message.examPattern && (
                    <ExamPatternCard
                      pattern={message.examPattern}
                      source={message.patternSource || "spsc"}
                      onGenerate={() =>
                        handleGenerate(
                          message.examPattern!,
                          message.patternSource || "spsc",
                          message.patternId || ""
                        )
                      }
                      onModify={() => handleModify(message.examPattern!)}
                      isGenerating={generatingPatternId === message.patternId}
                    />
                  )}

                  {/* Test ready card */}
                  {message.type === "test_ready" &&
                    message.testId && (
                      <TestReadyCard
                        testId={message.testId}
                        totalQuestions={message.totalQuestions || 0}
                        generationTimeMs={message.generationTimeMs || 0}
                        examName={message.examName || "Mock Test"}
                      />
                    )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-white/50"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 bg-cyan-400/60 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-1.5 h-1.5 bg-cyan-400/60 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-1.5 h-1.5 bg-cyan-400/60 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-white/10 bg-white/[0.02] relative">
        {/* Autocomplete dropdown */}
        {showAutocomplete && filteredSuggestions.length > 0 && (
          <div
            ref={autocompleteRef}
            className="absolute bottom-full left-3 right-3 mb-1 bg-zinc-900 border border-white/10 rounded-lg shadow-xl overflow-hidden z-10 max-h-48 overflow-y-auto"
          >
            {filteredSuggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleAutocompletePick(suggestion)}
                className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors border-b border-white/5 last:border-0"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowAutocomplete(e.target.value.trim().length >= 2);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (inputValue.trim().length >= 2) {
                setShowAutocomplete(true);
              }
            }}
            placeholder="Type an exam name... e.g. Under Secretary Prelims"
            disabled={isLoading}
            className="flex-1 min-h-[44px] max-h-[120px] resize-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition-colors disabled:opacity-50"
            rows={1}
          />
          <Button
            onClick={() => {
              setShowAutocomplete(false);
              sendMessage(inputValue);
            }}
            disabled={!inputValue.trim() || isLoading}
            size="icon"
            className="h-[44px] w-[44px] rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-30"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
