"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Target,
  Clock,
  BookOpen,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Youtube,
  FileText,
  RotateCcw,
  Trash2,
  Search,
  GraduationCap,
  Map,
  ListChecks,
  HelpCircle,
  BarChart3,
  Eye,
  BookmarkCheck,
  Bell,
  GripVertical,
  Save,
  ArrowUpDown,
  Users,
  X,
  UserPlus,
  CheckCheck,
  Network,
} from "lucide-react";
import { KnowledgeGraphViewer } from "./knowledge-graph-viewer";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MyExamsSection, UpcomingExamsSection } from "@/components/study-ai/my-exams";

// Sortable Day Item Component for drag-and-drop reordering
function SortableDayItem({
  id,
  day,
}: {
  id: string;
  day: {
    day: number;
    dayName: string;
    subject: string;
    topics: string[];
    duration: string;
    completed?: boolean;
  };
  weekIndex: number;
  dayIndex: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg transition-all",
        day.completed
          ? "bg-green-500/10 border border-green-500/20"
          : "bg-white/5 border border-white/10",
        isDragging && "opacity-50 scale-[1.02] shadow-xl z-50 ring-2 ring-primary/50"
      )}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 rounded hover:bg-white/10 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="w-4 h-4 text-white/40" />
      </button>

      {/* Completion indicator */}
      <div
        className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
          day.completed
            ? "bg-green-500 text-white"
            : "border-2 border-white/30"
        )}
      >
        {day.completed && <CheckCircle2 className="w-3 h-3" />}
      </div>

      {/* Day name */}
      <span className="text-xs text-white/40 w-10 flex-shrink-0">{day.dayName}</span>

      {/* Subject */}
      <span className="text-sm font-medium text-white flex-1 truncate">{day.subject}</span>

      {/* Topics preview */}
      <span className="text-xs text-white/50 truncate max-w-[150px] hidden sm:block">
        {day.topics.slice(0, 2).join(", ")}
      </span>

      {/* Duration */}
      <span className="text-xs text-white/40 flex-shrink-0">{day.duration}</span>
    </div>
  );
}

// Sortable Slot Item Component for multi-slot drag-and-drop
function SortableSlotItem({
  id,
  slot,
}: {
  id: string;
  slot: {
    day: number;
    dayName: string;
    subject: string;
    topics: string[];
    duration: string;
    completed?: boolean;
    slot?: "Morning" | "Afternoon" | "Evening";
  };
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const slotColors = {
    Morning: "bg-yellow-500/20 text-yellow-400",
    Afternoon: "bg-orange-500/20 text-orange-400",
    Evening: "bg-purple-500/20 text-purple-400",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-3 rounded-lg transition-all",
        slot.completed
          ? "bg-green-500/10 border border-green-500/20"
          : "bg-white/5 border border-white/10",
        isDragging && "opacity-50 scale-[1.02] shadow-xl z-50 ring-2 ring-primary/50"
      )}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 rounded hover:bg-white/10 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="w-4 h-4 text-white/40" />
      </button>

      {/* Day name */}
      <span className="text-xs text-white/40 w-8 flex-shrink-0">{slot.dayName}</span>

      {/* Slot badge */}
      {slot.slot && (
        <span className={cn(
          "px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0",
          slotColors[slot.slot] || "bg-white/10 text-white/60"
        )}>
          {slot.slot}
        </span>
      )}

      {/* Subject */}
      <span className="text-sm font-medium text-white flex-1 truncate">{slot.subject}</span>

      {/* Topics preview */}
      <span className="text-xs text-white/50 truncate max-w-[120px] hidden sm:block">
        {slot.topics.slice(0, 2).join(", ")}
      </span>

      {/* Duration */}
      <span className="text-xs text-white/40 flex-shrink-0">{slot.duration}</span>

      {/* Completion indicator */}
      {slot.completed && (
        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
      )}
    </div>
  );
}

import { toast } from "sonner";
import { TopicStudyPanel } from "./topic-study-panel";
import { TopicReviewModal } from "./topic-review-modal";
import { createClient } from "@/lib/supabase/client";
import { CollabPlanModal, type ExamTypeOption as CollabExamTypeOption, type CollabBuddyInfo } from "./collab-plan-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StudyPlan {
  id: string;
  title: string;
  examType: string;
  durationWeeks: number;
  hoursPerDay: number;
  createdAt: string;
  schedule: WeekSchedule[];
  resources: StudyResource[];
  progress: number;
  microthemes?: Microtheme[];
}

interface WeekSchedule {
  week: number;
  focus: string;
  topics: DailyTopic[];
  goal: string;
}

interface DailyTopic {
  day: number;
  dayName: string;
  subject: string;
  topics: string[];
  duration: string;
  resources: string[];
  completed?: boolean;
  skipped?: boolean;
  slot?: "Morning" | "Afternoon" | "Evening"; // For multi-slot plans
}

interface StudyResource {
  type: "youtube" | "pdf" | "article";
  title: string;
  url: string;
  subject: string;
  duration?: string;
}

interface StudyPlannerTabProps {
  userId: string;
  isPro: boolean;
}

interface Microtheme {
  subject: string;
  topics: string[];
  subtopics: string[];
  pyqFrequency: number;
  importance: "high" | "medium" | "low";
}

interface ExamType {
  value: string;
  label: string;
  description?: string;
  microthemes?: Microtheme[];
  isUserExam?: boolean;
  isSeparator?: boolean;
  disabled?: boolean;
}

// Default exam types (fallback if API fails)
const DEFAULT_EXAM_TYPES: ExamType[] = [
  { value: "sikkim-psc", label: "Sikkim PSC (SPSC)", microthemes: [] },
  { value: "upsc-prelims", label: "UPSC Prelims", microthemes: [] },
  { value: "upsc-mains", label: "UPSC Mains", microthemes: [] },
  { value: "ssc-cgl", label: "SSC CGL", microthemes: [] },
  { value: "custom", label: "Custom Syllabus", microthemes: [] },
];

const DURATION_OPTIONS = [
  { value: "2", label: "2 Weeks (Crash Course)" },
  { value: "4", label: "4 Weeks (Focused)" },
  { value: "8", label: "8 Weeks (Comprehensive)" },
  { value: "12", label: "12 Weeks (In-Depth)" },
  { value: "24", label: "24 Weeks (Full Preparation)" },
];

const HOURS_OPTIONS = [
  { value: "2", label: "2 hours/day" },
  { value: "4", label: "4 hours/day" },
  { value: "6", label: "6 hours/day" },
  { value: "8", label: "8+ hours/day" },
];

const STUDY_SLOTS_OPTIONS = [
  { value: "1", label: "1 slot (Full day)", description: "Study in one continuous session" },
  { value: "2", label: "2 slots (Morning & Afternoon)", description: "Split study into two sessions" },
  { value: "3", label: "3 slots (Morning, Afternoon & Evening)", description: "Three focused sessions" },
];

interface PlannerGeneration {
  id: number;
  generation_type: string;
  title: string;
  output_data: any;
  created_at: string;
}

// Fix broken YouTube channel URLs by converting them to search URLs
function fixYouTubeUrl(url: string, title: string, subject: string): string {
  // Check if it's a broken YouTube channel URL (youtube.com/@something or youtube.com/c/something)
  if (url.includes('youtube.com/@') || url.includes('youtube.com/c/') || url.includes('youtube.com/channel/')) {
    // Convert to a search URL using the title and subject
    const searchQuery = encodeURIComponent(`${title} ${subject} UPSC`.replace(/[^\w\s]/gi, ''));
    return `https://www.youtube.com/results?search_query=${searchQuery}`;
  }
  return url;
}

