"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Loader2,
  CalendarClock,
  ListChecks,
  Clock,
  MinusCircle,
  Zap,
  ChevronDown,
  Search,
  ExternalLink,
  FileText,
  Users,
  Megaphone,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { ScrapedExam } from "@/app/api/spsc-scraper/route";

interface PatternSection {
  subject: string;
  count: number;
}

interface ExamPattern {
  id: string;
  name: string;
  description: string;
  total_questions: number;
  duration_minutes: number;
  negative_marking: boolean;
  negative_mark_value: number;
  marks_per_question: number;
  sections: PatternSection[];
}

// Group patterns into categories by keyword matching
function categorizePattern(id: string, name: string): string {
  const n = (id + " " + name).toLowerCase();
  if (n.includes("mains") || n.includes("gs1") || n.includes("gs2") || n.includes("gs3") || n.includes("english paper")) return "Mains";
  if (n.includes("prelim") || n.includes("sscs")) return "Prelims";
  if (n.includes("engineer") || n.includes("architect") || n.includes("geolog") || n.includes("programmer") || n.includes("software") || n.includes("it-director")) return "Engineering & Tech";
  if (n.includes("medical") || n.includes("doctor") || n.includes("gdmo") || n.includes("veterinary") || n.includes("dental") || n.includes("nurse") || n.includes("paramedic") || n.includes("health") || n.includes("mphw") || n.includes("drug") || n.includes("food-safety") || n.includes("pharmac") || n.includes("yoga") || n.includes("ayush") || n.includes("tutor-clinical")) return "Medical & Health";
  if (n.includes("police") || n.includes("excise") || n.includes("jailer") || n.includes("fire")) return "Police & Security";
  if (n.includes("forest") || n.includes("fisher") || n.includes("livestock")) return "Forestry & Agriculture";
  if (n.includes("ldc") || n.includes("clerk") || n.includes("steno") || n.includes("revenue") || n.includes("tax") || n.includes("cooperat") || n.includes("statistic") || n.includes("inspector")) return "Administrative";
  if (n.includes("lecturer") || n.includes("instructor") || n.includes("principal") || n.includes("professor")) return "Education";
  if (n.includes("quick") || n.includes("practice")) return "Quick Practice";
  return "Other";
}

