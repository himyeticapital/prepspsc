"use client";

import { useState, useEffect } from "react";
import { X, Loader2, ChevronLeft, Swords, Check, Zap, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface RoomChallengeProps {
  roomId: number;
  userId: string;
  memberCount: number;
  onClose: () => void;
  onChallengeSent: () => void;
}

interface TestItem {
  id: number;
  title: string;
  description: string | null;
  question_count: number;
}

type Step = "test" | "confirm";

export function RoomChallenge({
  roomId,
  userId,
  memberCount,
  onClose,
  onChallengeSent,
}: RoomChallengeProps) {
  const [step, setStep] = useState<Step>("test");
  const [tests, setTests] = useState<TestItem[]>([]);
  const [selectedTest, setSelectedTest] = useState<TestItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [mode, setMode] = useState<"sync" | "async">("async");
  const [error, setError] = useState<string | null>(null);

  // Fetch active tests with question counts
  useEffect(() => {
    async function fetchTests() {
      setIsLoading(true);
      try {
        const supabase = createClient();

        // Fetch active tests
        const { data: testsData, error: fetchError } = await supabase
          .from("tests")
          .select("id, title, description")
          .eq("is_active", true)
          .order("title", { ascending: true });

        if (fetchError) throw fetchError;

        if (!testsData || testsData.length === 0) {
          setTests([]);
          return;
        }

        // Get question counts for each test
        const testIds = testsData.map((t) => t.id);
        const { data: questionCounts } = await supabase
          .from("questions")
          .select("test_id")
          .in("test_id", testIds);

        // Count questions per test
        const countMap = new Map<number, number>();
        (questionCounts || []).forEach((q) => {
          countMap.set(q.test_id, (countMap.get(q.test_id) || 0) + 1);
        });

        const enrichedTests: TestItem[] = testsData.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          question_count: countMap.get(t.id) || 0,
        }));

        setTests(enrichedTests);
      } catch (err) {
        console.error("Failed to fetch tests:", err);
        setError("Failed to load tests");
      } finally {
        setIsLoading(false);
      }
    }

    fetchTests();
  }, []);

  const handleSelectTest = (test: TestItem) => {
    setSelectedTest(test);
    setStep("confirm");
  };

  const handleSendChallenge = async () => {
    if (!selectedTest) return;
    setIsSending(true);
    setError(null);

    try {
      const res = await fetch("/api/room/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomId, test_id: selectedTest.id, mode }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to send challenge");
      }

      const data = await res.json();
      toast.success(`Challenge sent! ${data.participantCount} members challenged.`);
      onChallengeSent();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send challenge";
      setError(message);
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  const handleBack = () => {
    if (step === "confirm") {
      setStep("test");
      setSelectedTest(null);
      setError(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-zinc-900/95 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            {step === "confirm" && (
              <button
                onClick={handleBack}
                className="text-zinc-400 hover:text-white transition-colors mr-1"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <Swords className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-semibold text-white">
              {step === "test" && "Group Challenge"}
              {step === "confirm" && "Confirm Challenge"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto">
          {/* Test Selection */}
          {step === "test" && (
            <div className="p-3">
              <p className="text-xs text-zinc-500 mb-3 px-1">
                Select a test to challenge all room members
              </p>
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-zinc-500 text-xs">{error}</p>
                </div>
              ) : tests.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-zinc-500 text-xs">No tests available</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {tests.map((test) => (
                    <button
                      key={test.id}
                      onClick={() => handleSelectTest(test)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 border border-white/5 hover:border-white/10 transition-all group"
                    >
                      <div className="text-left flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">
                          {test.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-zinc-500">
                            {test.question_count} questions
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Confirm */}
          {step === "confirm" && selectedTest && (
            <div className="p-4 space-y-4">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto">
                  <Swords className="w-6 h-6 text-orange-400" />
                </div>
                <p className="text-sm text-zinc-300">
                  Challenge <span className="font-semibold text-white">everyone</span> in this room:
                </p>
              </div>

              <div className="bg-zinc-800/60 border border-white/5 rounded-xl p-3">
                <p className="text-sm font-medium text-white">
                  {selectedTest.title}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-zinc-500">
                    {selectedTest.question_count} questions
                  </span>
                </div>
                {selectedTest.description && (
                  <p className="text-[11px] text-zinc-500 mt-2 line-clamp-2">
                    {selectedTest.description}
                  </p>
                )}
              </div>

              {/* Mode Selection */}
              <div className="flex gap-2">
                <button
                  onClick={() => setMode("sync")}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium border transition-all",
                    mode === "sync"
                      ? "bg-orange-500/10 border-orange-500/40 text-orange-400"
                      : "bg-zinc-800/60 border-white/5 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <Zap className="w-4 h-4" />
                  Together (Now)
                </button>
                <button
                  onClick={() => setMode("async")}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium border transition-all",
                    mode === "async"
                      ? "bg-blue-500/10 border-blue-500/40 text-blue-400"
                      : "bg-zinc-800/60 border-white/5 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <Clock className="w-4 h-4" />
                  Own Time
                </button>
              </div>

              {/* Info text */}
              <p className="text-xs text-zinc-500 text-center">
                All {memberCount} room members will be challenged
              </p>

              {error && (
                <p className="text-xs text-red-400 text-center">{error}</p>
              )}

              <button
                onClick={handleSendChallenge}
                disabled={isSending}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all",
                  isSending
                    ? "bg-orange-500/20 text-orange-400/60 cursor-not-allowed"
                    : "bg-orange-500 hover:bg-orange-600 text-white active:scale-[0.98]"
                )}
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Challenge All
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
