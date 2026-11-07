"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  X,
  CheckCircle2,
  Loader2,
  Info,
} from "lucide-react";

interface AnswerUploadProps {
  questionId: number;
  attemptId: number;
  userId: string;
  onUploadComplete: (fileUrl: string) => void;
  existingUrl?: string;
  onShowTips?: () => void;
}

export function AnswerUpload({
  questionId,
  attemptId,
  userId,
  onUploadComplete,
  existingUrl,
  onShowTips,
}: AnswerUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(existingUrl || null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Sync local state with existingUrl prop when it changes (e.g., navigating between questions)
  useEffect(() => {
    setUploadedUrl(existingUrl || null);
  }, [existingUrl, questionId]); // Reset when questionId changes to prevent stale state

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setError("File size must be less than 5MB");
        return;
      }

      // Validate file type
      const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
      if (!allowedTypes.includes(file.type)) {
        setError("Only PDF, JPG, and PNG files are allowed");
        return;
      }

      setIsUploading(true);
      setError(null);

      try {
        // Generate unique file path
        const fileExt = file.name.split(".").pop();
        const filePath = `${userId}/${attemptId}/${crypto.randomUUID()}.${fileExt}`;

        // Upload to Supabase Storage
        const { data, error: uploadError } = await supabase.storage
          .from("answer-uploads")
          .upload(filePath, file, {
            upsert: true,
          });

        if (uploadError) {
          throw uploadError;
        }

        // Get signed URL (24 hour expiry for preview; evaluation uses service_role download)
        const { data: urlData, error: urlError } = await supabase.storage
          .from("answer-uploads")
          .createSignedUrl(filePath, 86400);

        if (urlError || !urlData?.signedUrl) {
          throw new Error("Failed to generate file URL");
        }

        const signedUrl = urlData.signedUrl;

        setUploadedUrl(signedUrl);
        setUploadedFileName(file.name);
        onUploadComplete(signedUrl);
      } catch (err) {
        console.error("Upload error:", err);
        setError("Failed to upload file. Please try again.");
      } finally {
        setIsUploading(false);
      }
    },
    [supabase, userId, attemptId, questionId, onUploadComplete]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  const handleRemove = () => {
    setUploadedUrl(null);
    setUploadedFileName(null);
    onUploadComplete("");
  };

  // Show uploaded state
  if (uploadedUrl) {
    const isPdf = uploadedUrl.endsWith(".pdf");

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-400">Answer uploaded</p>
            <p className="text-xs text-muted-foreground truncate">
              {uploadedFileName || "answer file"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(uploadedUrl, "_blank")}
            >
              {isPdf ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
              <span className="ml-1">View</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={handleRemove}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Preview for images */}
        {!isPdf && (
          <div className="relative rounded-lg overflow-hidden border border-border">
            <img
              src={uploadedUrl}
              alt="Answer preview"
              className="w-full max-h-48 object-contain bg-secondary/50"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50",
          isUploading && "pointer-events-none opacity-60"
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center text-center">
          {isUploading ? (
            <>
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
              <p className="text-sm font-medium">Uploading...</p>
            </>
          ) : (
            <>
              <Upload className="w-10 h-10 text-primary mb-3" />
              <p className="text-sm font-medium mb-1">
                {isDragActive ? "Drop your answer here" : "Upload Your Answer"}
              </p>
              <p className="text-xs text-muted-foreground">
                Drop PDF or image here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Max 5MB - PDF, JPG, PNG only
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {onShowTips && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={onShowTips}
        >
          <Info className="w-4 h-4 mr-2" />
          Tips for Best Results
        </Button>
      )}
    </div>
  );
}
