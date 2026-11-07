"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  X,
  Loader2,
  CheckCircle2,
  Sparkles,
  Users,
  Clock,
  AlertCircle,
  UserX,
} from "lucide-react";
import {
  useCollabPlanChannel,
  type CollabPlanFormParams,
} from "@/hooks/use-collab-plan-channel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExamTypeOption {
  value: string;
  label: string;
  isSeparator?: boolean;
  isUserExam?: boolean;
}

export interface CollabBuddyInfo {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface CollabPlanModalProps {
  sessionId: string;
  isHost: boolean;
  userId: string;
  userFullName: string;
  userAvatarUrl: string | null;
  buddy: CollabBuddyInfo;
  matchId: number;
  examTypes: ExamTypeOption[];
  onClose: () => void;
  onPlanSaved: (plan: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

async function pollJobStatus(jobId: string): Promise<Record<string, unknown>> {
  const maxAttempts = 90;
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`/api/study-ai/generate-plan/status?jobId=${jobId}`);
    const data = await res.json();
    if (data.status === "completed" && data.plan) return data.plan as Record<string, unknown>;
    if (data.status === "failed") throw new Error(data.error || "Plan generation failed");
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Plan generation timed out");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CollabPlanModal({
  sessionId,
  isHost,
  userId,
  userFullName,
  userAvatarUrl,
  buddy,
  matchId,
  examTypes,
  onClose,
  onPlanSaved,
}: CollabPlanModalProps) {
  // Form state (mirrors study-planner-tab fields exactly)
  const [examType, setExamType] = useState("");
  const [durationWeeks, setDurationWeeks] = useState("8");
  const [hoursPerDay, setHoursPerDay] = useState("4");
  const [studySlots, setStudySlots] = useState("2");
  const [focusAreas, setFocusAreas] = useState("");
  const [startWithSubject, setStartWithSubject] = useState("");

  type Phase = "waiting" | "form" | "generating" | "saving" | "done";
  const [phase, setPhase] = useState<Phase>("waiting");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [soloCountdown, setSoloCountdown] = useState(300);
  const [showSoloFallback, setShowSoloFallback] = useState(false);
  const [mounted, setMounted] = useState(false);

  const createdAtRef = useRef(Date.now());

  useEffect(() => {
    setMounted(true);
    // Check session expiry on mount
    fetch(`/api/study-ai/collab-plan?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then(({ session }) => {
        if (session) {
          // Hydrate form from persisted params (for cold guest join)
          const p = session.form_params as Partial<CollabPlanFormParams>;
          if (p.examType) setExamType(p.examType);
          if (p.durationWeeks) setDurationWeeks(p.durationWeeks);
          if (p.hoursPerDay) setHoursPerDay(p.hoursPerDay);
          if (p.studySlots) setStudySlots(p.studySlots);
          if (p.focusAreas) setFocusAreas(p.focusAreas);
          if (p.startWithSubject) setStartWithSubject(p.startWithSubject);

          // Jump to form if session already active
          if (session.status === "active" || session.status === "generating") {
            setPhase("form");
          }
          if (session.status === "generating") {
            // Guest joined mid-generation
            setPhase("generating");
          }
          // Check expiry
          if (new Date(session.expires_at) < new Date()) {
            setShowSoloFallback(true);
          }
        }
      })
      .catch(() => {});
  }, [sessionId]);

  const {
    buddyOnline,
    buddyFormParams,
    buddyLastField,
    buddyReady,
    myReady,
    receivedPlan,
    broadcastFormUpdate,
    broadcastReady,
    broadcastUnready,
    broadcastPlanGenerated,
    broadcastCancelled,
    setMyReady,
  } = useCollabPlanChannel({
    sessionId,
    userId,
    fullName: userFullName,
    avatarUrl: userAvatarUrl,
    enabled: phase !== "done",
  });

  // Move waiting → form when buddy comes online
  useEffect(() => {
    if (phase === "waiting" && buddyOnline) {
      setPhase("form");
      fetch("/api/study-ai/collab-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, status: "active" }),
      });
    }
  }, [buddyOnline, phase, sessionId]);

  // Guest: apply host's form updates to local display
  useEffect(() => {
    if (isHost) return;
    if (buddyFormParams.examType !== undefined) setExamType(buddyFormParams.examType);
    if (buddyFormParams.durationWeeks !== undefined) setDurationWeeks(buddyFormParams.durationWeeks);
    if (buddyFormParams.hoursPerDay !== undefined) setHoursPerDay(buddyFormParams.hoursPerDay);
    if (buddyFormParams.studySlots !== undefined) setStudySlots(buddyFormParams.studySlots);
    if (buddyFormParams.focusAreas !== undefined) setFocusAreas(buddyFormParams.focusAreas);
    if (buddyFormParams.startWithSubject !== undefined) setStartWithSubject(buddyFormParams.startWithSubject);
  }, [buddyFormParams, isHost]);

  // Guest: save plan when received via broadcast
  useEffect(() => {
    if (receivedPlan && !isHost && phase !== "saving" && phase !== "done") {
      handleGuestSavePlan(receivedPlan);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receivedPlan]);

  // Solo fallback countdown (only while in waiting phase)
  useEffect(() => {
    if (phase !== "waiting") return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - createdAtRef.current) / 1000);
      const remaining = 300 - elapsed;
      if (remaining <= 0) {
        setShowSoloFallback(true);
        clearInterval(interval);
      } else {
        setSoloCountdown(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // Elapsed timer during generation
  useEffect(() => {
    if (phase !== "generating") return;
    setElapsedTime(0);
    const interval = setInterval(() => setElapsedTime((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // Host: build full params snapshot and broadcast on any field change
  const handleFieldChange = useCallback(
    (field: keyof CollabPlanFormParams, value: string) => {
      if (!isHost) return;
      const setters: Record<keyof CollabPlanFormParams, (v: string) => void> = {
        examType: setExamType,
        durationWeeks: setDurationWeeks,
        hoursPerDay: setHoursPerDay,
        studySlots: setStudySlots,
        focusAreas: setFocusAreas,
        startWithSubject: setStartWithSubject,
      };
      setters[field]?.(value);

      const snap: CollabPlanFormParams = {
        examType: field === "examType" ? value : examType,
        durationWeeks: field === "durationWeeks" ? value : durationWeeks,
        hoursPerDay: field === "hoursPerDay" ? value : hoursPerDay,
        studySlots: field === "studySlots" ? value : studySlots,
        focusAreas: field === "focusAreas" ? value : focusAreas,
        startWithSubject: field === "startWithSubject" ? value : startWithSubject,
      };
      broadcastFormUpdate(field, value, snap);

      // Persist to DB so late-joiners hydrate from it
      fetch("/api/study-ai/collab-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, formParams: snap }),
      });
    },
    [isHost, examType, durationWeeks, hoursPerDay, studySlots, focusAreas, startWithSubject, broadcastFormUpdate, sessionId]
  );

  // Host: generate plan for both
  const handleHostGenerate = async () => {
    if (!examType || !durationWeeks || !hoursPerDay) {
      toast.error("Fill all required fields first");
      return;
    }
    setPhase("generating");

    await fetch("/api/study-ai/collab-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, status: "generating" }),
    });

    try {
      const res = await fetch("/api/study-ai/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examType,
          durationWeeks: parseInt(durationWeeks),
          hoursPerDay: parseInt(hoursPerDay),
          studySlots: parseInt(studySlots),
          focusAreas: focusAreas ? focusAreas.split(",").map((s) => s.trim()) : [],
          startWithSubject: startWithSubject || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to start plan generation");
      }

      const { jobId } = await res.json();

      // Fire-and-forget edge function (same as solo path)
      fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-study-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      }).catch(console.error);

      const plan = await pollJobStatus(jobId);

      // Record host plan on session and mark completed
      await fetch("/api/study-ai/collab-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          hostPlanId: (plan as any).id,
          status: "completed",
        }),
      });

      // Broadcast plan data to guest
      broadcastPlanGenerated(plan);

      toast.success("Plan generated! Your buddy will receive their copy.");
      setPhase("done");
      onPlanSaved(plan);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      toast.error(msg);
      setPhase("form");
      await fetch("/api/study-ai/collab-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, status: "active" }),
      });
    }
  };

  // Guest: save received plan to own account
  const handleGuestSavePlan = async (plan: Record<string, unknown>) => {
    setPhase("saving");
    try {
      const res = await fetch("/api/study-ai/collab-plan/save-guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save plan");
      toast.success("Study plan saved to your account!");
      setPhase("done");
      onPlanSaved(data.plan);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save plan";
      toast.error(msg);
      setPhase("form");
    }
  };

  const handleCancel = () => {
    broadcastCancelled();
    fetch("/api/study-ai/collab-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, status: "cancelled" }),
    });
    onClose();
  };

  const handleSoloFallback = () => {
    broadcastCancelled();
    fetch("/api/study-ai/collab-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, status: "cancelled" }),
    });
    onClose();
  };

  const buddyName = buddy.full_name || buddy.username || "Your buddy";
  const bothReady = myReady && buddyReady;

  const modalContent = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={phase === "waiting" ? handleCancel : undefined}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">Plan Together</h3>
              <p className="text-xs text-white/40">with {buddyName}</p>
            </div>
          </div>
          {phase !== "generating" && phase !== "saving" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              className="text-white/60 hover:text-white hover:bg-white/10 w-8 h-8"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Buddy presence bar */}
        <div className="flex items-center gap-3 px-5 py-3 bg-white/5 border-b border-white/10">
          <div className="relative">
            <Avatar className="w-8 h-8">
              <AvatarImage src={buddy.avatar_url || ""} />
              <AvatarFallback className="text-xs bg-zinc-800 text-white">
                {getInitials(buddy.full_name || buddy.username)}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-900",
                buddyOnline ? "bg-emerald-500" : "bg-zinc-600"
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{buddyName}</p>
            <p className="text-xs text-white/40">
              {buddyOnline
                ? buddyLastField
                  ? `Editing ${buddyLastField}...`
                  : buddyReady
                  ? "Ready!"
                  : "Online"
                : "Waiting to join..."}
            </p>
          </div>
          {buddyReady && buddyOnline && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" />
              Ready
            </span>
          )}
        </div>

        {/* Body */}
        <div className="p-5">
          {/* WAITING */}
          {phase === "waiting" && (
            <div className="text-center py-8 space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-primary animate-pulse" />
              </div>
              <div>
                <p className="text-white font-medium">Waiting for {buddyName}...</p>
                <p className="text-white/40 text-sm mt-1">
                  They received an invite in their buddy chat
                </p>
              </div>
              {!showSoloFallback && (
                <p className="text-white/30 text-xs">
                  Auto-cancel in {Math.floor(soloCountdown / 60)}:{String(soloCountdown % 60).padStart(2, "0")}
                </p>
              )}
              {showSoloFallback && (
                <div className="space-y-3 pt-2">
                  <p className="text-amber-400 text-sm flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    They haven't joined yet
                  </p>
                  <Button
                    onClick={handleSoloFallback}
                    variant="outline"
                    className="border-white/10 text-white/70 hover:text-white hover:border-white/30"
                  >
                    <UserX className="w-4 h-4 mr-2" />
                    Generate Solo Instead
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* FORM */}
          {phase === "form" && (
            <div className="space-y-4">
              {!isHost && (
                <p className="text-xs text-white/40 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center">
                  {buddyName} is selecting preferences — you can see changes live
                </p>
              )}

              {/* Exam Type */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">
                  Exam Type *
                  {buddyLastField === "examType" && (
                    <span className="ml-2 text-xs text-primary animate-pulse">editing...</span>
                  )}
                </label>
                <Select
                  value={examType}
                  onValueChange={(v) => handleFieldChange("examType", v)}
                  disabled={!isHost}
                >
                  <SelectTrigger
                    className={cn(
                      "bg-white/5 border-white/10 text-white",
                      buddyLastField === "examType" && "border-primary/50 ring-1 ring-primary/20"
                    )}
                  >
                    <SelectValue placeholder="Select exam type" />
                  </SelectTrigger>
                  <SelectContent>
                    {examTypes
                      .filter((e) => !e.isSeparator)
                      .map((exam) => (
                        <SelectItem key={exam.value} value={exam.value}>
                          {exam.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Duration + Hours */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1.5">
                    Weeks *
                  </label>
                  <Input
                    type="number"
                    min={2}
                    max={52}
                    value={durationWeeks}
                    onChange={(e) => handleFieldChange("durationWeeks", e.target.value)}
                    disabled={!isHost}
                    className={cn(
                      "bg-white/5 border-white/10 text-white",
                      buddyLastField === "durationWeeks" && "border-primary/50"
                    )}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1.5">
                    Hours/day *
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={16}
                    value={hoursPerDay}
                    onChange={(e) => handleFieldChange("hoursPerDay", e.target.value)}
                    disabled={!isHost}
                    className={cn(
                      "bg-white/5 border-white/10 text-white",
                      buddyLastField === "hoursPerDay" && "border-primary/50"
                    )}
                  />
                </div>
              </div>

              {/* Study Slots */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">
                  Daily sessions
                </label>
                <Select
                  value={studySlots}
                  onValueChange={(v) => handleFieldChange("studySlots", v)}
                  disabled={!isHost}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 session (full day)</SelectItem>
                    <SelectItem value="2">2 sessions (Morning + Afternoon)</SelectItem>
                    <SelectItem value="3">3 sessions (Morning + Afternoon + Evening)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Focus Areas */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">
                  Focus areas
                  <span className="text-white/30 font-normal ml-1">(optional, comma-separated)</span>
                </label>
                <Input
                  value={focusAreas}
                  onChange={(e) => handleFieldChange("focusAreas", e.target.value)}
                  disabled={!isHost}
                  placeholder="e.g. Polity, History, Economics"
                  className={cn(
                    "bg-white/5 border-white/10 text-white placeholder:text-white/20",
                    buddyLastField === "focusAreas" && "border-primary/50"
                  )}
                />
              </div>

              {/* Ready / Generate */}
              <div className="flex gap-2 pt-2">
                {!bothReady ? (
                  <Button
                    onClick={myReady ? broadcastUnready : broadcastReady}
                    className={cn(
                      "flex-1",
                      myReady
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
                    )}
                  >
                    {myReady ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Ready!
                      </>
                    ) : (
                      "Mark as Ready"
                    )}
                  </Button>
                ) : isHost ? (
                  <Button
                    onClick={handleHostGenerate}
                    disabled={!examType || !durationWeeks || !hoursPerDay}
                    className="flex-1 bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Plan for Both
                  </Button>
                ) : (
                  <p className="flex-1 text-center text-sm text-white/50 py-2 animate-pulse">
                    Waiting for {buddyName} to start generation...
                  </p>
                )}
              </div>

              {bothReady && isHost && (
                <p className="text-center text-xs text-emerald-400">
                  Both ready! Generate your plan above.
                </p>
              )}
            </div>
          )}

          {/* GENERATING */}
          {phase === "generating" && (
            <div className="text-center py-8 space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
              <div>
                <p className="text-white font-medium">
                  {isHost ? "Generating your study plan..." : `${buddyName} is generating the plan...`}
                </p>
                {isHost && (
                  <p className="text-white/40 text-sm mt-1">
                    {Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, "0")} elapsed
                  </p>
                )}
              </div>
              <p className="text-white/30 text-xs">
                Both of you will get a copy when it&apos;s done
              </p>
            </div>
          )}

          {/* SAVING */}
          {phase === "saving" && (
            <div className="text-center py-8 space-y-3">
              <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin" />
              <p className="text-white/70 text-sm">Saving your copy of the plan...</p>
            </div>
          )}

          {/* DONE */}
          {phase === "done" && (
            <div className="text-center py-8 space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-medium">Plan saved to your account!</p>
                <p className="text-white/50 text-sm mt-1">
                  Both you and {buddyName} now have a copy.
                </p>
              </div>
              <Button
                onClick={onClose}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                View My Plan
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
