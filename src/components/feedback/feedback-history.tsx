"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Bug,
  Plus,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Star,
  Gift,
  ChevronRight,
  ChevronDown,
  MessageCircle,
  Shield,
} from "lucide-react";
import type { FeedbackReport, FeedbackReply, FeedbackStatus } from "@/types/database.types";

interface FeedbackHistoryProps {
  userId: string;
  onReportNew: () => void;
}

interface FeedbackWithReplies extends FeedbackReport {
  replies: FeedbackReply[];
}

const STATUS_CONFIG: Record<
  FeedbackStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  new: {
    label: "New",
    icon: Clock,
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  in_progress: {
    label: "In Progress",
    icon: Loader2,
    className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  resolved: {
    label: "Resolved",
    icon: CheckCircle2,
    className: "bg-green-500/10 text-green-400 border-green-500/20",
  },
  closed: {
    label: "Closed",
    icon: XCircle,
    className: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  },
};

export function FeedbackHistory({ userId, onReportNew }: FeedbackHistoryProps) {
  const [feedbackList, setFeedbackList] = useState<FeedbackWithReplies[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const supabase = createClient();

  useEffect(() => {
    const fetchFeedback = async () => {
      setIsLoading(true);
      try {
        // Fetch feedback reports
        const { data: feedbackData, error: feedbackError } = await supabase
          .from("feedback_reports")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (feedbackError) throw feedbackError;

        const feedbacks = feedbackData || [];

        // Fetch replies for all feedback (only non-internal ones visible to users)
        const feedbackIds = feedbacks.map((f) => f.id);
        let repliesMap: Record<number, FeedbackReply[]> = {};

        if (feedbackIds.length > 0) {
          const { data: repliesData } = await supabase
            .from("feedback_replies")
            .select("*")
            .in("feedback_id", feedbackIds)
            .eq("is_internal", false)
            .order("created_at", { ascending: true });

          if (repliesData) {
            // Group replies by feedback_id
            repliesMap = repliesData.reduce((acc, reply) => {
              if (!acc[reply.feedback_id]) {
                acc[reply.feedback_id] = [];
              }
              acc[reply.feedback_id].push(reply);
              return acc;
            }, {} as Record<number, FeedbackReply[]>);
          }
        }

        // Combine feedback with replies
        const feedbackWithReplies = feedbacks.map((fb) => ({
          ...fb,
          replies: repliesMap[fb.id] || [],
        }));

        setFeedbackList(feedbackWithReplies);

        // Auto-expand items that have replies
        const idsWithReplies = feedbackWithReplies
          .filter((fb) => fb.replies.length > 0)
          .map((fb) => fb.id);
        setExpandedIds(new Set(idsWithReplies));
      } catch (err) {
        console.error("Error fetching feedback:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeedback();
  }, [userId, supabase]);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const verifiedCount = feedbackList.filter((f) => f.is_verified_bug).length;
  const progress = Math.min(verifiedCount, 3);
  const progressPercent = (progress / 3) * 100;
  const hasEarnedReward = verifiedCount >= 3;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="widget-glass rounded-2xl p-6 border border-white/10">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-white/40" />
        </div>
      </div>
    );
  }

  return (
    <div className="widget-glass rounded-2xl p-6 border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Bug className="w-5 h-5 text-primary" />
          My Bug Reports
        </h3>
        <Button
          onClick={onReportNew}
          size="sm"
          className="bg-primary hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-1" />
          Report New
        </Button>
      </div>

      {/* Reward Progress Card */}
      <div className="rounded-xl bg-gradient-to-r from-primary/10 to-yellow-500/10 border border-primary/20 p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white">Report bugs, earn Pro!</p>
            <p className="text-sm text-white/60 mt-0.5">
              3 verified bugs = 1 month FREE Pro
            </p>

            <div className="mt-3">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-white/70">Your progress</span>
                <span className="font-medium text-primary">
                  {progress}/3 verified
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>

            {hasEarnedReward && (
              <div className="mt-3 flex items-center gap-2 text-sm text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Reward unlocked! Contact support to claim your free Pro month.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feedback List */}
      {feedbackList.length === 0 ? (
        <div className="text-center py-8">
          <Bug className="w-10 h-10 mx-auto text-white/20 mb-3" />
          <p className="text-white/60">No bug reports yet</p>
          <p className="text-sm text-white/40 mt-1">
            Found an issue? Report it and help us improve!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedbackList.map((feedback) => {
            const statusConfig = STATUS_CONFIG[feedback.status];
            const StatusIcon = statusConfig.icon;
            const isExpanded = expandedIds.has(feedback.id);
            const hasReplies = feedback.replies.length > 0;

            return (
              <div
                key={feedback.id}
                className="rounded-xl bg-white/5 border border-white/10 overflow-hidden"
              >
                {/* Main content */}
                <div className="p-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white line-clamp-2 text-sm">
                        {feedback.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {/* Status Badge */}
                        <Badge
                          variant="outline"
                          className={statusConfig.className}
                        >
                          <StatusIcon
                            className={`w-3 h-3 mr-1 ${
                              feedback.status === "in_progress"
                                ? "animate-spin"
                                : ""
                            }`}
                          />
                          {statusConfig.label}
                        </Badge>

                        {/* Verified Bug Badge */}
                        {feedback.is_verified_bug && (
                          <Badge
                            variant="outline"
                            className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                          >
                            <Star className="w-3 h-3 mr-1 fill-yellow-400" />
                            Verified Bug
                          </Badge>
                        )}

                        {/* Replies indicator */}
                        {hasReplies && (
                          <Badge
                            variant="outline"
                            className="bg-primary/10 text-primary border-primary/20"
                          >
                            <MessageCircle className="w-3 h-3 mr-1" />
                            {feedback.replies.length} {feedback.replies.length === 1 ? "reply" : "replies"}
                          </Badge>
                        )}

                        {/* Page Feature */}
                        {feedback.page_feature && (
                          <span className="text-xs text-white/40">
                            {feedback.page_feature}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Date */}
                    <div className="text-xs text-white/40 shrink-0">
                      {formatDate(feedback.created_at)}
                    </div>
                  </div>

                  {/* Actions row */}
                  <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-3">
                    {/* Screenshot link */}
                    {feedback.screenshot_url && (
                      <a
                        href={feedback.screenshot_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        View screenshot
                        <ChevronRight className="w-3 h-3" />
                      </a>
                    )}

                    {/* Toggle replies button */}
                    {hasReplies && (
                      <button
                        onClick={() => toggleExpand(feedback.id)}
                        className="text-xs text-white/60 hover:text-white flex items-center gap-1 ml-auto"
                      >
                        {isExpanded ? "Hide" : "Show"} replies
                        <ChevronDown
                          className={`w-3 h-3 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    )}
                  </div>
                </div>

                {/* Replies section */}
                {hasReplies && isExpanded && (
                  <div className="border-t border-white/10 bg-white/[0.02]">
                    <div className="p-4 space-y-3">
                      <p className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                        <Shield className="w-3 h-3" />
                        Admin Responses
                      </p>
                      {feedback.replies.map((reply) => (
                        <div
                          key={reply.id}
                          className="rounded-lg bg-primary/5 border border-primary/10 p-3"
                        >
                          <p className="text-sm text-white whitespace-pre-wrap">
                            {reply.message}
                          </p>
                          <p className="text-xs text-white/40 mt-2">
                            {formatDate(reply.created_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
