"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Camera,
  Upload,
  Loader2,
  X,
  Check,
  Crown,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaperBlurtUploadProps {
  isPro: boolean;
  onTextExtracted: (text: string) => void;
  onProRequired: () => void;
  className?: string;
}

export function PaperBlurtUpload({
  isPro,
  onTextExtracted,
  onProRequired,
  className,
}: PaperBlurtUploadProps) {
  // DEV MODE: Bypass Pro check in development
  const isDev = process.env.NODE_ENV === "development";
  const effectiveIsPro = isPro || isDev;

  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!effectiveIsPro) {
      onProRequired();
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    // Show preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setError(null);
    setIsProcessing(true);

    try {
      // Send to OCR API
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/study-ai/ocr", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to process image");
      }

      onTextExtracted(result.text);
    } catch (err: any) {
      console.error("Paper Blurt error:", err);
      setError(err.message || "Failed to process image. Please try again.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const clearPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setError(null);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        disabled={isProcessing}
      />

      {/* Upload button or preview */}
      {!previewUrl ? (
        <motion.button
          onClick={handleClick}
          disabled={isProcessing}
          className={cn(
            "w-full p-6 rounded-xl border-2 border-dashed transition-all",
            "flex flex-col items-center gap-3",
            effectiveIsPro
              ? "border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-500/5"
              : "border-white/20 opacity-60 cursor-not-allowed"
          )}
          whileHover={effectiveIsPro ? { scale: 1.01 } : undefined}
          whileTap={effectiveIsPro ? { scale: 0.99 } : undefined}
        >
          <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Camera className="w-6 h-6 text-purple-400" />
          </div>
          <div className="text-center">
            <p className="font-medium text-white flex items-center gap-2 justify-center">
              Paper Blurt
              {!effectiveIsPro && <Crown className="w-4 h-4 text-orange-400" />}
            </p>
            <p className="text-sm text-white/50 mt-1">
              {effectiveIsPro
                ? "Take a photo of your handwritten notes"
                : "Pro feature - Upgrade to unlock"}
            </p>
          </div>
        </motion.button>
      ) : (
        <div className="relative">
          {/* Preview image */}
          <div className="relative rounded-xl overflow-hidden">
            <img
              src={previewUrl}
              alt="Handwritten notes"
              className={cn(
                "w-full max-h-64 object-contain bg-black/20",
                isProcessing && "opacity-50"
              )}
            />

            {/* Processing overlay */}
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-white">Reading your handwriting...</p>
                </div>
              </div>
            )}

            {/* Clear button */}
            {!isProcessing && (
              <button
                onClick={clearPreview}
                className="absolute top-2 right-2 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Instructions */}
      {effectiveIsPro && !previewUrl && (
        <div className="text-xs text-white/40 text-center">
          Tips: Use good lighting, keep camera steady, and ensure text is legible
        </div>
      )}
    </div>
  );
}
