"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { StudyUploadRow } from "@/types/database.types";
import {
  FileText,
  Image as ImageIcon,
  Youtube,
  Loader2,
  Link as LinkIcon,
  X,
  Check,
} from "lucide-react";

interface ContentUploaderProps {
  userId: string;
  goalId: number;
  onUploadComplete: (upload: StudyUploadRow) => void;
  className?: string;
}

type UploadType = "pdf" | "image" | "youtube";

interface UploadOption {
  type: UploadType;
  label: string;
  icon: typeof FileText;
  accept?: string;
  description: string;
}

const UPLOAD_OPTIONS: UploadOption[] = [
  {
    type: "youtube",
    label: "YouTube",
    icon: Youtube,
    description: "Paste YouTube URL",
  },
  {
    type: "image",
    label: "Image",
    icon: ImageIcon,
    accept: "image/png,image/jpeg,image/webp",
    description: "Upload images (PNG, JPG)",
  },
  {
    type: "pdf",
    label: "PDF",
    icon: FileText,
    accept: ".pdf",
    description: "Upload PDF documents",
  },
];

export function ContentUploader({
  userId,
  goalId,
  onUploadComplete,
  className,
}: ContentUploaderProps) {
  const [selectedType, setSelectedType] = useState<UploadType | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTypeSelect = (option: UploadOption) => {
    setSelectedType(option.type);
    setError(null);

    if (option.accept && fileInputRef.current) {
      fileInputRef.current.accept = option.accept;
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedType) return;

    // File size validation (4MB limit for Vercel)
    const MAX_FILE_SIZE_MB = 4;
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(
        `File too large (${fileSizeMB}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB. ` +
        (selectedType === "pdf"
          ? "Try splitting the PDF into smaller sections or upload screenshots instead."
          : "Try compressing the image or using a lower resolution.")
      );
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setIsUploading(true);
    setError(null);

    const supabase = createClient();
    let uploadedFileName: string | null = null; // Track for cleanup on failure

    try {

      // Upload file to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${goalId}/${crypto.randomUUID()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("study-ai-uploads")
        .upload(fileName, file);

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        // If bucket doesn't exist, show helpful message
        if (uploadError.message?.includes("not found") || uploadError.message?.includes("Bucket")) {
          throw new Error("Storage not configured. Please contact support.");
        }
        throw uploadError;
      }

      // Track for cleanup on failure
      uploadedFileName = fileName;

      // Get signed URL (1 hour expiry)
      const { data: urlData, error: urlError } = await supabase.storage
        .from("study-ai-uploads")
        .createSignedUrl(fileName, 3600);

      if (urlError || !urlData?.signedUrl) {
        throw new Error("Failed to generate file URL");
      }

      // Parse content based on type
      let extractedText = "";
      if (selectedType === "pdf" || selectedType === "image") {
        // Call API to extract text
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", selectedType);

        try {
          // Longer timeout for PDFs (includes retry delays) - 2 minutes for PDF, 60s for images
          const timeoutMs = selectedType === "pdf" ? 120000 : 60000;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          const parseResponse = await fetch("/api/study-ai/parse-content", {
            method: "POST",
            body: formData,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (parseResponse.ok) {
            const parseData = await parseResponse.json();
            // Check if extraction was successful
            if (parseData.success === false) {
              // Extraction failed - show specific error based on code
              let errorMessage = parseData.error || "Could not extract text from file";
              if (parseData.code === "RATE_LIMITED") {
                errorMessage = "AI service is busy. Please wait 1-2 minutes and try again.";
              }
              throw new Error(errorMessage);
            }
            extractedText = parseData.text || "";
          } else {
            // Handle HTTP errors with specific messages
            const status = parseResponse.status;
            let errorMessage = "Failed to process file.";

            if (status === 413) {
              errorMessage = "File too large for processing. Try a smaller file or upload screenshots instead.";
            } else if (status === 429) {
              errorMessage = "Too many requests. Please wait a minute and try again.";
            } else if (status === 503) {
              errorMessage = "AI service temporarily unavailable. Please try again later.";
            } else if (status === 504) {
              errorMessage = "Processing timed out. Try uploading a smaller PDF (under 15 pages) or use screenshots instead.";
            } else {
              // Try to get error from response
              try {
                const errorData = await parseResponse.json();
                errorMessage = errorData.error || errorMessage;
              } catch {
                // Use default message
              }
            }

            console.error("Parse response error:", status, errorMessage);
            throw new Error(errorMessage);
          }
        } catch (parseErr: any) {
          if (parseErr.name === "AbortError") {
            console.warn("Text extraction timed out");
            throw new Error("Text extraction timed out. Please try a smaller file.");
          } else {
            // Re-throw the error to show user
            throw parseErr;
          }
        }
      }

      // Save to database
      const { data: dbData, error: dbError } = await supabase
        .from("study_uploads")
        .insert({
          user_id: userId,
          goal_id: goalId,
          upload_type: selectedType,
          file_url: urlData.signedUrl,
          file_name: file.name,
          extracted_text: extractedText,
          metadata: {
            size: file.size,
            type: file.type,
          },
        })
        .select()
        .single();

      if (dbError) throw dbError;

      onUploadComplete(dbData);
      setSelectedType(null);
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to upload file. Please try again.");

      // Clean up storage file if it was uploaded before extraction failed
      if (uploadedFileName) {
        try {
          await supabase.storage.from("study-ai-uploads").remove([uploadedFileName]);
          console.log("Cleaned up orphaned storage file:", uploadedFileName);
        } catch (cleanupErr) {
          console.error("Failed to clean up storage file:", cleanupErr);
        }
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleYoutubeSubmit = async () => {
    if (!youtubeUrl.trim()) return;

    // Validate YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;
    if (!youtubeRegex.test(youtubeUrl)) {
      setError("Please enter a valid YouTube URL");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Extract video ID
      let videoId = "";
      if (youtubeUrl.includes("youtube.com/watch")) {
        const url = new URL(youtubeUrl);
        videoId = url.searchParams.get("v") || "";
      } else if (youtubeUrl.includes("youtu.be/")) {
        videoId = youtubeUrl.split("youtu.be/")[1]?.split("?")[0] || "";
      }

      // Call API to get transcript (add timestamp to prevent caching)
      const parseResponse = await fetch("/api/study-ai/parse-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify({
          type: "youtube",
          url: youtubeUrl,
          videoId,
        }),
      });

      let extractedText = "";
      let videoTitle = youtubeUrl;
      if (parseResponse.ok) {
        const parseData = await parseResponse.json();
        // Include source URL in extracted text for traceability
        const sourceHeader = `[Source: ${youtubeUrl}]\n\n`;
        extractedText = sourceHeader + (parseData.text || "");
        videoTitle = parseData.title || youtubeUrl;

        // Log for debugging
        console.log("[YouTube Upload] Video ID:", parseData.videoId, "Title:", videoTitle);
      }

      // Save to database
      const { data: dbData, error: dbError } = await supabase
        .from("study_uploads")
        .insert({
          user_id: userId,
          goal_id: goalId,
          upload_type: "youtube",
          file_url: youtubeUrl,
          file_name: videoTitle,
          extracted_text: extractedText,
          metadata: {
            videoId,
            url: youtubeUrl,
          },
        })
        .select()
        .single();

      if (dbError) throw dbError;

      onUploadComplete(dbData);
      setYoutubeUrl("");
      setSelectedType(null);
    } catch (err) {
      console.error("YouTube error:", err);
      setError("Failed to add YouTube video. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading}
      />

      {/* Upload type buttons */}
      <div className="grid grid-cols-2 gap-2">
        {UPLOAD_OPTIONS.map((option) => (
          <button
            key={option.type}
            onClick={() => handleTypeSelect(option)}
            disabled={isUploading}
            className={cn(
              "p-3 rounded-xl border transition-all text-left",
              selectedType === option.type
                ? "bg-purple-500/20 border-purple-500/30"
                : "bg-white/5 border-white/10 hover:bg-white/10"
            )}
          >
            <div className="flex items-center gap-2">
              <option.icon
                className={cn(
                  "w-5 h-5",
                  selectedType === option.type ? "text-purple-400" : "text-white/60"
                )}
              />
              <span
                className={cn(
                  "text-sm font-medium",
                  selectedType === option.type ? "text-purple-400" : "text-white"
                )}
              >
                {option.label}
              </span>
            </div>
            <p className="text-xs text-white/40 mt-1">{option.description}</p>
          </button>
        ))}
      </div>

      {/* YouTube URL input */}
      {selectedType === "youtube" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                placeholder="Paste YouTube URL..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                disabled={isUploading}
              />
            </div>
            <Button
              onClick={handleYoutubeSubmit}
              disabled={!youtubeUrl.trim() || isUploading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedType(null);
                setYoutubeUrl("");
              }}
              disabled={isUploading}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isUploading && selectedType !== "youtube" && (
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>
            {selectedType === "pdf"
              ? "Extracting text from PDF... This may take up to 2 minutes for large files."
              : "Processing file..."}
          </span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