const CATEGORY_ORDER = [
  "Prelims", "Mains", "Police & Security", "Administrative",
  "Engineering & Tech", "Medical & Health", "Education",
  "Forestry & Agriculture", "Quick Practice", "Other",
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Prelims": { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
  "Mains": { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" },
  "Police & Security": { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
  "Administrative": { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  "Engineering & Tech": { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  "Medical & Health": { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  "Education": { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/20" },
  "Forestry & Agriculture": { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
  "Quick Practice": { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  "Other": { bg: "bg-white/5", text: "text-white/60", border: "border-white/10" },
};

export function UpcomingExamsGrid() {
  const router = useRouter();
  const [patterns, setPatterns] = useState<ExamPattern[]>([]);
  const [scrapedExams, setScrapedExams] = useState<ScrapedExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrapedLoading, setScrapedLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["Prelims", "Quick Practice"]));
  const [showAllPatterns, setShowAllPatterns] = useState(false);

  const analyzeExamSyllabus = useCallback(async (exam: ScrapedExam) => {
    if (!exam.links.syllabus) {
      return null;
    }

    const response = await fetch("/api/spsc-scraper/syllabus", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        examTitle: exam.title,
        pdfUrl: exam.links.syllabus,
      }),
    });

    if (!response.ok) {
      throw new Error("Syllabus parsing failed");
    }

    const data = await response.json();
    sessionStorage.setItem(`spsc-syllabus:${exam.advertisementNo || exam.title}`, JSON.stringify(data));
    return data as {
      result?: {
        status?: "success" | "partial" | "failed";
        metadata?: {
          subjects?: string[];
        };
      };
    };
  }, []);

  // Fetch mock-test patterns
  const fetchPatterns = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("mock-test", { method: "GET" });
      if (error) throw error;
      setPatterns((data as { patterns: ExamPattern[] }).patterns || []);
    } catch (err) {
      console.error("Failed to fetch exam patterns:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch scraped SPSC upcoming exams
  const fetchScrapedExams = useCallback(async () => {
    try {
      const res = await fetch("/api/spsc-scraper");
      if (!res.ok) throw new Error("Scraper failed");
      const data = await res.json();
      setScrapedExams(data.exams || []);
    } catch (err) {
      console.error("Failed to fetch scraped exams:", err);
    } finally {
      setScrapedLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatterns();
    fetchScrapedExams();
  }, [fetchPatterns, fetchScrapedExams]);

  // Build a patterns lookup for scraped exams
  const patternsMap = new Map(patterns.map((p) => [p.id, p]));

  const handleGenerateFromPattern = async (patternId: string, exam?: ScrapedExam) => {
    setGeneratingId(patternId);
    try {
      let syllabusPayload:
        | {
            subjects?: string[];
            topics?: string[];
            totalMarks?: number | null;
            paperCount?: number | null;
            durationMinutes?: number | null;
            negativeMarking?: boolean | null;
            negativeMarkValue?: number | null;
            qualificationHints?: string[];
          }
        | undefined;

      if (exam?.links.syllabus) {
        try {
          const syllabus = await analyzeExamSyllabus(exam);
          if (syllabus?.result?.status === "success") {
            toast.success(`Syllabus parsed: ${syllabus.result.metadata?.subjects?.length || 0} subjects detected`);
          } else if (syllabus?.result?.status === "partial") {
            toast.message("Syllabus partially parsed; generation will fall back to the matched pattern");
          }
          syllabusPayload = syllabus?.result?.metadata;
        } catch (error) {
          console.error("Syllabus analysis failed:", error);
          toast.message("Could not parse syllabus PDF; using the matched pattern");
        }
      }

      const primaryBody = {
        pattern: patternId,
        generation_mode: "hybrid" as const,
        exam_title: exam?.title,
        syllabus_metadata: syllabusPayload,
      };

      let response = await fetch("/api/mock-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(primaryBody),
      });

      let data = await response.json();
      let errorMessage = response.ok ? null : (data?.error || "Failed to generate mock test. Please try again.");

      if (!response.ok) {
        console.error("Hybrid mock-test generation failed, retrying with PYQ-only mode:", data);
        toast.message("Hybrid generation failed; retrying with PYQ-only mode");

        response = await fetch("/api/mock-test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pattern: patternId,
            generation_mode: "pyq_only",
            exam_title: exam?.title,
          }),
        });

        data = await response.json();
        errorMessage = response.ok ? null : (data?.error || "Failed to generate mock test. Please try again.");
      }

      if (!response.ok) {
        throw new Error(errorMessage || "Failed to generate mock test. Please try again.");
      }

      toast.success(`Mock test generated with ${data.total_questions} questions!`);
      router.push(`/test/${data.test_id}`);
    } catch (err) {
      console.error("Failed to generate test:", err);
      toast.error(err instanceof Error ? err.message : "Failed to generate mock test. Please try again.");
    } finally {
      setGeneratingId(null);
    }
  };

  // Filter scraped exams
  const filteredScraped = searchQuery
    ? scrapedExams.filter((e) =>
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.department.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : scrapedExams;

  // Group patterns by category
  const grouped = patterns.reduce<Record<string, ExamPattern[]>>((acc, p) => {
    const cat = categorizePattern(p.id, p.name);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const filteredGrouped = Object.entries(grouped)
    .map(([cat, items]) => {
      const filtered = searchQuery
        ? items.filter((p) =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.sections.some((s) => s.subject.toLowerCase().includes(searchQuery.toLowerCase()))
          )
        : items;
      return [cat, filtered] as [string, ExamPattern[]];
    })
    .filter(([, items]) => items.length > 0)
    .filter(([cat]) => !activeCategory || cat === activeCategory)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]));

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const isLoading = loading && scrapedLoading;

  if (isLoading) {
    return (
      <div className="widget-glass p-8 rounded-2xl flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className="widget-glass p-5 rounded-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <CalendarClock className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Generate Mock Tests</h2>
            <p className="text-sm text-white/50">
              Upcoming SPSC exams + {patterns.length} exam patterns with real PYQ questions
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            placeholder="Search exams... e.g. Police, Under Secretary, Forest"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
          />
        </div>
      </div>

      {/* Upcoming SPSC Exams (scraped) */}
      {filteredScraped.length > 0 && (
        <div className="widget-glass rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Upcoming SPSC Exams</h3>
              <span className="text-xs text-white/40">({filteredScraped.length})</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Live from spsc.sikkim.gov.in
              </span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {filteredScraped.map((exam, idx) => {
              const matchedPattern = exam.patternId ? patternsMap.get(exam.patternId) || null : null;

              return (
                <UpcomingExamCard
                  key={exam.advertisementNo || idx}
                  exam={exam}
                  pattern={matchedPattern}
                  isGenerating={generatingId === exam.patternId}
                  onGenerate={() => {
                    if (exam.patternId && matchedPattern) handleGenerateFromPattern(exam.patternId, exam);
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {scrapedLoading && (
        <div className="widget-glass p-6 rounded-2xl flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span className="text-sm text-white/50">Fetching upcoming exams from SPSC...</span>
        </div>
      )}

      {/* All Patterns Toggle */}
      {!showAllPatterns && patterns.length > 0 && (
        <button
          onClick={() => setShowAllPatterns(true)}
          className="w-full widget-glass p-4 rounded-2xl text-center hover:bg-white/[0.03] transition-colors group"
        >
          <div className="flex items-center justify-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-white/70 group-hover:text-white">
              Browse all {patterns.length} exam patterns
            </span>
            <ChevronDown className="w-4 h-4 text-white/30 group-hover:text-white/60" />
          </div>
        </button>
      )}

      {/* All Patterns Browser */}
      {showAllPatterns && (
        <>
          {/* Category pills */}
          <div className="widget-glass p-4 rounded-2xl">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setActiveCategory(null)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs transition-all",
                  !activeCategory
                    ? "bg-white/10 text-white border border-white/20"
                    : "bg-white/5 text-white/50 hover:bg-white/10"
                )}
              >
                All ({patterns.length})
              </button>
              {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((cat) => {
                const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS["Other"];
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs transition-all",
                      activeCategory === cat
                        ? `${colors.bg} ${colors.text} border ${colors.border}`
                        : "bg-white/5 text-white/50 hover:bg-white/10"
                    )}
                  >
                    {cat} ({grouped[cat].length})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grouped exam cards */}
          {filteredGrouped.map(([category, items]) => {
            const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS["Other"];
            const isExpanded = expandedCategories.has(category) || !!searchQuery || !!activeCategory;

            return (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="widget-glass rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2.5 h-2.5 rounded-full", colors.bg.replace("/10", "/60"))} />
                    <h3 className="text-sm font-semibold text-white">{category}</h3>
                    <span className="text-xs text-white/40">({items.length})</span>
                  </div>
                  <ChevronDown className={cn("w-4 h-4 text-white/30 transition-transform", isExpanded && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 pt-0">
                        {items.map((pattern) => (
                          <PatternCard
                            key={pattern.id}
                            pattern={pattern}
                            colors={colors}
                            isGenerating={generatingId === pattern.id}
                            onGenerate={() => handleGenerateFromPattern(pattern.id)}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </>
      )}

      {filteredScraped.length === 0 && filteredGrouped.length === 0 && searchQuery && (
        <div className="widget-glass p-12 rounded-2xl text-center">
          <Search className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <h3 className="text-base font-medium text-white mb-1">No exams found</h3>
          <p className="text-sm text-white/40">Try a different search term</p>
        </div>
      )}
    </div>
  );
}

// Card for scraped upcoming SPSC exams
function UpcomingExamCard({
  exam,
  pattern,
  isGenerating,
  onGenerate,
}: {
  exam: ScrapedExam;
  pattern: ExamPattern | null;
  isGenerating: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="group p-4 rounded-xl border transition-all bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border-emerald-500/20 hover:border-emerald-500/40">
      {/* Badge row */}
      <div className="flex items-center gap-2 mb-2">
        {exam.advertisementNo && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
            {exam.advertisementNo}
          </span>
        )}
        {exam.issuedDate && (
          <span className="text-[10px] text-white/40">{exam.issuedDate}</span>
        )}
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold text-white mb-1 leading-tight line-clamp-2">
        {exam.title}
      </h4>

      {/* Posts & Department */}
      <div className="flex items-center gap-3 text-xs text-white/50 mb-3">
        {exam.posts && (
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {exam.posts} posts
          </span>
        )}
        {pattern && (
          <>
            <span className="flex items-center gap-1">
              <ListChecks className="w-3 h-3" />
              {pattern.total_questions} Qs
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {pattern.duration_minutes}m
            </span>
          </>
        )}
      </div>

      {/* Links row */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {exam.links.syllabus && (
          <a
            href={exam.links.syllabus}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <FileText className="w-2.5 h-2.5" />
            Syllabus
            <ExternalLink className="w-2 h-2" />
          </a>
        )}
        {exam.links.notification && (
          <a
            href={exam.links.notification}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            Notification
            <ExternalLink className="w-2 h-2" />
          </a>
        )}
        {exam.links.advertisement && (
          <a
            href={exam.links.advertisement}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            Advertisement
            <ExternalLink className="w-2 h-2" />
          </a>
        )}
      </div>

      {/* Generate button */}
      {exam.patternId && pattern ? (
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className={cn(
            "w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all",
            isGenerating
              ? "bg-white/5 text-white/40 cursor-wait"
              : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5" />
              Generate Mock Test
            </>
          )}
        </button>
      ) : (
        <div className="text-center text-[10px] text-white/30 py-1.5">
          Pattern unavailable
        </div>
      )}
    </div>
  );
}

// Card for generic exam patterns
function PatternCard({
  pattern,
  colors,
  isGenerating,
  onGenerate,
}: {
  pattern: ExamPattern;
  colors: { bg: string; text: string; border: string };
  isGenerating: boolean;
  onGenerate: () => void;
}) {
  const mergedSections = pattern.sections.reduce<{ subject: string; count: number }[]>(
    (acc, s) => {
      const existing = acc.find((a) => a.subject === s.subject);
      if (existing) existing.count += s.count;
      else acc.push({ subject: s.subject, count: s.count });
      return acc;
    },
    []
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("group p-4 rounded-xl border transition-all", colors.bg, colors.border, "hover:shadow-lg hover:shadow-black/20")}
    >
      <h4 className="text-sm font-semibold text-white mb-1 leading-tight line-clamp-2">{pattern.name}</h4>
      <p className="text-[11px] text-white/40 mb-3 line-clamp-2">{pattern.description}</p>

      <div className="flex items-center gap-3 text-xs text-white/50 mb-3">
        <span className="flex items-center gap-1">
          <ListChecks className="w-3 h-3" />
          {pattern.total_questions} Qs
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {pattern.duration_minutes}m
        </span>
        {pattern.negative_marking && (
          <span className="flex items-center gap-1 text-red-400/70">
            <MinusCircle className="w-3 h-3" />
            -{pattern.negative_mark_value}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {mergedSections.slice(0, 4).map((s, idx) => (
          <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/50 border border-white/10">
            {s.subject} ({s.count})
          </span>
        ))}
        {mergedSections.length > 4 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40">+{mergedSections.length - 4} more</span>
        )}
      </div>

      <button
        onClick={onGenerate}
        disabled={isGenerating}
        className={cn(
          "w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all",
          isGenerating
            ? "bg-white/5 text-white/40 cursor-wait"
            : `${colors.bg} ${colors.text} border ${colors.border} hover:opacity-80`
        )}
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Zap className="w-3.5 h-3.5" />
            Generate Mock Test
          </>
        )}
      </button>
    </motion.div>
  );
}
