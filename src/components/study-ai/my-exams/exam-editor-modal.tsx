"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Upload,
  FileText,
  Sparkles,
  Trash2,
  AlertCircle,
  GraduationCap,
  School,
  Briefcase,
  FolderOpen,
  Trophy,
  X,
  Clock,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { MicrothemeEditor } from "./microtheme-editor";

interface Microtheme {
  subject: string;
  topics: string[];
  subtopics: string[];
  pyqFrequency: number;
  importance: "high" | "medium" | "low";
}

interface UserCustomExam {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category?: "university" | "school" | "competitive" | "professional" | "other";
  syllabus_content?: string;
  microthemes?: Microtheme[];
  exam_scheme?: Record<string, unknown>;
  pyq_years?: string[];
  microthemes_source?: string;
  extraction_count?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_custom_exam_uploads?: Array<{
    id: string;
    upload_type: "syllabus" | "pyq";
    file_name: string;
    year?: string;
  }>;
}

interface ExamEditorModalProps {
  open: boolean;
  onClose: (refreshList?: boolean) => void;
  exam?: UserCustomExam | null;
}

const STEPS = [
  { id: "basic", title: "Basic Info" },
  { id: "syllabus", title: "Syllabus" },
  { id: "pyq", title: "PYQs" },
  { id: "microthemes", title: "Topics" },
];

const CATEGORIES = [
  { value: "university", label: "University/College", icon: GraduationCap },
  { value: "school", label: "School", icon: School },
  { value: "competitive", label: "Competitive Exam", icon: Trophy },
  { value: "professional", label: "Professional/Certification", icon: Briefcase },
  { value: "other", label: "Other", icon: FolderOpen },
];