interface TopicReview {
  id: number;
  plan_id: string;
  week_number: number;
  day_number: number;
  subject: string;
  topics: string[];
  leitner_box: number;
  next_review_at: string;
  last_reviewed_at: string | null;
  review_count: number;
  is_active: boolean;
}

function getMissedDays(plan: StudyPlan) {
  const currentPlanDay = Math.floor((Date.now() - new Date(plan.createdAt).getTime()) / 86400000) + 1;
  const missed: Array<{ week: number; day: number; dayName: string; subjects: string[]; topics: string[] }> = [];
  let globalDay = 0;
  for (const week of plan.schedule) {
    const uniqueDays = [...new Set(week.topics.map((t: DailyTopic) => t.day))].sort((a, b) => a - b);
    for (const dayNum of uniqueDays) {
      globalDay++;
      if (globalDay >= currentPlanDay) return missed;
      const incomplete = week.topics.filter((t: DailyTopic) => t.day === dayNum && !t.completed && !t.skipped);
      if (incomplete.length > 0) {
        missed.push({
          week: week.week,
          day: dayNum,
          dayName: incomplete[0]?.dayName || "",
          subjects: [...new Set(incomplete.map((e: DailyTopic) => e.subject))],
          topics: incomplete.flatMap((e: DailyTopic) => e.topics || []).slice(0, 5),
        });
      }
    }
  }
  return missed;
}

