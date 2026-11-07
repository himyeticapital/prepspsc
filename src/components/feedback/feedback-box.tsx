"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  Lightbulb,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedbackBoxProps {
  userId: string;
}

const CATEGORIES = [
  { value: "suggestion", label: "Suggestion", icon: Lightbulb },
  { value: "feature-request", label: "Feature Request", icon: Sparkles },
  { value: "other", label: "Other", icon: HelpCircle },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

export function FeedbackBox({ userId }: FeedbackBoxProps) {
  const [feedback, setFeedback] = useState("");
  const [category, setCategory] = useState<Category>("suggestion");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const supabase = createClient();

  const handleSubmit = async () => {
    if (!feedback.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("feedback_reports").insert({
        user_id: userId,
        description: feedback.trim(),
        page_feature: category,
        when_started: "just_now",
        device_info: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
        },
        status: "new",
      });

      if (error) throw error;

      toast.success(
        "Feedback submitted! Thank you for helping improve PrepSPSC."
      );
      setIsSuccess(true);

      setTimeout(() => {
        setIsSuccess(false);
        setFeedback("");
        setCategory("suggestion");
      }, 3000);
    } catch (err) {
      console.error("Feedback submit error:", err);
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="widget-glass p-6 rounded-2xl">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
          <p className="text-lg font-semibold text-white">
            Thanks for your feedback!
          </p>
          <p className="text-sm text-white/50 mt-1">
            We appreciate you helping improve PrepSPSC.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="widget-glass p-6 rounded-2xl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-white">
          Share Your Feedback
        </h3>
      </div>
      <p className="text-sm text-white/50 mb-5">Help us improve PrepSPSC</p>

      {/* Category selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CATEGORIES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setCategory(value)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              category === value
                ? "bg-primary text-primary-foreground"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Textarea */}
      <Textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Tell us what you think..."
        rows={3}
        className="bg-white/5 border-white/10 text-white placeholder:text-white/40 resize-none mb-4"
      />

      {/* Submit button */}
      <Button
        onClick={handleSubmit}
        disabled={!feedback.trim() || isSubmitting}
        className="w-full primary-glow"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            Submit Feedback
          </>
        )}
      </Button>
    </div>
  );
}
