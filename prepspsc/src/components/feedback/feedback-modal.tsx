"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Upload,
  X,
  Loader2,
  CheckCircle2,
  Bug,
  Monitor,
  Smartphone,
} from "lucide-react";
import type { FeedbackWhenStarted } from "@/types/database.types";

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

interface DeviceInfo {
  userAgent: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
  deviceType: "desktop" | "mobile" | "tablet";
  browser: string;
}

const PAGE_FEATURES = [
  { value: "dashboard", label: "Dashboard" },
  { value: "test-arena", label: "Test Arena" },
  { value: "study-ai", label: "Study with AI" },
  { value: "study-rooms", label: "Study Rooms" },
  { value: "profile", label: "Profile" },
  { value: "leaderboard", label: "Leaderboard" },
  { value: "achievements", label: "Achievements" },
  { value: "pricing", label: "Pricing/Payment" },
  { value: "login-signup", label: "Login/Signup" },
  { value: "other", label: "Other" },
];

const WHEN_STARTED_OPTIONS: { value: FeedbackWhenStarted; label: string }[] = [
  { value: "just_now", label: "Just now (first time)" },
  { value: "after_update", label: "After a recent update" },
  { value: "sometimes", label: "Sometimes (intermittent)" },
  { value: "always", label: "Always happens" },
];

function getDeviceInfo(): DeviceInfo {
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;

  let deviceType: "desktop" | "mobile" | "tablet" = "desktop";
  if (/Mobi|Android/i.test(ua)) {
    deviceType = screenWidth > 768 ? "tablet" : "mobile";
  }

  let browser = "Unknown";
  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Edg")) browser = "Edge";

  return {
    userAgent: ua,
    platform,
    screenWidth,
    screenHeight,
    deviceType,
    browser,
  };
}

export function FeedbackModal({
  open,
  onOpenChange,
  userId,
}: FeedbackModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Form state
  const [description, setDescription] = useState("");
  const [pageFeature, setPageFeature] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [whenStarted, setWhenStarted] = useState<FeedbackWhenStarted | "">("");
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);

  const supabase = createClient();

  // Initialize device info
  useEffect(() => {
    if (open && typeof window !== "undefined") {
      setDeviceInfo(getDeviceInfo());
    }
  }, [open]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setDescription("");
      setPageFeature("");
      setStepsToReproduce("");
      setWhenStarted("");
      setScreenshotUrl(null);
      setScreenshotName(null);
    }
  }, [open]);

  // Screenshot upload handler
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        toast.error("Screenshot must be less than 5MB");
        return;
      }

      setIsUploading(true);

      try {
        const fileExt = file.name.split(".").pop();
        const filePath = `${userId}/${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("feedback-screenshots")
          .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("feedback-screenshots")
          .getPublicUrl(filePath);

        setScreenshotUrl(urlData.publicUrl);
        setScreenshotName(file.name);
        toast.success("Screenshot uploaded");
      } catch (err) {
        console.error("Upload error:", err);
        toast.error("Failed to upload screenshot");
      } finally {
        setIsUploading(false);
      }
    },
    [supabase, userId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] },
    maxFiles: 1,
    disabled: isUploading,
  });

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error("Please describe what happened");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("feedback_reports").insert({
        user_id: userId,
        description: description.trim(),
        page_feature: pageFeature || null,
        steps_to_reproduce: stepsToReproduce.trim() || null,
        when_started: whenStarted || null,
        device_info: deviceInfo || {},
        screenshot_url: screenshotUrl,
      });

      if (error) throw error;

      toast.success(
        "Thank you for reporting this! 🙏 Our team will look into it and fix it ASAP. You're helping make PrepSPSC better!",
        { duration: 5000 }
      );
      onOpenChange(false);
    } catch (err) {
      console.error("Submit error:", err);
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeScreenshot = () => {
    setScreenshotUrl(null);
    setScreenshotName(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="widget-glass border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Bug className="w-5 h-5 text-primary" />
            Report a Bug or Feedback
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Help us improve PrepSPSC by reporting issues or suggestions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* What happened */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-white/70">
              What happened? <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue or feedback in detail..."
              rows={4}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40 resize-none"
            />
          </div>

          {/* Page/Feature */}
          <div className="space-y-2">
            <Label className="text-white/70">Which page or feature?</Label>
            <Select value={pageFeature} onValueChange={setPageFeature}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Select page/feature" />
              </SelectTrigger>
              <SelectContent>
                {PAGE_FEATURES.map((pf) => (
                  <SelectItem key={pf.value} value={pf.value}>
                    {pf.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Steps to reproduce */}
          <div className="space-y-2">
            <Label htmlFor="steps" className="text-white/70">
              Steps to reproduce (optional)
            </Label>
            <Textarea
              id="steps"
              value={stepsToReproduce}
              onChange={(e) => setStepsToReproduce(e.target.value)}
              placeholder={"1. Go to...\n2. Click on...\n3. See the error..."}
              rows={3}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40 resize-none"
            />
          </div>

          {/* When did it start */}
          <div className="space-y-3">
            <Label className="text-white/70">When did this start?</Label>
            <RadioGroup
              value={whenStarted}
              onValueChange={(val) =>
                setWhenStarted(val as FeedbackWhenStarted)
              }
            >
              {WHEN_STARTED_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-center space-x-3">
                  <RadioGroupItem
                    value={opt.value}
                    id={opt.value}
                    className="border-white/30 text-primary"
                  />
                  <Label
                    htmlFor={opt.value}
                    className="text-sm text-white/80 font-normal cursor-pointer"
                  >
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Device info (auto-detected, shown as readonly) */}
          {deviceInfo && (
            <div className="space-y-2">
              <Label className="text-white/70">
                Device info (auto-detected)
              </Label>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white/60">
                <div className="flex items-center gap-2 mb-1">
                  {deviceInfo.deviceType === "mobile" ? (
                    <Smartphone className="w-4 h-4" />
                  ) : (
                    <Monitor className="w-4 h-4" />
                  )}
                  <span className="capitalize">{deviceInfo.deviceType}</span>
                  <span className="text-white/40">|</span>
                  <span>{deviceInfo.browser}</span>
                </div>
                <p className="text-xs text-white/40">
                  {deviceInfo.screenWidth}x{deviceInfo.screenHeight} -{" "}
                  {deviceInfo.platform}
                </p>
              </div>
            </div>
          )}

          {/* Screenshot upload */}
          <div className="space-y-2">
            <Label className="text-white/70">Screenshot (optional)</Label>
            {screenshotUrl ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-400">
                      Screenshot uploaded
                    </p>
                    <p className="text-xs text-white/50 truncate">
                      {screenshotName}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={removeScreenshot}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="relative rounded-lg overflow-hidden border border-white/10">
                  <img
                    src={screenshotUrl}
                    alt="Screenshot preview"
                    className="w-full max-h-40 object-contain bg-black/50"
                  />
                </div>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer",
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-white/20 hover:border-primary/50",
                  isUploading && "pointer-events-none opacity-60"
                )}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center text-center">
                  {isUploading ? (
                    <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                  ) : (
                    <Upload className="w-8 h-8 text-white/40 mb-2" />
                  )}
                  <p className="text-sm text-white/60">
                    {isDragActive ? "Drop here" : "Drag & drop or click"}
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    PNG or JPG, max 5MB
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="flex-1 border-white/10 text-white hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !description.trim()}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Feedback"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
