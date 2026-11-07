"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Link, FileText, Youtube, PenLine, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { proxyNotebook } from "@/lib/notebook-proxy";
import { toast } from "sonner";

interface AddSourceModalProps {
  notebookId: string;
  onSourceAdded: () => void;
  isOpen: boolean;
  onClose: () => void;
}

type SourceType = "url" | "pdf" | "youtube" | "text";

const SOURCE_TYPES: { type: SourceType; label: string; icon: typeof Link; description: string }[] = [
  { type: "url", label: "URL", icon: Link, description: "Paste a web URL" },
  { type: "pdf", label: "PDF", icon: FileText, description: "Upload a PDF file" },
  { type: "youtube", label: "YouTube", icon: Youtube, description: "Paste a YouTube URL" },
  { type: "text", label: "Text/Paste", icon: PenLine, description: "Paste text content" },
];

export function AddSourceModal({ notebookId, onSourceAdded, isOpen, onClose }: AddSourceModalProps) {
  const [selectedType, setSelectedType] = useState<SourceType | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedType || !inputValue.trim()) return;
    setIsSubmitting(true);

    try {
      const body: Record<string, string> = {
        action: "add_source",
        notebook_id: notebookId,
        source_type: selectedType,
      };

      if (selectedType === "url" || selectedType === "youtube") {
        body.url = inputValue.trim();
      } else if (selectedType === "text") {
        body.content = inputValue.trim();
      }

      await proxyNotebook(body);
      toast.success("Source added successfully");
      setInputValue("");
      setSelectedType(null);
      onSourceAdded();
      onClose();
    } catch (err) {
      toast.error("Failed to add source");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("action", "add_source");
      formData.append("notebook_id", notebookId);
      formData.append("source_type", selectedType || "pdf");

      await proxyNotebook(formData);
      toast.success("File uploaded successfully");
      setSelectedType(null);
      onSourceAdded();
      onClose();
    } catch (err) {
      toast.error("Failed to upload file");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md mx-4 p-6 rounded-2xl bg-[#0a0a0b] border border-white/10"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Add Source</h3>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-white/40">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!selectedType ? (
              <div className="space-y-2">
                {SOURCE_TYPES.map(({ type, label, icon: Icon, description }) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left"
                  >
                    <Icon className="w-5 h-5 text-white/60" />
                    <div>
                      <p className="text-sm font-medium text-white">{label}</p>
                      <p className="text-xs text-white/40">{description}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={() => setSelectedType(null)}
                  className="text-xs text-white/40 hover:text-white/60 transition-colors"
                >
                  &larr; Back to source types
                </button>

                {(selectedType === "url" || selectedType === "youtube") && (
                  <div className="space-y-3">
                    <Input
                      placeholder={selectedType === "youtube" ? "https://youtube.com/watch?v=..." : "https://example.com/article"}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="bg-white/5 border-white/10 text-white"
                    />
                    <Button
                      onClick={handleSubmit}
                      disabled={!inputValue.trim() || isSubmitting}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Add Source
                    </Button>
                  </div>
                )}

                {selectedType === "pdf" && (
                  <div>
                    <label className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-white/20 hover:border-white/40 transition-all cursor-pointer">
                      <FileText className="w-8 h-8 text-white/30 mb-2" />
                      <span className="text-sm text-white/50">
                        {isSubmitting ? "Uploading..." : "Click to upload PDF"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={isSubmitting}
                      />
                    </label>
                  </div>
                )}

                {selectedType === "text" && (
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Paste your text content here..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      rows={6}
                      className="bg-white/5 border-white/10 text-white resize-none"
                    />
                    <Button
                      onClick={handleSubmit}
                      disabled={!inputValue.trim() || isSubmitting}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Add Source
                    </Button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