export function StudyPlannerTab({ userId, isPro }: StudyPlannerTabProps) {
  const searchParams = useSearchParams();
  const [view, setView] = useState<"list" | "create" | "detail" | "graph">("list");
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<StudyPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [isSavingReorder, setIsSavingReorder] = useState(false);
  const [hasReorderChanges, setHasReorderChanges] = useState(false);
  const [isCatchingUp, setIsCatchingUp] = useState(false);
  const [catchUpQueued, setCatchUpQueued] = useState<Set<string>>(new Set());

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Form state for creating new plan
  const [examType, setExamType] = useState("");
  const [customSyllabus, setCustomSyllabus] = useState("");
  const [durationWeeks, setDurationWeeks] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState("");
  const [studySlots, setStudySlots] = useState("1"); // Default to 1 slot
  const [focusAreas, setFocusAreas] = useState("");
  const [startWithSubject, setStartWithSubject] = useState(""); // "Start With" preference

  // Saved planner generations
  const [savedGenerations, setSavedGenerations] = useState<PlannerGeneration[]>([]);
  const [showSavedMaterials, setShowSavedMaterials] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

  // Due reviews for spaced repetition
  const [dueReviews, setDueReviews] = useState<TopicReview[]>([]);
  const [reviewModalData, setReviewModalData] = useState<TopicReview | null>(null);

  // Dynamic exam types from database
  const [examTypes, setExamTypes] = useState<ExamType[]>(DEFAULT_EXAM_TYPES);
  const [isLoadingExams, setIsLoadingExams] = useState(true);
  const [showMicrothemes, setShowMicrothemes] = useState(false);

  // Collaborative plan state
  const [activeBuddyMatchesList, setActiveBuddyMatchesList] = useState<Array<{id: number; buddyId: string; buddy: CollabBuddyInfo}>>([]);
  const [showBuddyPicker, setShowBuddyPicker] = useState(false);

  // Share existing plan with buddy
  const [showSharePlanDialog, setShowSharePlanDialog] = useState(false);
  const [isSharingPlan, setIsSharingPlan] = useState(false);
  const [sharedWithBuddyIds, setSharedWithBuddyIds] = useState<Set<string>>(new Set());
  const [isCreatingCollab, setIsCreatingCollab] = useState(false);
  const [collabState, setCollabState] = useState<{
    sessionId: string;
    buddyInfo: CollabBuddyInfo;
    matchId: number;
    isHost: boolean;
  } | null>(null);
  const [userFullName, setUserFullName] = useState("");

  // Get microthemes for selected exam
  const selectedExamMicrothemes = examType
    ? examTypes.find((e) => e.value === examType)?.microthemes || []
    : [];

  // Load exam types from database
  const loadExamTypes = async () => {
    try {
      const response = await fetch("/api/study-ai/exams");
      if (response.ok) {
        const data = await response.json();
        if (data.exams && data.exams.length > 0) {
          setExamTypes(data.exams);
        }
      }
    } catch (error) {
      console.error("Failed to load exam types:", error);
      // Keep using default exam types
    } finally {
      setIsLoadingExams(false);
    }
  };

  const loadActiveBuddyMatches = async () => {
    type ProfileRow = { id: string; full_name: string | null; username: string | null; avatar_url: string | null };
    try {
      const supabase = createClient();
      const { data: matches } = await supabase
        .from("buddy_matches")
        .select("id, user_a_id, user_b_id")
        .eq("status", "active")
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

      if (!matches || matches.length === 0) return;

      const buddyIds = matches.map(m => m.user_a_id === userId ? m.user_b_id : m.user_a_id);
      const { data: profilesRaw } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .in("id", buddyIds);
      const profiles = (profilesRaw ?? []) as ProfileRow[];

      const list = matches
        .map(m => {
          const buddyId = m.user_a_id === userId ? m.user_b_id : m.user_a_id;
          const profile = profiles.find(p => p.id === buddyId);
          if (!profile) return null;
          return {
            id: m.id as number,
            buddyId,
            buddy: {
              id: buddyId,
              full_name: profile.full_name,
              username: profile.username,
              avatar_url: profile.avatar_url,
            } as CollabBuddyInfo,
          };
        })
        .filter(Boolean) as Array<{id: number; buddyId: string; buddy: CollabBuddyInfo}>;

      setActiveBuddyMatchesList(list);

      // Also load current user's display name
      const { data: myProfileRaw } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", userId)
        .single();
      const myProfile = myProfileRaw as { full_name: string | null; username: string | null } | null;
      if (myProfile) {
        setUserFullName(myProfile.full_name || myProfile.username || "");
      }
    } catch (err) {
      console.error("Failed to load buddy matches:", err);
    }
  };

  // Load saved plans, generations, due reviews, and exam types on mount
  useEffect(() => {
    loadPlans();
    loadSavedGenerations();
    loadDueReviews();
    loadExamTypes();
    loadActiveBuddyMatches();
  }, [userId]);

  // Timer for plan generation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      setElapsedTime(0);
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating]);

  const loadDueReviews = async () => {
    try {
      const response = await fetch("/api/study-ai/planner-revision/due");
      if (response.ok) {
        const data = await response.json();
        setDueReviews(data.dueTopics || []);
      }
    } catch (error) {
      console.error("Failed to load due reviews:", error);
    }
  };

  // Helper to check if a topic is due for review
  const isTopicDueForReview = (planId: string, weekNum: number, dayNum: number): TopicReview | undefined => {
    return dueReviews.find(
      (r) => r.plan_id === planId && r.week_number === weekNum && r.day_number === dayNum
    );
  };

  // Handle ?collab=<sessionId> deep-link from buddy DM
  useEffect(() => {
    const collabParam = searchParams.get("collab");
    if (!collabParam) return;

    // Clean up URL immediately
    const url = new URL(window.location.href);
    url.searchParams.delete("collab");
    window.history.replaceState({}, "", url.toString());

    const joinCollabSession = async () => {
      try {
        const res = await fetch(`/api/study-ai/collab-plan?sessionId=${collabParam}`);
        if (!res.ok) {
          toast.error("Session not found or expired");
          return;
        }
        const { session } = await res.json();
        if (!session) return;

        const isHost = session.host_id === userId;
        const buddyId = isHost ? session.guest_id : session.host_id;

        const supabase = createClient();
        const { data: buddyProfile } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url")
          .eq("id", buddyId)
          .single();

        if (!buddyProfile) {
          toast.error("Could not find buddy profile");
          return;
        }

        const { data: match } = await supabase
          .from("buddy_matches")
          .select("id")
          .eq("status", "active")
          .or(`and(user_a_id.eq.${userId},user_b_id.eq.${buddyId}),and(user_a_id.eq.${buddyId},user_b_id.eq.${userId})`)
          .maybeSingle();

        const bp = buddyProfile as { id: string; full_name: string | null; username: string | null; avatar_url: string | null };
        const matchId = (match as { id: number } | null)?.id ?? 0;
        setCollabState({
          sessionId: session.id,
          buddyInfo: {
            id: bp.id,
            full_name: bp.full_name,
            username: bp.username,
            avatar_url: bp.avatar_url,
          },
          matchId,
          isHost,
        });
      } catch (err) {
        console.error("Failed to join collab session:", err);
        toast.error("Failed to join session");
      }
    };

    joinCollabSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleCreateCollabSession = async (match: {id: number; buddyId: string; buddy: CollabBuddyInfo}) => {
    setIsCreatingCollab(true);
    try {
      const res = await fetch("/api/study-ai/collab-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId: match.buddyId, matchId: match.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create session");

      setCollabState({
        sessionId: data.sessionId,
        buddyInfo: match.buddy,
        matchId: match.id,
        isHost: true,
      });
      setShowBuddyPicker(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start session";
      toast.error(msg);
    } finally {
      setIsCreatingCollab(false);
    }
  };

  // Track whether to auto-open notebook when returning from viewer pages
  const [autoOpenNotebook, setAutoOpenNotebook] = useState(false);

  // Auto-expand topic from URL param (when returning from view pages)
  useEffect(() => {
    const expandParam = searchParams.get("expand");
    const planIdParam = searchParams.get("planId");
    const notebookParam = searchParams.get("notebook");
    if (expandParam && plans.length > 0) {
      // Restore the exact plan the user came from, fall back to first plan
      const targetPlan = planIdParam
        ? (plans.find(p => p.id === planIdParam) ?? plans[0])
        : plans[0];
      if (targetPlan) {
        setSelectedPlan(targetPlan);
        setView("detail");
        setExpandedTopic(expandParam);
        if (notebookParam === "true") setAutoOpenNotebook(true);
        // Clean up the URL params after using them
        const url = new URL(window.location.href);
        url.searchParams.delete("expand");
        url.searchParams.delete("planId");
        url.searchParams.delete("notebook");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [searchParams, plans]);

  useEffect(() => {
    if (!selectedPlan) return;
    const missed = getMissedDays(selectedPlan);
    if (missed.length === 0 || catchUpQueued.has(selectedPlan.id)) return;
    // Fire-and-forget: silently queue missed topics for spaced repetition review
    fetch("/api/study-ai/plans/catch-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: selectedPlan.id,
        action: "queue_only",
        dayKeys: missed.map((d) => ({ week: d.week, day: d.day })),
      }),
    }).catch(() => {}); // silent — banner still shows even if this fails
    setCatchUpQueued((prev) => new Set([...prev, selectedPlan.id]));
  }, [selectedPlan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPlans = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/study-ai/plans");
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans || []);
      }
    } catch (error) {
      console.error("Failed to load plans:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSavedGenerations = async () => {
    try {
      const response = await fetch("/api/study-ai/planner-generations");
      if (response.ok) {
        const data = await response.json();
        setSavedGenerations(data.generations || []);
      }
    } catch (error) {
      console.error("Failed to load saved generations:", error);
    }
  };

  const handleDeleteGeneration = async (generationId: number) => {
    setDeletingIds(prev => new Set(prev).add(generationId));
    try {
      const response = await fetch("/api/study-ai/planner-generations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId }),
      });

      if (response.ok) {
        setSavedGenerations(prev => prev.filter(g => g.id !== generationId));
        toast.success("Material deleted");
      } else {
        toast.error("Failed to delete");
      }
    } catch (error) {
      toast.error("Failed to delete");
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(generationId);
        return next;
      });
    }
  };

  const handleViewGeneration = (gen: PlannerGeneration) => {
    const meta = gen.output_data?._planner_meta || {};
    const baseData = {
      subject: meta.subject || "",
      topics: meta.topics || [],
    };

    switch (gen.generation_type) {
      case "mindmap":
        sessionStorage.setItem("planner-mindmap-data", JSON.stringify({
          markdown: gen.output_data.markdown,
          title: gen.title,
          ...baseData,
        }));
        window.location.href = "/study-ai/planner/view/mindmap";
        break;
      case "summary":
        sessionStorage.setItem("planner-summary-data", JSON.stringify({
          title: gen.title,
          keyPoints: gen.output_data.keyPoints,
          keyDates: gen.output_data.keyDates,
          keyConcepts: gen.output_data.keyConcepts,
          examFacts: gen.output_data.examFacts,
          conclusion: gen.output_data.conclusion,
          ...baseData,
        }));
        window.location.href = "/study-ai/planner/view/summary";
        break;
      case "flashcards":
        sessionStorage.setItem("planner-flashcards-data", JSON.stringify({
          title: gen.title,
          cards: gen.output_data.cards,
          ...baseData,
        }));
        window.location.href = "/study-ai/planner/view/flashcards";
        break;
      case "quiz":
        sessionStorage.setItem("planner-quiz-data", JSON.stringify({
          title: gen.title,
          questions: gen.output_data.questions,
          ...baseData,
        }));
        window.location.href = "/study-ai/planner/view/quiz";
        break;
      case "infographic":
        sessionStorage.setItem("planner-infographic-data", JSON.stringify({
          title: gen.title,
          keyFacts: gen.output_data.keyFacts,
          highlights: gen.output_data.highlights,
          ...baseData,
        }));
        window.location.href = "/study-ai/planner/view/infographic";
        break;
    }
  };

  // Poll for job status
  const pollJobStatus = async (jobId: string): Promise<StudyPlan | null> => {
    const maxAttempts = 90; // 3 minutes max (2s intervals)
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`/api/study-ai/generate-plan/status?jobId=${jobId}`);
        if (!response.ok) {
          throw new Error("Failed to check job status");
        }

        const data = await response.json();

        if (data.status === "completed" && data.plan) {
          return data.plan;
        } else if (data.status === "failed") {
          throw new Error(data.error || "Plan generation failed");
        }

        // Still processing, wait and try again
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      } catch (error) {
        throw error;
      }
    }

    throw new Error("Plan generation timed out. Please try again.");
  };

  const handleGeneratePlan = async () => {
    if (!examType || !durationWeeks || !hoursPerDay) {
      toast.error("Please fill all required fields");
      return;
    }

    setIsGenerating(true);
    try {
      // Step 1: Create the job
      const response = await fetch("/api/study-ai/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examType,
          customSyllabus: examType === "custom" ? customSyllabus : undefined,
          durationWeeks: parseInt(durationWeeks),
          hoursPerDay: parseInt(hoursPerDay),
          studySlots: parseInt(studySlots),
          focusAreas: focusAreas ? focusAreas.split(",").map(s => s.trim()) : [],
          startWithSubject: startWithSubject || undefined,
          startDay: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date().getDay()],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start plan generation");
      }

      const data = await response.json();

      if (!data.jobId) {
        throw new Error("No job ID received");
      }

      toast.info("Generating your study plan... This may take a minute.");

      // Step 2: Trigger Edge Function directly from frontend (browser has no timeout)
      // Fire and forget - don't await, let it run in background
      fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-study-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId: data.jobId }),
      }).catch((err) => {
        console.error("Edge function trigger error:", err);
        // Ignore errors - the polling will detect if it failed
      });

      // Step 3: Poll for completion
      const plan = await pollJobStatus(data.jobId);

      if (plan) {
        setPlans(prev => [plan, ...prev]);
        setSelectedPlan(plan);
        setView("detail");
        toast.success("Study plan generated successfully!");

        // Reset form
        setExamType("");
        setCustomSyllabus("");
        setDurationWeeks("");
        setHoursPerDay("");
        setStudySlots("1");
        setFocusAreas("");
        setStartWithSubject("");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to generate plan");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      const response = await fetch(`/api/study-ai/plans/${planId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setPlans(prev => prev.filter(p => p.id !== planId));
        if (selectedPlan?.id === planId) {
          setSelectedPlan(null);
          setView("list");
        }
        toast.success("Plan deleted");
      }
    } catch (error) {
      toast.error("Failed to delete plan");
    }
  };

  const handleMarkComplete = async (planId: string, week: number, day: number) => {
    try {
      const response = await fetch("/api/study-ai/plans/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, week, day, completed: true }),
      });

      if (response.ok) {
        // Update local state
        setPlans(prev => prev.map(p => {
          if (p.id === planId) {
            const updatedSchedule = p.schedule.map(w => {
              if (w.week === week) {
                return {
                  ...w,
                  topics: w.topics.map(t =>
                    t.day === day ? { ...t, completed: true } : t
                  ),
                };
              }
              return w;
            });
            return { ...p, schedule: updatedSchedule };
          }
          return p;
        }));
        toast.success("Marked as complete!");
      }
    } catch (error) {
      toast.error("Failed to update progress");
    }
  };

  const handleCatchUp = async (action: "queue_and_dismiss" | "add_to_today") => {
    if (!selectedPlan) return;
    setIsCatchingUp(true);
    try {
      const missed = getMissedDays(selectedPlan);
      const res = await fetch("/api/study-ai/plans/catch-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlan.id,
          action,
          dayKeys: missed.map((d) => ({ week: d.week, day: d.day })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const updated = { ...selectedPlan, schedule: data.schedule, progress: data.progress };
      setSelectedPlan(updated);
      setPlans((prev) => prev.map((p) => (p.id === selectedPlan.id ? updated : p)));
      toast.success(
        action === "add_to_today"
          ? "Missed topics added to today's schedule"
          : "Topics saved to revision queue"
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update plan");
    } finally {
      setIsCatchingUp(false);
    }
  };

  // Unified cross-week drag handler — works for both single-slot and multi-slot plans
  const handleCrossWeekDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedPlan) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const isSlot = activeId.startsWith("slot-");

    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const slotNames: ("Morning" | "Afternoon" | "Evening")[] = ["Morning", "Afternoon", "Evening"];

    // Build flat index lookup for both ID formats
    const getFlatIndex = (id: string): number => {
      let count = 0;
      for (let wi = 0; wi < selectedPlan.schedule.length; wi++) {
        for (let di = 0; di < selectedPlan.schedule[wi].topics.length; di++) {
          const itemId = isSlot ? `slot-${wi}-${di}` : `${wi}-${di}`;
          if (itemId === id) return count;
          count++;
        }
      }
      return -1;
    };

    const srcIndex = getFlatIndex(activeId);
    const dstIndex = getFlatIndex(overId);
    if (srcIndex === -1 || dstIndex === -1) return;

    // Reorder the flat list then redistribute back into weeks (preserving week sizes)
    const allItems = selectedPlan.schedule.flatMap(w => w.topics);
    const newAllItems = arrayMove(allItems, srcIndex, dstIndex);

    let offset = 0;
    const newSchedule = selectedPlan.schedule.map((week) => {
      const count = week.topics.length;
      const weekTopics = newAllItems.slice(offset, offset + count);
      offset += count;

      if (isSlot) {
        const slotsPerDay = week.topics.filter(t => t.day === 1).length || 2;
        const reorderedTopics = weekTopics.map((topic, idx) => ({
          ...topic,
          day: Math.floor(idx / slotsPerDay) + 1,
          dayName: dayNames[Math.floor(idx / slotsPerDay)] || topic.dayName,
          slot: slotNames[idx % slotsPerDay],
        }));
        return { ...week, topics: reorderedTopics };
      } else {
        const reorderedTopics = weekTopics.map((topic, idx) => ({
          ...topic,
          day: idx + 1,
          dayName: dayNames[idx] || topic.dayName,
        }));
        return { ...week, topics: reorderedTopics };
      }
    });

    setSelectedPlan({ ...selectedPlan, schedule: newSchedule });
    setPlans(prev => prev.map(p =>
      p.id === selectedPlan.id ? { ...p, schedule: newSchedule } : p
    ));
    setHasReorderChanges(true);
  };

  // Save reordered schedule to database
  const handleSaveReorder = async () => {
    if (!selectedPlan || !hasReorderChanges) return;

    setIsSavingReorder(true);
    try {
      const response = await fetch("/api/study-ai/plans/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlan.id,
          schedule: selectedPlan.schedule,
        }),
      });

      if (response.ok) {
        toast.success("Schedule reordered successfully!");
        setHasReorderChanges(false);
        setIsReorderMode(false);
      } else {
        toast.error("Failed to save changes");
      }
    } catch (error) {
      toast.error("Failed to save changes");
    } finally {
      setIsSavingReorder(false);
    }
  };

  // Cancel reorder mode
  const handleCancelReorder = () => {
    if (hasReorderChanges) {
      // Reload the original plan
      loadPlans();
    }
    setIsReorderMode(false);
    setHasReorderChanges(false);
  };

  // Share plan with a buddy (copy to their account)
  const handleSharePlan = async (matchId: number, buddyId: string, buddyName: string) => {
    if (!selectedPlan || isSharingPlan) return;
    setIsSharingPlan(true);
    try {
      const res = await fetch("/api/study-ai/plans/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlan.id, matchId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to share");
      setSharedWithBuddyIds(prev => new Set(prev).add(buddyId));
      toast.success(`Plan shared with ${buddyName}! They'll find it in their Planner.`);
      setShowSharePlanDialog(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to share plan");
    } finally {
      setIsSharingPlan(false);
    }
  };

  // List View
  if (view === "list") {
    return (
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="widget-glass p-6 rounded-2xl"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">AI Study Planner & AI Tutor</h2>
                <p className="text-white/60 text-sm">
                  Get personalized study schedules and 1-on-1 tutoring powered by AI
                </p>
              </div>
            </div>
            <Button
              onClick={() => setView("create")}
              className="bg-primary hover:bg-primary/90"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create New Plan
            </Button>
          </div>
        </motion.div>

        {/* Upcoming Exams Section (Admin Exams) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="widget-glass p-6 rounded-2xl"
        >
          <UpcomingExamsSection
            onSelectExam={(examSlug) => {
              setExamType(examSlug);
              setView("create");
            }}
          />
        </motion.div>

        {/* My Custom Exams Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="widget-glass p-6 rounded-2xl"
        >
          <MyExamsSection
            onSelectExam={(examId) => {
              setExamType(examId);
              setView("create");
            }}
          />
        </motion.div>

        {/* Plans List */}
        {isLoading ? (
          <div className="widget-glass p-12 rounded-2xl flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : plans.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="widget-glass p-12 rounded-2xl text-center"
          >
            <Calendar className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              No Study Plans Yet
            </h3>
            <p className="text-white/60 mb-6 max-w-md mx-auto">
              Create your first AI-powered study plan to get a personalized schedule,
              curated resources, and track your progress.
            </p>
            <Button
              onClick={() => setView("create")}
              className="bg-primary hover:bg-primary/90"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create Your First Plan
            </Button>
          </motion.div>
        ) : (
          <div className="grid gap-4">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="widget-glass p-5 rounded-xl hover:ring-1 hover:ring-primary/30 transition-all cursor-pointer group"
                onClick={() => {
                  setSelectedPlan(plan);
                  setView("detail");
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary/20 to-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Target className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white group-hover:text-primary transition-colors truncate text-sm sm:text-base">
                        {plan.title}
                      </h3>
                      <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-white/60 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          {plan.durationWeeks}w
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          {plan.hoursPerDay}h/day
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pl-13 sm:pl-0">
                    <div className="text-right flex-1 sm:flex-none">
                      <div className="text-xs sm:text-sm font-medium text-primary">
                        {Math.round(plan.progress || 0)}%
                      </div>
                      <div className="w-16 sm:w-20 h-1.5 rounded-full bg-white/10 overflow-hidden ml-auto">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${plan.progress || 0}%` }}
                        />
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-primary transition-colors flex-shrink-0" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Saved Study Materials Section */}
        {savedGenerations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="widget-glass rounded-2xl overflow-hidden"
          >
            <button
              onClick={() => setShowSavedMaterials(!showSavedMaterials)}
              className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
                  <BookmarkCheck className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-white">Saved Study Materials</h3>
                  <p className="text-sm text-white/60">
                    {savedGenerations.length} saved {savedGenerations.length === 1 ? "material" : "materials"}
                  </p>
                </div>
              </div>
              {showSavedMaterials ? (
                <ChevronDown className="w-5 h-5 text-white/60" />
              ) : (
                <ChevronRight className="w-5 h-5 text-white/60" />
              )}
            </button>

            {showSavedMaterials && (
              <div className="px-5 pb-5 space-y-3">
                {savedGenerations.map((gen, index) => {
                  const typeConfig: Record<string, { icon: typeof FileText; color: string; bg: string; label: string }> = {
                    summary: { icon: FileText, color: "text-green-400", bg: "bg-green-500/20", label: "Summary" },
                    mindmap: { icon: Map, color: "text-blue-400", bg: "bg-blue-500/20", label: "Mind Map" },
                    flashcards: { icon: ListChecks, color: "text-yellow-400", bg: "bg-yellow-500/20", label: "Flashcards" },
                    quiz: { icon: HelpCircle, color: "text-purple-400", bg: "bg-purple-500/20", label: "Quiz" },
                    infographic: { icon: BarChart3, color: "text-red-400", bg: "bg-red-500/20", label: "Infographic" },
                  };
                  const config = typeConfig[gen.generation_type] || typeConfig.summary;
                  const Icon = config.icon;
                  const meta = gen.output_data?._planner_meta || {};

                  return (
                    <motion.div
                      key={gen.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * index }}
                      className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", config.bg)}>
                          <Icon className={cn("w-5 h-5", config.color)} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">
                            {gen.title || config.label}
                          </p>
                          <p className="text-white/40 text-sm truncate">
                            {meta.subject ? `${meta.subject}` : config.label}
                            {meta.topics?.length > 0 && ` · ${meta.topics.slice(0, 2).join(", ")}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewGeneration(gen)}
                          className="h-9 w-9 p-0 text-white/40 hover:text-white hover:bg-white/10"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteGeneration(gen.id)}
                          disabled={deletingIds.has(gen.id)}
                          className="h-9 w-9 p-0 text-white/40 hover:text-red-400 hover:bg-red-500/10"
                        >
                          {deletingIds.has(gen.id) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </div>
    );
  }

  // Create View
  if (view === "create") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="widget-glass p-6 rounded-2xl">
          <button
            onClick={() => setView("list")}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-4"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back to Plans
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Create Study Plan</h2>
              <p className="text-white/60 text-sm">
                AI will generate a personalized schedule with resources
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Exam Type */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Exam Type *
              </label>
              <Select value={examType} onValueChange={(val) => { setExamType(val); setShowMicrothemes(false); setStartWithSubject(""); }} disabled={isLoadingExams}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder={isLoadingExams ? "Loading exams..." : "Select exam type"} />
                </SelectTrigger>
                <SelectContent>
                  {examTypes.map(exam => (
                    exam.isSeparator ? (
                      <div key={exam.value} className="px-2 py-1.5 text-xs text-white/40 font-medium select-none">
                        {exam.label}
                      </div>
                    ) : (
                      <SelectItem key={exam.value} value={exam.value}>
                        <div className="flex items-center gap-2">
                          {exam.label}
                          {exam.isUserExam && (
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-primary/20 text-primary">My Exam</span>
                          )}
                          {exam.microthemes && exam.microthemes.length > 0 && !exam.isUserExam && (
                            <span className="text-[10px] text-white/40">✓ {exam.microthemes.length} topics</span>
                          )}
                        </div>
                      </SelectItem>
                    )
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Microthemes Preview (for selected exam) */}
            {examType && examType !== "custom" && selectedExamMicrothemes.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <button
                  onClick={() => setShowMicrothemes(!showMicrothemes)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-white">
                      High Yield Exam Topics ({selectedExamMicrothemes.length} subjects)
                    </span>
                  </div>
                  {showMicrothemes ? (
                    <ChevronDown className="w-4 h-4 text-white/60" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-white/60" />
                  )}
                </button>

                <AnimatePresence>
                  {showMicrothemes && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/10"
                    >
                      <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                        {selectedExamMicrothemes.map((theme, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg bg-white/5 border border-white/10"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-white text-sm">
                                {theme.subject}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-xs font-medium",
                                  theme.importance === "high"
                                    ? "bg-red-500/20 text-red-400"
                                    : theme.importance === "medium"
                                    ? "bg-yellow-500/20 text-yellow-400"
                                    : "bg-green-500/20 text-green-400"
                                )}>
                                  {theme.importance}
                                </span>
                                {theme.pyqFrequency > 0 && (
                                  <span className="text-xs text-white/40">
                                    PYQ: {theme.pyqFrequency}x
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-white/60">
                              {theme.topics?.slice(0, 4).join(", ")}
                              {theme.topics?.length > 4 && ` +${theme.topics.length - 4} more`}
                            </p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Custom Syllabus (conditional) */}
            {examType === "custom" && (
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Custom Syllabus / Topics
                </label>
                <Textarea
                  value={customSyllabus}
                  onChange={(e) => setCustomSyllabus(e.target.value)}
                  placeholder="Enter your syllabus topics, one per line..."
                  className="bg-white/5 border-white/10 text-white min-h-[120px]"
                />
              </div>
            )}

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Preparation Duration *
              </label>
              <Select value={durationWeeks} onValueChange={setDurationWeeks}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Hours per day */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Study Hours per Day *
              </label>
              <Select value={hoursPerDay} onValueChange={setHoursPerDay}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select hours" />
                </SelectTrigger>
                <SelectContent>
                  {HOURS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Study Slots */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Daily Study Sessions
              </label>
              <Select value={studySlots} onValueChange={setStudySlots}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select slots" />
                </SelectTrigger>
                <SelectContent>
                  {STUDY_SLOTS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hoursPerDay && parseInt(studySlots) > 1 && (
                <p className="text-xs text-white/40 mt-1">
                  {Math.floor(parseInt(hoursPerDay) / parseInt(studySlots))}h per slot × {studySlots} slots
                </p>
              )}
            </div>

            {/* Focus Areas (optional) */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Focus Areas (optional)
              </label>
              <Input
                value={focusAreas}
                onChange={(e) => setFocusAreas(e.target.value)}
                placeholder="e.g., History, Geography, Current Affairs"
                className="bg-white/5 border-white/10 text-white"
              />
              <p className="text-xs text-white/40 mt-1">
                Separate multiple areas with commas
              </p>
            </div>

            {/* Start With Subject (optional) - only show when exam has microthemes */}
            {examType && examType !== "custom" && selectedExamMicrothemes.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Start With Subject (optional)
                </label>
                <Select value={startWithSubject || "auto"} onValueChange={(val) => setStartWithSubject(val === "auto" ? "" : val)}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Auto (AI decides)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (AI decides)</SelectItem>
                    {selectedExamMicrothemes.map((theme) => (
                      <SelectItem key={theme.subject} value={theme.subject}>
                        {theme.subject}
                        {theme.importance === "high" && " ⭐"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-white/40 mt-1">
                  Choose which subject to begin your study plan with
                </p>
              </div>
            )}

            {/* Plan Together with a Buddy */}
            {activeBuddyMatchesList.length > 0 && !isGenerating && (
              <div>
                {showBuddyPicker ? (
                  <div className="p-4 rounded-xl bg-white/5 border border-primary/20 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-white/80">Select a buddy to plan with:</p>
                      <button
                        onClick={() => setShowBuddyPicker(false)}
                        className="text-white/40 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {activeBuddyMatchesList.map(match => (
                      <button
                        key={match.id}
                        onClick={() => handleCreateCollabSession(match)}
                        disabled={isCreatingCollab}
                        className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:border-primary/30 hover:bg-primary/5 transition-all text-left disabled:opacity-50"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-medium text-primary">
                          {(match.buddy.full_name || match.buddy.username || "?").slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-white flex-1 truncate">
                          {match.buddy.full_name || match.buddy.username}
                        </span>
                        {isCreatingCollab && <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (activeBuddyMatchesList.length === 1) {
                        handleCreateCollabSession(activeBuddyMatchesList[0]);
                      } else {
                        setShowBuddyPicker(true);
                      }
                    }}
                    disabled={isCreatingCollab}
                    className="w-full border-primary/30 text-primary hover:bg-primary/10 h-11"
                  >
                    {isCreatingCollab ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Users className="w-4 h-4 mr-2" />
                    )}
                    Plan Together with a Buddy
                  </Button>
                )}
              </div>
            )}

            {/* Generate Button */}
            <Button
              onClick={handleGeneratePlan}
              disabled={isGenerating || !examType || !durationWeeks || !hoursPerDay}
              className="w-full bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 h-12"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Generating Your Plan... ({Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')})
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate AI Study Plan
                </>
              )}
            </Button>

            {!isPro && (
              <p className="text-center text-xs text-white/40">
                Free users: 1 plan per week. Pro users: Unlimited plans.
              </p>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Detail View
  if (view === "detail" && selectedPlan) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="widget-glass p-6 rounded-2xl">
          <button
            onClick={() => {
              setView("list");
              setSelectedPlan(null);
            }}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-4"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back to Plans
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-bold text-white truncate">{selectedPlan.title}</h2>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-white/60">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {selectedPlan.durationWeeks} weeks
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {selectedPlan.hoursPerDay}h/day
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Started {new Date(selectedPlan.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {isReorderMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelReorder}
                    className="border-white/20 text-white/60 hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveReorder}
                    disabled={!hasReorderChanges || isSavingReorder}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {isSavingReorder ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-1" />
                        Save
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsReorderMode(true)}
                    className="border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <ArrowUpDown className="w-4 h-4 mr-1" />
                    Reorder
                  </Button>
                  {activeBuddyMatchesList.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSharedWithBuddyIds(new Set());
                        setShowSharePlanDialog(true);
                      }}
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    >
                      <UserPlus className="w-4 h-4 mr-1" />
                      Share
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setView("graph")}
                    className="border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Network className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Knowledge Graph</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeletePlan(selectedPlan.id)}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-white/60">Overall Progress</span>
              <span className="text-primary font-medium">
                {Math.round(selectedPlan.progress || 0)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all"
                style={{ width: `${selectedPlan.progress || 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* High Yield Exam Topics / Microthemes Section */}
        {selectedPlan.microthemes && selectedPlan.microthemes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="widget-glass rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setShowMicrothemes(!showMicrothemes)}
              className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-white">High Yield Exam Topics</h3>
                  <p className="text-xs text-white/60">
                    {selectedPlan.microthemes.length} microthemes covered in this plan
                  </p>
                </div>
              </div>
              {showMicrothemes ? (
                <ChevronDown className="w-5 h-5 text-white/60" />
              ) : (
                <ChevronRight className="w-5 h-5 text-white/60" />
              )}
            </button>

            <AnimatePresence>
              {showMicrothemes && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-white/10"
                >
                  <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                    {selectedPlan.microthemes.map((theme, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-white/5 border border-white/10"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-white text-sm">
                            {theme.subject}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-xs font-medium",
                              theme.importance === "high"
                                ? "bg-red-500/20 text-red-400"
                                : theme.importance === "medium"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-green-500/20 text-green-400"
                            )}>
                              {theme.importance}
                            </span>
                            {theme.pyqFrequency > 0 && (
                              <span className="text-xs text-white/40">
                                PYQ: {theme.pyqFrequency}x
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-white/60">
                          {theme.topics?.slice(0, 4).join(", ")}
                          {theme.topics?.length > 4 && ` +${theme.topics.length - 4} more`}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Weekly Schedule */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCrossWeekDragEnd}>
        <SortableContext
          items={isReorderMode
            ? (selectedPlan.schedule.some(w => w.topics.some(t => t.slot))
                ? selectedPlan.schedule.flatMap((w, wi) => w.topics.map((_, i) => `slot-${wi}-${i}`))
                : selectedPlan.schedule.flatMap((w, wi) => w.topics.map((_, i) => `${wi}-${i}`)))
            : []}
          strategy={verticalListSortingStrategy}
        >
        <div className="space-y-4">
          {(() => {
            const missedDays = getMissedDays(selectedPlan);
            if (!missedDays.length) return null;
            const previewTopics = missedDays.flatMap((d) => d.topics).slice(0, 4);
            const overflow = missedDays.flatMap((d) => d.topics).length - 4;
            return (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mb-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">
                        {missedDays.length} missed day{missedDays.length > 1 ? "s" : ""} — topics added to your revision queue
                      </p>
                      <p className="text-xs text-white/50 mt-0.5">
                        {previewTopics.join(", ")}{overflow > 0 ? ` +${overflow} more` : ""}
                      </p>
                      <p className="text-xs text-white/40 mt-1">Continue today&apos;s schedule as planned.</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white/50 text-xs h-7"
                      disabled={isCatchingUp}
                      onClick={() => handleCatchUp("queue_and_dismiss")}
                    >
                      {isCatchingUp ? <Loader2 className="w-3 h-3 animate-spin" /> : "Dismiss"}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-amber-500 hover:bg-amber-600 text-white text-xs h-7"
                      disabled={isCatchingUp}
                      onClick={() => handleCatchUp("add_to_today")}
                    >
                      Add to Today
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })()}
          {selectedPlan.schedule.map((week, weekIndex) => {
            // Group topics by day for multi-slot display
            const hasSlots = week.topics.some(t => t.slot);
            const groupedByDay = hasSlots
              ? week.topics.reduce((acc, topic) => {
                  const key = topic.day;
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(topic);
                  return acc;
                }, {} as Record<number, DailyTopic[]>)
              : null;

            return (
              <motion.div
                key={week.week}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: weekIndex * 0.1 }}
                className="widget-glass p-5 rounded-xl"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white">Week {week.week}</h3>
                    <p className="text-sm text-primary truncate">{week.focus}</p>
                  </div>
                  <div className="text-xs text-white/40 bg-white/5 px-3 py-1 rounded-full self-start sm:self-auto whitespace-nowrap">
                    {week.goal}
                  </div>
                </div>

                <div className="grid gap-2">
                  {/* Reorder Mode Banner */}
                  {isReorderMode && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary mb-2">
                      <GripVertical className="w-4 h-4" />
                      <span>Drag items to reorder. {hasSlots ? "Slots can be moved across days and weeks." : "Items can be moved across weeks."} Click Save when done.</span>
                    </div>
                  )}

                  {hasSlots && groupedByDay && isReorderMode ? (
                    // Multi-slot reorder mode - items rendered inside shared parent DndContext
                    <>
                      {week.topics.map((slot, slotIndex) => (
                        <SortableSlotItem
                          key={`slot-${weekIndex}-${slotIndex}`}
                          id={`slot-${weekIndex}-${slotIndex}`}
                          slot={slot}
                        />
                      ))}
                    </>
                  ) : hasSlots && groupedByDay ? (
                    // Multi-slot display: group slots under each day (normal view)
                    Object.entries(groupedByDay).map(([dayNum, slots]) => {
                      const firstSlot = slots[0];
                      const dayKey = `week-${week.week}-day-${dayNum}`;
                      const isExpanded = expandedTopic?.startsWith(dayKey);
                      const totalDuration = slots.reduce((sum, s) => {
                        const hours = parseInt(s.duration) || 0;
                        return sum + hours;
                      }, 0);
                      const allCompleted = slots.every(s => s.completed);
                      const allSkipped = slots.every(s => s.skipped);

                      return (
                        <div key={dayKey} className={cn("rounded-lg overflow-hidden", allSkipped && "opacity-50")}>
                          <div
                            className={cn(
                              "p-3 transition-all cursor-pointer",
                              allCompleted
                                ? "bg-green-500/10 border border-green-500/20"
                                : "bg-white/5 border border-white/5 hover:border-primary/30",
                              isExpanded && "border-primary/50 bg-primary/5"
                            )}
                            onClick={() => setExpandedTopic(isExpanded ? null : dayKey)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs text-white/40 w-8 sm:w-12 flex-shrink-0">{firstSlot.dayName}</span>
                                <span className="text-xs text-white/50 flex-shrink-0">{totalDuration}h total</span>
                              </div>
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-primary flex-shrink-0 ml-2" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-white/40 flex-shrink-0 ml-2" />
                              )}
                            </div>
                            {/* Slot pills */}
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                              {slots.map((slot, idx) => (
                                <div
                                  key={idx}
                                  className={cn(
                                    "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs",
                                    slot.completed
                                      ? "bg-green-500/20 border border-green-500/30"
                                      : slot.skipped
                                      ? "bg-white/5 border border-white/10 opacity-50"
                                      : "bg-white/5 border border-white/10"
                                  )}
                                >
                                  <span className={cn(
                                    "px-1 sm:px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-medium",
                                    slot.slot === "Morning" ? "bg-yellow-500/20 text-yellow-400" :
                                    slot.slot === "Afternoon" ? "bg-orange-500/20 text-orange-400" :
                                    "bg-purple-500/20 text-purple-400"
                                  )}>
                                    {slot.slot}
                                  </span>
                                  <span className="font-medium text-white truncate max-w-[80px] sm:max-w-none">{slot.subject}</span>
                                </div>
                              ))}
                              {allSkipped && (
                                <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full self-center">In Review Queue</span>
                              )}
                            </div>
                          </div>

                          {/* Expanded: show all slots with study panels */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="bg-white/5 border-x border-b border-white/10"
                              >
                                {slots.map((slot, idx) => {
                                  const slotKey = `${dayKey}-slot-${idx}`;
                                  const slotExpanded = expandedTopic === slotKey;
                                  const dueReview = isTopicDueForReview(selectedPlan.id, week.week, slot.day);

                                  return (
                                    <div key={slotKey} className={cn("border-b border-white/5 last:border-b-0", slot.skipped && "opacity-50")}>
                                      <div
                                        className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 cursor-pointer hover:bg-white/5"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedTopic(slotExpanded ? dayKey : slotKey);
                                        }}
                                      >
                                        <div className="flex items-center gap-2 sm:gap-3">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleMarkComplete(selectedPlan.id, week.week, slot.day);
                                            }}
                                            className={cn(
                                              "w-5 h-5 rounded-full flex items-center justify-center transition-all flex-shrink-0",
                                              slot.completed
                                                ? "bg-green-500 text-white"
                                                : "border-2 border-white/30 hover:border-primary"
                                            )}
                                          >
                                            {slot.completed && <CheckCircle2 className="w-3 h-3" />}
                                          </button>
                                          <span className={cn(
                                            "px-2 py-0.5 rounded text-xs font-medium flex-shrink-0",
                                            slot.slot === "Morning" ? "bg-yellow-500/20 text-yellow-400" :
                                            slot.slot === "Afternoon" ? "bg-orange-500/20 text-orange-400" :
                                            "bg-purple-500/20 text-purple-400"
                                          )}>
                                            {slot.slot}
                                          </span>
                                          <span className="text-sm font-medium text-white sm:hidden">{slot.subject}</span>
                                        </div>
                                        <div className="flex-1 min-w-0 pl-7 sm:pl-0">
                                          <span className="text-sm font-medium text-white hidden sm:inline">{slot.subject}</span>
                                          <p className="text-xs text-white/60 truncate">
                                            {slot.topics.join(", ")}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2 pl-7 sm:pl-0">
                                          <span className="text-xs text-white/40">{slot.duration}</span>
                                          {slot.skipped && (
                                            <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">In Review Queue</span>
                                          )}
                                          {dueReview && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setReviewModalData(dueReview);
                                              }}
                                              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs"
                                            >
                                              <Bell className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      {slotExpanded && (
                                        <div className="p-4 bg-white/5">
                                          <TopicStudyPanel
                                            subject={slot.subject}
                                            topics={slot.topics}
                                            examType={selectedPlan.examType}
                                            examDisplayName={examTypes.find(e => e.value === selectedPlan.examType)?.label || selectedPlan.title}
                                            userId={userId}
                                            isPro={isPro}
                                            topicKey={slotKey}
                                            planId={selectedPlan.id}
                                            autoOpenNotebook={autoOpenNotebook}
                                            onClose={() => setExpandedTopic(dayKey)}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })
                  ) : isReorderMode ? (
                    // Single-slot reorder mode - items rendered inside shared parent DndContext
                    <>
                      {week.topics.map((day, dayIndex) => {
                        const sortableId = `${weekIndex}-${dayIndex}`;
                        return (
                          <SortableDayItem
                            key={sortableId}
                            id={sortableId}
                            day={day}
                            weekIndex={weekIndex}
                            dayIndex={dayIndex}
                          />
                        );
                      })}
                    </>
                  ) : (
                    // Single-slot display (original behavior)
                    week.topics.map((day, dayIndex) => {
                      const topicKey = `week-${week.week}-day-${dayIndex}`;
                      const isExpanded = expandedTopic === topicKey;
                      const dueReview = isTopicDueForReview(selectedPlan.id, week.week, day.day);

                      return (
                        <div key={topicKey} className={cn("rounded-lg overflow-hidden", day.skipped && "opacity-50")}>
                          <div
                            className={cn(
                              "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 transition-all cursor-pointer",
                              day.completed
                                ? "bg-green-500/10 border border-green-500/20"
                                : "bg-white/5 border border-white/5 hover:border-primary/30",
                              isExpanded && "border-primary/50 bg-primary/5"
                            )}
                            onClick={() => setExpandedTopic(isExpanded ? null : topicKey)}
                          >
                            <div className="flex items-center gap-2 sm:gap-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkComplete(selectedPlan.id, week.week, day.day);
                                }}
                                className={cn(
                                  "w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all flex-shrink-0",
                                  day.completed
                                    ? "bg-green-500 text-white"
                                    : "border-2 border-white/30 hover:border-primary"
                                )}
                              >
                                {day.completed && <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />}
                              </button>
                              <span className="text-xs text-white/40 w-8 sm:w-12 flex-shrink-0">{day.dayName}</span>
                              <span className="text-sm font-medium text-white truncate">{day.subject}</span>
                              {day.skipped && (
                                <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full flex-shrink-0">In Review Queue</span>
                              )}
                              {dueReview && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReviewModalData(dueReview);
                                  }}
                                  className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-[10px] sm:text-xs font-medium hover:bg-orange-500/30 transition-colors flex-shrink-0"
                                >
                                  <Bell className="w-3 h-3" />
                                  <span className="hidden sm:inline">Review Due</span>
                                </button>
                              )}
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-2 pl-7 sm:pl-0 sm:flex-1">
                              <p className="text-xs text-white/60 truncate flex-1 sm:flex-none sm:max-w-[200px]">
                                {day.topics.join(", ")}
                              </p>
                              <span className="text-xs text-white/40 flex-shrink-0">{day.duration}</span>
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-primary flex-shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-white/40 flex-shrink-0" />
                              )}
                            </div>
                          </div>

                          {/* Expanded Study Panel */}
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="bg-white/5 border-x border-b border-white/10 p-4"
                            >
                              <TopicStudyPanel
                                subject={day.subject}
                                topics={day.topics}
                                examType={selectedPlan.examType}
                                examDisplayName={examTypes.find(e => e.value === selectedPlan.examType)?.label || selectedPlan.title}
                                userId={userId}
                                isPro={isPro}
                                topicKey={topicKey}
                                planId={selectedPlan.id}
                                autoOpenNotebook={autoOpenNotebook}
                                onClose={() => setExpandedTopic(null)}
                              />
                            </motion.div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
        </SortableContext>
        </DndContext>

        {/* Resources */}
        {selectedPlan.resources && selectedPlan.resources.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="widget-glass p-5 rounded-xl"
          >
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Curated Resources
            </h3>
            <div className="grid gap-3">
              {selectedPlan.resources.map((resource, idx) => {
                // Fix broken YouTube channel URLs
                const safeUrl = resource.type === "youtube"
                  ? fixYouTubeUrl(resource.url, resource.title, resource.subject)
                  : resource.url;
                return (
                <a
                  key={idx}
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all group"
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    resource.type === "youtube" ? "bg-red-500/20" : "bg-blue-500/20"
                  )}>
                    {resource.type === "youtube" ? (
                      <Youtube className="w-5 h-5 text-red-400" />
                    ) : (
                      <FileText className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white group-hover:text-primary transition-colors truncate">
                      {resource.title}
                    </p>
                    <p className="text-xs text-white/40">
                      {resource.subject} {resource.duration && `· ${resource.duration}`}
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-white/40 group-hover:text-primary transition-colors" />
                </a>
              );})}
            </div>
          </motion.div>
        )}

        {/* Topic Review Modal */}
        {reviewModalData && (
          <TopicReviewModal
            review={reviewModalData}
            isPro={isPro}
            onClose={() => setReviewModalData(null)}
            onReviewComplete={() => {
              loadDueReviews();
            }}
          />
        )}

        {/* Share Plan with Buddy Dialog */}
        <Dialog open={showSharePlanDialog} onOpenChange={setShowSharePlanDialog}>
          <DialogContent className="sm:max-w-sm bg-zinc-900 border-white/10">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                Share Plan with Buddy
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-white/60 -mt-1">
              Your buddy gets their own copy of this plan and studies at their own pace.
            </p>
            <div className="space-y-2 mt-1">
              {activeBuddyMatchesList.map(({ id: matchId, buddyId, buddy }) => {
                const alreadyShared = sharedWithBuddyIds.has(buddyId);
                const name = buddy.full_name || buddy.username || "Buddy";
                return (
                  <button
                    key={buddyId}
                    disabled={isSharingPlan || alreadyShared}
                    onClick={() => handleSharePlan(matchId, buddyId, name)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border transition-all",
                      alreadyShared
                        ? "border-emerald-500/30 bg-emerald-500/10 cursor-default"
                        : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                    )}
                  >
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
                      {buddy.avatar_url ? (
                        <img src={buddy.avatar_url} alt={name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/40 text-sm font-bold">
                          {name[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-white">{name}</p>
                      {buddy.username && <p className="text-xs text-white/40">@{buddy.username}</p>}
                    </div>
                    {alreadyShared ? (
                      <CheckCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : isSharingPlan ? (
                      <Loader2 className="w-4 h-4 text-white/40 animate-spin flex-shrink-0" />
                    ) : (
                      <UserPlus className="w-4 h-4 text-white/40 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    );
  }

  // Knowledge Graph view
  if (view === "graph" && selectedPlan) {
    return (
      <KnowledgeGraphViewer
        plan={selectedPlan as Parameters<typeof KnowledgeGraphViewer>[0]["plan"]}
        userId={userId}
        isPro={isPro}
        topicReviews={dueReviews as Parameters<typeof KnowledgeGraphViewer>[0]["topicReviews"]}
        onBack={() => setView("detail")}
      />
    );
  }

  // Collab plan modal (guest join via deep-link or host invite from planner)
  if (collabState) {
    return (
      <CollabPlanModal
        sessionId={collabState.sessionId}
        isHost={collabState.isHost}
        userId={userId}
        userFullName={userFullName}
        userAvatarUrl={null}
        buddy={collabState.buddyInfo}
        matchId={collabState.matchId}
        examTypes={examTypes as CollabExamTypeOption[]}
        onClose={() => setCollabState(null)}
        onPlanSaved={(plan) => {
          const savedPlan = plan as unknown as StudyPlan;
          setPlans(prev => [savedPlan, ...prev]);
          setSelectedPlan(savedPlan);
          setView("detail");
          setCollabState(null);
          toast.success("Study plan created! Viewing now.");
        }}
      />
    );
  }

  return null;
}
