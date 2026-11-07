"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  XCircle,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronRight,
  Eye,
  RefreshCcw,
} from "lucide-react";
import type { Microtheme } from "@/types/database.types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { replaceUpdatedExam } from "./exam-status";

interface ExamUpload {
  id: string;
  upload_type: "syllabus" | "pyq";
  file_name: string;
  file_url: string;
  parsed_content: string | null;
  year: string | null;
  created_at: string;
}

interface ExamPaper {
  name: string;
  totalQuestions: number;
  totalMarks: number;
  duration: string;
  questionTypes: {
    mcq: { count: number; marksEach: number };
    conventional: { count: number; marksEach: number };
  };
  negativeMarking: boolean;
  negativeMarkingRatio?: number;
}

interface ExamScheme {
  papers: ExamPaper[];
  totalPapers: number;
  examFormat: "mcq_only" | "conventional_only" | "mixed" | "none";
}

interface AdminExam {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  syllabus_content: string | null;
  microthemes: Microtheme[];
  pyq_years: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  admin_exam_uploads?: ExamUpload[];
  exam_scheme?: ExamScheme | null;
  microthemes_source?: "pyq_analysis" | "syllabus_estimation" | "manual" | "unknown";
}

export default function AdminExamsPage() {
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<AdminExam | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusUpdatingExamId, setStatusUpdatingExamId] = useState<string | null>(null);
  const [expandedExam, setExpandedExam] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [pyqYear, setPyqYear] = useState("");

  // Microtheme extraction state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractingFor, setExtractingFor] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  // Fetch exams on mount
  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/exams");
      if (response.ok) {
        const data = await response.json();
        setExams(data.exams || []);
      }
    } catch (error) {
      console.error("Failed to fetch exams:", error);
      toast.error("Failed to load exams");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setEditingExam(null);
  };

  const handleEdit = (exam: AdminExam) => {
    setEditingExam(exam);
    setName(exam.name);
    setDescription(exam.description || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Exam name is required");
      return;
    }

    setIsSaving(true);
    try {
      const method = editingExam ? "PATCH" : "POST";
      const body = editingExam
        ? { id: editingExam.id, name: name.trim(), description: description.trim() }
        : { name: name.trim(), description: description.trim() };

      const response = await fetch("/api/admin/exams", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to save exam");
        return;
      }

      if (editingExam) {
        setExams((prev) =>
          prev.map((e) => (e.id === editingExam.id ? { ...e, ...data.exam } : e))
        );
        toast.success("Exam updated successfully");
      } else {
        setExams((prev) => [data.exam, ...prev]);
        toast.success("Exam created successfully");
      }

      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to save exam");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (examId: string) => {
    if (!confirm("Are you sure you want to deactivate this exam?")) {
      return;
    }

    await handleExamStatusChange(examId, false);
  };

  const handleExamStatusChange = async (examId: string, isActive: boolean) => {
    setStatusUpdatingExamId(examId);

    try {
      const response = await fetch("/api/admin/exams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: examId, is_active: isActive }),
      });

      const data = await response.json();

      if (response.ok) {
        setExams((prev) => replaceUpdatedExam(prev, data.exam));
        toast.success(isActive ? "Exam activated" : "Exam deactivated");
      } else {
        toast.error(data.error || `Failed to ${isActive ? "activate" : "deactivate"} exam`);
      }
    } catch (error) {
      toast.error(`Failed to ${isActive ? "activate" : "deactivate"} exam`);
    } finally {
      setStatusUpdatingExamId(null);
    }
  };

  const handleFileUpload = async (
    examId: string,
    file: File,
    uploadType: "syllabus" | "pyq"
  ) => {
    if (!file.type.includes("pdf")) {
      toast.error("Only PDF files are supported");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setIsUploading(true);
    setUploadingFor(examId);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("examId", examId);
      formData.append("uploadType", uploadType);
      if (uploadType === "pyq" && pyqYear) {
        formData.append("year", pyqYear);
      }

      const response = await fetch("/api/admin/exams/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to upload file");
        return;
      }

      // Refresh exams to get updated uploads
      await fetchExams();
      toast.success(
        data.hasContent
          ? "File uploaded and text extracted"
          : "File uploaded (text extraction pending)"
      );
      setPyqYear("");
    } catch (error) {
      toast.error("Failed to upload file");
    } finally {
      setIsUploading(false);
      setUploadingFor(null);
    }
  };

  const handleDeleteUpload = async (uploadId: string, examId: string) => {
    if (!confirm("Delete this upload?")) return;

    try {
      const response = await fetch(`/api/admin/exams/upload?id=${uploadId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchExams();
        toast.success("Upload deleted");
      } else {
        toast.error("Failed to delete upload");
      }
    } catch (error) {
      toast.error("Failed to delete upload");
    }
  };

  const handleExtractMicrothemes = async (examId: string) => {
    setIsExtracting(true);
    setExtractingFor(examId);

    try {
      const response = await fetch("/api/admin/exams/extract-microthemes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to extract microthemes");
        return;
      }

      // Update local state with new microthemes
      setExams((prev) =>
        prev.map((e) =>
          e.id === examId ? { ...e, microthemes: data.microthemes, microthemes_source: data.source } : e
        )
      );

      toast.success(`Extracted ${data.totalMicrothemes} microthemes`);
    } catch (error) {
      toast.error("Failed to extract microthemes");
    } finally {
      setIsExtracting(false);
      setExtractingFor(null);
    }
  };

  const handleUpdateScheme = async (examId: string, scheme: ExamScheme) => {
    try {
      const response = await fetch("/api/admin/exams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: examId, exam_scheme: scheme }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to save exam scheme");
        return;
      }

      // Update local state
      setExams((prev) =>
        prev.map((e) =>
          e.id === examId ? { ...e, exam_scheme: scheme } : e
        )
      );

      toast.success("Exam scheme saved successfully");
    } catch (error) {
      toast.error("Failed to save exam scheme");
    }
  };

  const activeExams = exams.filter((e) => e.is_active);
  const inactiveExams = exams.filter((e) => !e.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exam Management</h1>
          <p className="text-muted-foreground">
            Manage exam types, syllabi, and microthemes for Study Planner
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Exam
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingExam ? "Edit Exam" : "Add New Exam"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Exam Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Sikkim PSC, UPSC Prelims"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the exam..."
                  rows={3}
                />
              </div>
              <Button
                onClick={handleSave}
                className="w-full"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingExam ? (
                  "Update Exam"
                ) : (
                  "Create Exam"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="glass-card p-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : exams.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No exams yet. Add your first exam to get started.</p>
        </div>
      ) : (
        <>
          {/* Active Exams */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Active Exams ({activeExams.length})
            </h2>

            {activeExams.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                isExpanded={expandedExam === exam.id}
                onToggleExpand={() =>
                  setExpandedExam(expandedExam === exam.id ? null : exam.id)
                }
                onEdit={() => handleEdit(exam)}
                onDelete={() => handleDelete(exam.id)}
                onUpload={(file, type) => handleFileUpload(exam.id, file, type)}
                onDeleteUpload={(uploadId) =>
                  handleDeleteUpload(uploadId, exam.id)
                }
                onExtractMicrothemes={() => handleExtractMicrothemes(exam.id)}
                onUpdateScheme={(scheme) => handleUpdateScheme(exam.id, scheme)}
                isUploading={isUploading && uploadingFor === exam.id}
                isExtracting={isExtracting && extractingFor === exam.id}
                pyqYear={pyqYear}
                setPyqYear={setPyqYear}
                isStatusUpdating={statusUpdatingExamId === exam.id}
              />
            ))}
          </div>

          {/* Inactive Exams */}
          {inactiveExams.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
                <XCircle className="w-5 h-5" />
                Inactive Exams ({inactiveExams.length})
              </h2>

              {inactiveExams.map((exam) => (
                <div
                  key={exam.id}
                  className="glass-card p-4 opacity-60 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-medium">{exam.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {exam.description || "No description"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Inactive</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExamStatusChange(exam.id, true)}
                      disabled={statusUpdatingExamId === exam.id}
                    >
                      {statusUpdatingExamId === exam.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCcw className="w-4 h-4 mr-2" />
                      )}
                      Make Active
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Separate component for exam card to keep code organized
interface ExamCardProps {
  exam: AdminExam;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpload: (file: File, type: "syllabus" | "pyq") => void;
  onDeleteUpload: (uploadId: string) => void;
  onExtractMicrothemes: () => void;
  onUpdateScheme: (scheme: ExamScheme) => void;
  isUploading: boolean;
  isExtracting: boolean;
  isStatusUpdating: boolean;
  pyqYear: string;
  setPyqYear: (year: string) => void;
}

function ExamCard({
  exam,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onUpload,
  onDeleteUpload,
  onExtractMicrothemes,
  onUpdateScheme,
  isUploading,
  isExtracting,
  isStatusUpdating,
  pyqYear,
  setPyqYear,
}: ExamCardProps) {
  const syllabusUploads =
    exam.admin_exam_uploads?.filter((u) => u.upload_type === "syllabus") || [];
  const pyqUploads =
    exam.admin_exam_uploads?.filter((u) => u.upload_type === "pyq") || [];
  const hasSyllabus = syllabusUploads.length > 0 || !!exam.syllabus_content;
  const microthemeCount = exam.microthemes?.length || 0;

  // Exam scheme state
  const [schemeFormat, setSchemeFormat] = useState<"mcq_only" | "conventional_only" | "mixed" | "none">(
    exam.exam_scheme?.examFormat || "mixed"
  );
  const [papers, setPapers] = useState<ExamPaper[]>(
    exam.exam_scheme?.papers || [
      {
        name: "Paper I",
        totalQuestions: 100,
        totalMarks: 200,
        duration: "2 hours",
        questionTypes: { mcq: { count: 100, marksEach: 2 }, conventional: { count: 0, marksEach: 0 } },
        negativeMarking: true,
        negativeMarkingRatio: 0.33,
      },
    ]
  );

  const updatePaper = (index: number, field: string, value: any) => {
    const newPapers = [...papers];
    if (field.includes(".")) {
      const [parent, child, subChild] = field.split(".");
      if (subChild) {
        (newPapers[index] as any)[parent][child][subChild] = value;
      } else {
        (newPapers[index] as any)[parent][child] = value;
      }
    } else {
      (newPapers[index] as any)[field] = value;
    }
    setPapers(newPapers);
  };

  const saveScheme = () => {
    const scheme: ExamScheme = {
      papers: schemeFormat === "none" ? [] : papers,
      totalPapers: schemeFormat === "none" ? 0 : papers.length,
      examFormat: schemeFormat,
    };
    onUpdateScheme(scheme);
  };

  const addPaper = () => {
    setPapers([
      ...papers,
      {
        name: `Paper ${papers.length + 1}`,
        totalQuestions: 100,
        totalMarks: 200,
        duration: "2 hours",
        questionTypes: { mcq: { count: 100, marksEach: 2 }, conventional: { count: 0, marksEach: 0 } },
        negativeMarking: false,
      },
    ]);
  };

  const removePaper = (index: number) => {
    if (papers.length > 1) {
      setPapers(papers.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="glass-card overflow-hidden">
      {/* Header Row */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-secondary/50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{exam.name}</h3>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                Syllabus: {hasSyllabus ? "Uploaded" : "Not uploaded"}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                PYQs: {exam.pyq_years?.length || 0} years
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Microthemes: {microthemeCount}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-destructive"
            disabled={isStatusUpdating}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-6">
          {/* Description */}
          {exam.description && (
            <p className="text-sm text-muted-foreground">{exam.description}</p>
          )}

          {/* Exam Scheme Configuration */}
          <div className="space-y-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Exam Scheme (Question Format)
              </h4>
              <Select value={schemeFormat} onValueChange={(v: "mcq_only" | "conventional_only" | "mixed" | "none") => setSchemeFormat(v)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Syllabus/PYQ Only)</SelectItem>
                  <SelectItem value="mcq_only">MCQ Only</SelectItem>
                  <SelectItem value="conventional_only">Conventional Only</SelectItem>
                  <SelectItem value="mixed">Mixed (Both)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {schemeFormat === "none" ? (
              <div className="p-4 rounded-lg bg-secondary/30 border border-dashed border-border">
                <p className="text-sm text-muted-foreground text-center">
                  No question format specified. Microthemes and study plan will be generated based on syllabus and/or PYQs only.
                </p>
              </div>
            ) : (
              <>
                {papers.map((paper, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-secondary/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <Input
                        value={paper.name}
                        onChange={(e) => updatePaper(idx, "name", e.target.value)}
                        className="w-48 h-8 text-sm font-medium"
                        placeholder="Paper name"
                      />
                      {papers.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removePaper(idx)} className="text-destructive h-8">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {(schemeFormat === "mcq_only" || schemeFormat === "mixed") && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">MCQ Count</Label>
                            <Input
                              type="number"
                              value={paper.questionTypes.mcq.count}
                              onChange={(e) => updatePaper(idx, "questionTypes.mcq.count", parseInt(e.target.value) || 0)}
                              className="h-8"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">MCQ Marks Each</Label>
                            <Input
                              type="number"
                              step="0.5"
                              value={paper.questionTypes.mcq.marksEach}
                              onChange={(e) => updatePaper(idx, "questionTypes.mcq.marksEach", parseFloat(e.target.value) || 0)}
                              className="h-8"
                            />
                          </div>
                        </>
                      )}
                      {(schemeFormat === "conventional_only" || schemeFormat === "mixed") && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">Conventional Count</Label>
                            <Input
                              type="number"
                              value={paper.questionTypes.conventional.count}
                              onChange={(e) => updatePaper(idx, "questionTypes.conventional.count", parseInt(e.target.value) || 0)}
                              className="h-8"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Conv. Marks Each</Label>
                            <Input
                              type="number"
                              step="0.5"
                              value={paper.questionTypes.conventional.marksEach}
                              onChange={(e) => updatePaper(idx, "questionTypes.conventional.marksEach", parseFloat(e.target.value) || 0)}
                              className="h-8"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Total Marks</Label>
                        <Input
                          type="number"
                          value={paper.totalMarks}
                          onChange={(e) => updatePaper(idx, "totalMarks", parseInt(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Duration</Label>
                        <Input
                          value={paper.duration}
                          onChange={(e) => updatePaper(idx, "duration", e.target.value)}
                          className="h-8"
                          placeholder="e.g., 2 hours"
                        />
                      </div>
                      {schemeFormat !== "conventional_only" && (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={paper.negativeMarking}
                            onCheckedChange={(checked) => updatePaper(idx, "negativeMarking", checked)}
                          />
                          <Label className="text-xs">Negative Marking</Label>
                          {paper.negativeMarking && (
                            <Input
                              type="number"
                              step="0.1"
                              value={paper.negativeMarkingRatio || 0.33}
                              onChange={(e) => updatePaper(idx, "negativeMarkingRatio", parseFloat(e.target.value) || 0.33)}
                              className="h-8 w-16"
                              title="Ratio (e.g., 0.33 = 1/3)"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <Button variant="outline" size="sm" onClick={addPaper}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Paper
                </Button>
              </>
            )}

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={saveScheme}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Save Scheme
              </Button>
            </div>

            {exam.exam_scheme && (
              <p className="text-xs text-muted-foreground">
                Current: {exam.exam_scheme.examFormat === "none" ? "No question format" : `${exam.exam_scheme.totalPapers} paper(s), ${exam.exam_scheme.examFormat.replace("_", " ")}`}
              </p>
            )}
          </div>

          {/* Syllabus Upload Section */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Syllabus
            </h4>

            {syllabusUploads.length > 0 ? (
              <div className="space-y-2">
                {syllabusUploads.map((upload) => (
                  <div
                    key={upload.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-green-500" />
                      <span className="text-sm">{upload.file_name}</span>
                      {upload.parsed_content && (
                        <Badge variant="secondary" className="text-xs">
                          Text extracted
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteUpload(upload.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No syllabus uploaded yet
              </p>
            )}

            {/* Upload Syllabus Button */}
            <div className="relative">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file, "syllabus");
                  e.target.value = "";
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isUploading}
              />
              <Button variant="outline" disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Syllabus PDF
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* PYQ Upload Section */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Previous Year Questions
            </h4>

            {pyqUploads.length > 0 ? (
              <div className="space-y-2">
                {pyqUploads.map((upload) => (
                  <div
                    key={upload.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <span className="text-sm">
                        {upload.year || "Year N/A"}: {upload.file_name}
                      </span>
                      {upload.parsed_content && (
                        <Badge variant="secondary" className="text-xs">
                          Text extracted
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteUpload(upload.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No PYQs uploaded yet</p>
            )}

            {/* Upload PYQ with Year */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Year (e.g., 2024)"
                value={pyqYear}
                onChange={(e) => setPyqYear(e.target.value)}
                className="w-32"
              />
              <div className="relative flex-1">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUpload(file, "pyq");
                    e.target.value = "";
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isUploading}
                />
                <Button variant="outline" className="w-full" disabled={isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload PYQ PDF
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Microthemes Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Microthemes ({microthemeCount})
              </h4>
              <Button
                onClick={onExtractMicrothemes}
                disabled={isExtracting || (!hasSyllabus && pyqUploads.length === 0)}
                variant="outline"
                size="sm"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Extract with AI
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload syllabus and PYQs above, then extract microthemes with AI
            </p>

            {microthemeCount > 0 ? (
              <div className="grid gap-2 max-h-64 overflow-y-auto">
                {exam.microthemes.map((theme, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-secondary/50 flex items-start justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{theme.subject}</span>
                        <Badge
                          variant={
                            theme.importance === "high"
                              ? "default"
                              : theme.importance === "medium"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-xs"
                        >
                          {theme.importance}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {theme.topics?.slice(0, 3).join(", ")}
                        {theme.topics?.length > 3 && ` +${theme.topics.length - 3} more`}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      PYQ: {theme.pyqFrequency}x
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No microthemes yet. Upload syllabus/PYQs and click "Extract with AI" to generate.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