export function ExamEditorModal({ open, onClose, exam }: ExamEditorModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Form state
  const [examId, setExamId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("other");
  const [syllabusText, setSyllabusText] = useState("");
  const [syllabusInputMode, setSyllabusInputMode] = useState<"upload" | "text">("text");
  const [pyqYear, setPyqYear] = useState("");
  const [uploads, setUploads] = useState<Array<{
    id: string;
    upload_type: "syllabus" | "pyq";
    file_name: string;
    year?: string;
  }>>([]);
  const [microthemes, setMicrothemes] = useState<Microtheme[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Credits
  const [extractionCredits, setExtractionCredits] = useState<{
    remaining: number;
    isPro: boolean;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pyqFileInputRef = useRef<HTMLInputElement>(null);

  // Load exam data when editing
  useEffect(() => {
    if (exam) {
      setExamId(exam.id);
      setName(exam.name);
      setDescription(exam.description || "");
      setCategory(exam.category || "other");
      setSyllabusText(exam.syllabus_content || "");
      setUploads(exam.user_custom_exam_uploads || []);
      setMicrothemes(exam.microthemes || []);
      // If exam has syllabus content but no uploads, assume text mode
      if (exam.syllabus_content && !(exam.user_custom_exam_uploads || []).some(u => u.upload_type === "syllabus")) {
        setSyllabusInputMode("text");
      }
    } else {
      // Reset for new exam
      setExamId(null);
      setName("");
      setDescription("");
      setCategory("other");
      setSyllabusText("");
      setUploads([]);
      setMicrothemes([]);
      setSyllabusInputMode("text");
    }
    setCurrentStep(0);
  }, [exam, open]);

  // Fetch extraction credits
  useEffect(() => {
    async function fetchCredits() {
      try {
        const res = await fetch("/api/user-exams/extract-microthemes");
        if (res.ok) {
          const data = await res.json();
          setExtractionCredits({ remaining: data.remaining, isPro: data.isPro });
        }
      } catch (error) {
        console.error("Failed to fetch credits:", error);
      }
    }
    if (open) {
      fetchCredits();
    }
  }, [open]);

  // Save basic info (create or update)
  const saveBasicInfo = useCallback(async () => {
    if (!name.trim()) {
      toast.error("Please enter an exam name");
      return false;
    }

    setSaving(true);
    try {
      if (examId) {
        // Update existing
        const res = await fetch("/api/user-exams", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: examId, name, description, category }),
        });
        if (!res.ok) throw new Error("Failed to update exam");
      } else {
        // Create new
        const res = await fetch("/api/user-exams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, category }),
        });
        if (!res.ok) throw new Error("Failed to create exam");
        const data = await res.json();
        setExamId(data.exam.id);
      }
      return true;
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save exam");
      return false;
    } finally {
      setSaving(false);
    }
  }, [examId, name, description, category]);

  // Save syllabus text
  const saveSyllabusText = useCallback(async () => {
    if (!examId) return false;
    if (!syllabusText.trim()) {
      // Skip if no text and there's a PDF upload
      const hasSyllabusUpload = uploads.some(u => u.upload_type === "syllabus");
      if (hasSyllabusUpload) return true;
      toast.error("Please add syllabus content");
      return false;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/user-exams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: examId, syllabus_content: syllabusText }),
      });
      if (!res.ok) throw new Error("Failed to save syllabus");
      return true;
    } catch (error) {
      console.error("Save syllabus error:", error);
      toast.error("Failed to save syllabus");
      return false;
    } finally {
      setSaving(false);
    }
  }, [examId, syllabusText, uploads]);

  // Handle file upload (syllabus or PYQ)
  const handleFileUpload = async (
    file: File,
    uploadType: "syllabus" | "pyq",
    year?: string
  ) => {
    if (!examId) {
      toast.error("Please save exam first");
      return;
    }

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("examId", examId);
      formData.append("uploadType", uploadType);
      if (year) formData.append("year", year);

      const res = await fetch("/api/user-exams/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      setUploads((prev) => [...prev, data.upload]);

      if (uploadType === "syllabus" && data.hasContent) {
        // Refresh syllabus content
        const examRes = await fetch("/api/user-exams");
        const examData = await examRes.json();
        const updatedExam = examData.exams.find((e: UserCustomExam) => e.id === examId);
        if (updatedExam?.syllabus_content) {
          setSyllabusText(updatedExam.syllabus_content);
        }
      }

      toast.success(`${uploadType === "syllabus" ? "Syllabus" : "PYQ"} uploaded successfully`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploadingFile(false);
    }
  };

  // Delete upload
  const handleDeleteUpload = async (uploadId: string) => {
    try {
      const res = await fetch(`/api/user-exams/upload?id=${uploadId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setUploads((prev) => prev.filter((u) => u.id !== uploadId));
      toast.success("File deleted");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete file");
    }
  };

  // Extract microthemes
  const handleExtractMicrothemes = async () => {
    if (!examId) return;

    // Check if there's content to analyze
    const hasSyllabus = syllabusText.trim() || uploads.some(u => u.upload_type === "syllabus");
    const hasPYQs = uploads.some(u => u.upload_type === "pyq");

    if (!hasSyllabus && !hasPYQs) {
      toast.error("Please add syllabus or PYQ content first");
      return;
    }

    // Save syllabus text first if needed
    if (syllabusText.trim()) {
      await saveSyllabusText();
    }

    setExtracting(true);
    try {
      const res = await fetch("/api/user-exams/extract-microthemes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Extraction failed");
      }

      setMicrothemes(data.microthemes);
      if (extractionCredits && !extractionCredits.isPro) {
        setExtractionCredits({
          ...extractionCredits,
          remaining: data.remaining,
        });
      }
      toast.success(`Extracted ${data.totalMicrothemes} topics successfully!`);
    } catch (error) {
      console.error("Extraction error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to extract topics");
    } finally {
      setExtracting(false);
    }
  };

  // Save microthemes
  const saveMicrothemes = useCallback(async () => {
    if (!examId) return false;

    setSaving(true);
    try {
      const res = await fetch("/api/user-exams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: examId, microthemes }),
      });
      if (!res.ok) throw new Error("Failed to save topics");
      return true;
    } catch (error) {
      console.error("Save microthemes error:", error);
      toast.error("Failed to save topics");
      return false;
    } finally {
      setSaving(false);
    }
  }, [examId, microthemes]);

  // Navigation handlers
  const handleNext = async () => {
    let canProceed = true;

    if (currentStep === 0) {
      canProceed = await saveBasicInfo();
    } else if (currentStep === 1) {
      canProceed = await saveSyllabusText();
    }
    // PYQ step (2) doesn't require validation

    if (canProceed && currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleFinish = async () => {
    const saved = await saveMicrothemes();
    if (saved) {
      toast.success("Exam saved successfully!");
      onClose(true);
    }
  };

  const hasSyllabusUpload = uploads.some(u => u.upload_type === "syllabus");
  const pyqUploads = uploads.filter(u => u.upload_type === "pyq");

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {exam ? "Edit Custom Exam" : "Create Custom Exam"}
          </DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center gap-1 sm:gap-2 px-2 py-3 border-b border-white/10 overflow-x-auto">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center flex-shrink-0">
              <button
                onClick={() => index <= currentStep && setCurrentStep(index)}
                disabled={index > currentStep}
                className={cn(
                  "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm transition-all whitespace-nowrap",
                  index === currentStep
                    ? "bg-primary text-primary-foreground"
                    : index < currentStep
                    ? "bg-green-500/20 text-green-400"
                    : "bg-white/5 text-white/40"
                )}
              >
                {index < currentStep ? (
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                ) : (
                  <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center text-[10px] sm:text-xs font-medium">
                    {index + 1}
                  </span>
                )}
                <span>{step.title}</span>
              </button>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "w-4 sm:w-8 h-0.5 mx-0.5 sm:mx-1 flex-shrink-0",
                    index < currentStep ? "bg-green-500/50" : "bg-white/10"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto py-4 px-1">
          <AnimatePresence mode="wait">
            {/* Step 1: Basic Info */}
            {currentStep === 0 && (
              <motion.div
                key="basic"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="name">Exam Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., BSc Physics Semester 3, CA Inter Nov 2025"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center gap-2">
                            <cat.icon className="w-4 h-4" />
                            {cat.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the exam..."
                    rows={3}
                  />
                </div>
              </motion.div>
            )}

            {/* Step 2: Syllabus */}
            {currentStep === 1 && (
              <motion.div
                key="syllabus"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="text-sm text-white/60">
                  Add your syllabus content by uploading a PDF or pasting text.
                </p>

                <Tabs value={syllabusInputMode} onValueChange={(v) => setSyllabusInputMode(v as "upload" | "text")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="text" className="gap-2">
                      <FileText className="w-4 h-4" />
                      Paste Text
                    </TabsTrigger>
                    <TabsTrigger value="upload" className="gap-2">
                      <Upload className="w-4 h-4" />
                      Upload PDF
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="text" className="space-y-3">
                    <Textarea
                      value={syllabusText}
                      onChange={(e) => setSyllabusText(e.target.value)}
                      placeholder="Paste your syllabus here...

Example:
Unit 1: Mechanics
- Newton's Laws of Motion
- Work, Energy and Power
- Rotational Motion

Unit 2: Thermodynamics
- Laws of Thermodynamics
- Heat Transfer
- Entropy"
                      rows={12}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-white/40">
                      {syllabusText.length} characters
                    </p>
                  </TabsContent>

                  <TabsContent value="upload" className="space-y-3">
                    {hasSyllabusUpload ? (
                      <div className="space-y-2">
                        {uploads
                          .filter((u) => u.upload_type === "syllabus")
                          .map((upload) => (
                            <div
                              key={upload.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                            >
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-primary" />
                                <span className="text-sm">{upload.file_name}</span>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-400 hover:text-red-300"
                                onClick={() => handleDeleteUpload(upload.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        {syllabusText && (
                          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                            <p className="text-sm text-green-400">
                              ✓ Content extracted ({syllabusText.length} characters)
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "border-2 border-dashed rounded-lg p-8 text-center transition-all",
                          uploadingFile
                            ? "border-primary/50 bg-primary/5"
                            : "border-white/20 hover:border-white/40"
                        )}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, "syllabus");
                            e.target.value = "";
                          }}
                        />
                        {uploadingFile ? (
                          <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-primary" />
                        ) : (
                          <Upload className="w-8 h-8 mx-auto mb-2 text-white/40" />
                        )}
                        <p className="text-white/60 mb-2">
                          {uploadingFile ? "Uploading & extracting text..." : "Drop PDF here or click to upload"}
                        </p>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={uploadingFile}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Select PDF
                        </Button>
                        <p className="text-xs text-white/40 mt-2">Max 10MB, PDF only</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </motion.div>
            )}

            {/* Step 3: PYQs */}
            {currentStep === 2 && (
              <motion.div
                key="pyq"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-white/60 mb-1">
                      Upload previous year question papers (optional but recommended).
                    </p>
                    <p className="text-xs text-white/40">
                      PYQs help identify high-frequency topics for better study planning.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleNext()}
                    className="gap-1"
                  >
                    Skip
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>

                {/* Existing PYQs */}
                {pyqUploads.length > 0 && (
                  <div className="space-y-2">
                    <Label>Uploaded PYQs</Label>
                    {pyqUploads.map((upload) => (
                      <div
                        key={upload.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="text-sm">{upload.file_name}</span>
                          {upload.year && (
                            <span className="px-2 py-0.5 text-xs rounded bg-white/10">
                              {upload.year}
                            </span>
                          )}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-400 hover:text-red-300"
                          onClick={() => handleDeleteUpload(upload.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload new PYQ */}
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={pyqYear}
                      onChange={(e) => setPyqYear(e.target.value)}
                      placeholder="Year (e.g., 2024)"
                      className="w-32"
                    />
                    <input
                      ref={pyqFileInputRef}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, "pyq", pyqYear);
                        e.target.value = "";
                        setPyqYear("");
                      }}
                    />
                    <Button
                      variant="outline"
                      className="gap-2 flex-1"
                      disabled={uploadingFile}
                      onClick={() => pyqFileInputRef.current?.click()}
                    >
                      {uploadingFile ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      Upload PYQ PDF
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Microthemes */}
            {currentStep === 3 && (
              <motion.div
                key="microthemes"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {microthemes.length === 0 ? (
                  <div className="text-center py-8">
                    <Sparkles className="w-12 h-12 mx-auto mb-3 text-white/30" />
                    <h4 className="text-white font-medium mb-2">Extract Topics with AI</h4>
                    <p className="text-sm text-white/60 mb-4 max-w-sm mx-auto">
                      AI will analyze your syllabus and PYQs to identify key topics and their importance.
                    </p>

                    {/* Credits display */}
                    {extractionCredits && (
                      <div className="flex items-center justify-center gap-2 mb-4 text-sm">
                        {extractionCredits.isPro ? (
                          <span className="flex items-center gap-1 text-primary">
                            <Zap className="w-4 h-4" />
                            Unlimited extractions (Pro)
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-white/60">
                            <Clock className="w-4 h-4" />
                            {extractionCredits.remaining} of 3 extractions remaining this month
                          </span>
                        )}
                      </div>
                    )}

                    <Button
                      onClick={handleExtractMicrothemes}
                      disabled={extracting || (extractionCredits?.remaining === 0 && !extractionCredits?.isPro)}
                      className="gap-2"
                    >
                      {extracting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Extracting...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Extract Topics
                        </>
                      )}
                    </Button>

                    {extractionCredits?.remaining === 0 && !extractionCredits?.isPro && (
                      <p className="text-xs text-yellow-400 mt-3">
                        Monthly limit reached. Upgrade to Pro for unlimited extractions.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-white">
                          {microthemes.length} Topics Extracted
                        </h4>
                        <p className="text-xs text-white/50">
                          Click to edit or remove topics
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExtractMicrothemes}
                        disabled={extracting}
                        className="gap-1"
                      >
                        {extracting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        Re-extract
                      </Button>
                    </div>

                    <MicrothemeEditor
                      microthemes={microthemes}
                      onChange={setMicrothemes}
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 0 || saving}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {currentStep < STEPS.length - 1 ? (
            <Button onClick={handleNext} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={saving || microthemes.length === 0}
              className="gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save Exam
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
