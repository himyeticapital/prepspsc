"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GripVertical, Loader2, Upload, Download, FileSpreadsheet, FileText, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Test, Question, QuestionOption, TestSection } from "@/types/database.types";
import {
  parseCSV,
  parseExcel,
  exportToCSV,
  generateCSVTemplate,
  generateExcelTemplate,
  downloadFile,
  type ParsedQuestion,
} from "@/lib/csv-utils";

function QuestionsContent() {
  const searchParams = useSearchParams();
  const initialTestId = searchParams.get("test_id");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [sections, setSections] = useState<TestSection[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>(initialTestId || "");
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [content, setContent] = useState("");
  const [type, setType] = useState<"mcq" | "conventional">("mcq");
  const [options, setOptions] = useState<QuestionOption[]>([
    { id: "a", text: "" },
    { id: "b", text: "" },
    { id: "c", text: "" },
    { id: "d", text: "" },
  ]);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [marks, setMarks] = useState("1");
  const [negativeMarks, setNegativeMarks] = useState("0");
  const [sectionId, setSectionId] = useState<string>("");
  const [wordLimit, setWordLimit] = useState("");

  // Section form state
  const [newSectionName, setNewSectionName] = useState("");

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // AI explanation generation state
  const [isGeneratingExplanations, setIsGeneratingExplanations] = useState(false);
  const [explanationProgress, setExplanationProgress] = useState({ done: 0, total: 0 });

  const supabase = useMemo(() => createClient(), []);

  // Fetch tests
  useEffect(() => {
    let isCancelled = false;
    let retryCount = 0;
    const maxRetries = 3;

    const fetchTests = async () => {
      console.log("[Questions] Fetching tests...");
      try {
        // Only fetch active tests (not archived)
        const { data, error } = await supabase
          .from("tests")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (isCancelled) return;

        if (error) {
          if (error.message?.includes("aborted") || error.message?.includes("AbortError")) {
            // Retry on abort error
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`[Questions] Tests fetch aborted, retry ${retryCount}/${maxRetries}...`);
              setTimeout(fetchTests, 300);
              return;
            }
            console.log("[Questions] Tests fetch aborted after max retries");
            return;
          }
          console.error("[Questions] Failed to fetch tests:", error.message);
          return;
        }

        console.log("[Questions] Tests fetched:", data?.length || 0, "tests");
        if (data) setTests(data);
      } catch (err: any) {
        if (isCancelled) return;
        if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
          // Retry on abort error
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`[Questions] Tests fetch error aborted, retry ${retryCount}/${maxRetries}...`);
            setTimeout(fetchTests, 300);
            return;
          }
          return;
        }
        console.error("[Questions] Error fetching tests:", err);
      }
    };

    fetchTests();

    return () => {
      isCancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch questions and sections when test changes
  useEffect(() => {
    let isCancelled = false;

    const fetchQuestionsAndSections = async () => {
      if (!selectedTestId) {
        setQuestions([]);
        setSections([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const [questionsResult, sectionsResult] = await Promise.all([
          supabase
            .from("questions")
            .select("*")
            .eq("test_id", parseInt(selectedTestId))
            .order("sort_order"),
          supabase
            .from("test_sections")
            .select("*")
            .eq("test_id", parseInt(selectedTestId))
            .order("sort_order"),
        ]);

        if (isCancelled) return;

        if (questionsResult.error) {
          if (!questionsResult.error.message?.includes("aborted") && !questionsResult.error.message?.includes("AbortError")) {
            console.error("Failed to fetch questions:", questionsResult.error.message);
          }
        }

        if (sectionsResult.error) {
          if (!sectionsResult.error.message?.includes("aborted") && !sectionsResult.error.message?.includes("AbortError")) {
            console.error("Failed to fetch sections:", sectionsResult.error.message);
          }
        }

        if (questionsResult.data) setQuestions(questionsResult.data);
        if (sectionsResult.data) setSections(sectionsResult.data);
      } catch (err: any) {
        if (isCancelled) return;
        if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
          return;
        }
        console.error("Error fetching questions:", err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchQuestionsAndSections();

    return () => {
      isCancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTestId]);

  // Reset form
  const resetForm = () => {
    setContent("");
    setType("mcq");
    setOptions([
      { id: "a", text: "" },
      { id: "b", text: "" },
      { id: "c", text: "" },
      { id: "d", text: "" },
    ]);
    setCorrectAnswer("");
    setMarks("1");
    setNegativeMarks("0");
    setSectionId("");
    setWordLimit("");
    setEditingQuestion(null);
  };

  // Handle file import
  const handleImport = async (file: File) => {
    if (!selectedTestId) {
      toast.error("Please select a test first");
      return;
    }

    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    const isCSV = file.name.endsWith(".csv");

    if (!isExcel && !isCSV) {
      toast.error("Please upload a CSV or Excel file");
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      const result = isExcel ? await parseExcel(file) : await parseCSV(file);

      if (result.questions.length === 0) {
        toast.error("No valid questions found in file");
        if (result.errors.length > 0) {
          console.error("Import errors:", result.errors);
          toast.error(`Errors: ${result.errors.map(e => `Row ${e.row}: ${e.message}`).join(", ")}`);
        }
        setIsImporting(false);
        return;
      }

      if (result.questions.length > 100) {
        toast.error("Maximum 100 questions allowed per import");
        setIsImporting(false);
        return;
      }

      // Find or create sections
      const sectionMap: Record<string, number> = {};
      for (const section of sections) {
        sectionMap[section.name.toLowerCase()] = section.id;
      }

      // Create new sections if needed
      const newSections = new Set<string>();
      for (const q of result.questions) {
        if (q.section && !sectionMap[q.section.toLowerCase()]) {
          newSections.add(q.section);
        }
      }

      for (const sectionName of newSections) {
        const { data } = await supabase
          .from("test_sections")
          .insert({
            test_id: parseInt(selectedTestId),
            name: sectionName,
            sort_order: sections.length + Object.keys(sectionMap).length,
          })
          .select()
          .single();

        if (data) {
          sectionMap[sectionName.toLowerCase()] = data.id;
          setSections(prev => [...prev, data]);
        }
      }

      // Insert questions
      const questionsToInsert = result.questions.map((q, index) => ({
        test_id: parseInt(selectedTestId),
        content: q.content,
        type: q.type,
        options: q.options,
        correct_answer: q.correct_answer,
        marks: q.marks,
        negative_marks: q.negative_marks,
        sort_order: questions.length + index,
        section_id: q.section ? sectionMap[q.section.toLowerCase()] || null : null,
        word_limit: q.type === "conventional" ? 250 : null, // Default word limit
        explanation: null, // AI will generate
        model_answer: null, // AI will evaluate without it
      }));

      // Insert in batches of 10
      const batchSize = 10;
      const insertedQuestions: Question[] = [];

      for (let i = 0; i < questionsToInsert.length; i += batchSize) {
        const batch = questionsToInsert.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from("questions")
          .insert(batch)
          .select();

        if (error) {
          console.error("Insert error:", error);
          toast.error(`Failed to insert questions: ${error.message}`);
          break;
        }

        if (data) {
          insertedQuestions.push(...data);
        }

        setImportProgress(Math.round(((i + batch.length) / questionsToInsert.length) * 100));
      }

      setQuestions(prev => [...prev, ...insertedQuestions]);

      // Show result
      if (result.errors.length > 0) {
        toast.warning(`Imported ${insertedQuestions.length} questions. ${result.errors.length} rows had errors.`);
        console.error("Import errors:", result.errors);
      } else {
        toast.success(`Successfully imported ${insertedQuestions.length} questions!`);
      }

      // Auto-generate AI explanations for imported MCQ questions (non-blocking)
      const mcqIds = insertedQuestions
        .filter((q) => q.type === "mcq" && q.correct_answer)
        .map((q) => q.id);

      if (mcqIds.length > 0) {
        toast.info(`Generating AI explanations for ${mcqIds.length} MCQs in background...`);
        fetch("/api/admin/generate-mcq-explanation", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionIds: mcqIds }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              toast.success(`AI explanations generated: ${data.successCount}/${data.total}`);
            }
          })
          .catch((err) => {
            console.error("Background explanation generation failed:", err);
          });
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import questions");
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  // Handle export
  const handleExport = () => {
    if (questions.length === 0) {
      toast.error("No questions to export");
      return;
    }

    const parsed: ParsedQuestion[] = questions.map(q => ({
      type: q.type as "mcq" | "conventional",
      content: q.content,
      options: q.options as { id: string; text: string }[] | null,
      correct_answer: q.correct_answer,
      marks: q.marks,
      negative_marks: q.negative_marks,
      section: sections.find(s => s.id === q.section_id)?.name || null,
    }));

    const csv = exportToCSV(parsed);
    const testName = tests.find(t => t.id.toString() === selectedTestId)?.title || "questions";
    downloadFile(csv, `${testName.replace(/\s+/g, "_")}_questions.csv`, "text/csv");
    toast.success("Questions exported successfully");
  };

  // Download template
  const handleDownloadTemplate = async (format: "csv" | "excel") => {
    if (format === "csv") {
      const csv = generateCSVTemplate();
      downloadFile(csv, "questions_template.csv", "text/csv");
    } else {
      const excel = await generateExcelTemplate();
      downloadFile(excel, "questions_template.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    }
    toast.success(`${format.toUpperCase()} template downloaded`);
  };

  // Add section
  const handleAddSection = async () => {
    if (!newSectionName.trim() || !selectedTestId) {
      toast.error("Section name is required");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("test_sections")
        .insert({
          test_id: parseInt(selectedTestId),
          name: newSectionName.trim(),
          sort_order: sections.length,
        })
        .select()
        .single();

      if (error) {
        if (error.message?.includes("aborted") || error.message?.includes("AbortError")) {
          return;
        }
        toast.error("Failed to create section: " + error.message);
        return;
      }

      setSections((prev) => [...prev, data]);
      setNewSectionName("");
      setSectionDialogOpen(false);
      toast.success("Section added successfully");
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
        return;
      }
      toast.error("Failed to create section");
    }
  };

  // Open edit dialog
  const handleEdit = (question: Question) => {
    setEditingQuestion(question);
    setContent(question.content);
    setType(question.type as "mcq" | "conventional");
    if (question.type === "mcq" && question.options) {
      setOptions(question.options as QuestionOption[]);
    }
    setCorrectAnswer(question.correct_answer || "");
    setMarks(question.marks.toString());
    setNegativeMarks(question.negative_marks.toString());
    setSectionId(question.section_id?.toString() || "");
    setWordLimit(question.word_limit?.toString() || "");
    setDialogOpen(true);
  };

  // Save question
  const handleSave = async () => {
    console.log("handleSave called");

    if (!content.trim()) {
      toast.error("Question content is required");
      return;
    }

    if (!selectedTestId) {
      toast.error("Please select a test first");
      return;
    }

    if (type === "mcq") {
      const filledOptions = options.filter((o) => o.text.trim());
      if (filledOptions.length < 2) {
        toast.error("At least 2 options are required for MCQ");
        return;
      }
      if (!correctAnswer) {
        toast.error("Please select the correct answer");
        return;
      }
    }

    const questionData = {
      test_id: parseInt(selectedTestId),
      content: content.trim(),
      type,
      options: type === "mcq" ? options.filter((o) => o.text.trim()) : null,
      correct_answer: type === "mcq" ? correctAnswer : null,
      marks: parseInt(marks),
      negative_marks: parseFloat(negativeMarks),
      explanation: null, // AI will generate this
      sort_order: editingQuestion?.sort_order || questions.length,
      section_id: sectionId ? parseInt(sectionId) : null,
      word_limit: type === "conventional" && wordLimit ? parseInt(wordLimit) : null,
      model_answer: null, // AI evaluates without model answer
    };

    console.log("Question data:", questionData);
    setIsSaving(true);

    try {
      if (editingQuestion) {
        console.log("Updating question:", editingQuestion.id);
        const { error } = await supabase
          .from("questions")
          .update(questionData)
          .eq("id", editingQuestion.id);

        if (error) {
          console.error("Update error:", error);
          if (error.message?.includes("aborted") || error.message?.includes("AbortError")) {
            return;
          }
          toast.error("Failed to update question: " + error.message);
          return;
        }

        setQuestions((prev) =>
          prev.map((q) =>
            q.id === editingQuestion.id ? { ...q, ...questionData } : q
          )
        );
        toast.success("Question updated successfully");
      } else {
        console.log("Inserting new question with data:", JSON.stringify(questionData));

        const { data, error } = await supabase
          .from("questions")
          .insert(questionData)
          .select()
          .single();

        console.log("Insert result:", { data, error });

        if (error) {
          console.error("Insert error:", error);
          if (error.message?.includes("aborted") || error.message?.includes("AbortError")) {
            return;
          }
          toast.error("Failed to create question: " + error.message);
          return;
        }

        setQuestions((prev) => [...prev, data]);
        toast.success("Question added successfully");

        // Auto-generate AI explanation for new MCQ question (non-blocking)
        if (data.type === "mcq" && data.correct_answer) {
          fetch("/api/admin/generate-mcq-explanation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId: data.id }),
          }).catch((err) => {
            console.error("Background explanation generation failed:", err);
          });
        }
      }

      setDialogOpen(false);
      resetForm();
    } catch (err: any) {
      console.error("Caught error:", err);
      if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
        return;
      }
      toast.error("An error occurred while saving");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete question - uses API endpoint to bypass RLS
  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this question? This will also delete all related user answers.")) {
      return;
    }

    try {
      const response = await fetch("/api/admin/delete-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: [id] }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error("Failed to delete question: " + (result.error || "Unknown error"));
        return;
      }

      setQuestions((prev) => prev.filter((q) => q.id !== id));
      toast.success("Question deleted successfully");
    } catch (err: unknown) {
      const error = err as Error;
      if (error?.name === "AbortError" || error?.message?.includes("aborted")) {
        return;
      }
      console.error("Delete error:", err);
      toast.error("Failed to delete question");
    }
  };

  // Delete all questions for current test - uses API endpoint to bypass RLS
  const handleDeleteAllQuestions = async () => {
    if (!selectedTestId || questions.length === 0) {
      return;
    }

    if (!confirm(`Are you sure you want to delete ALL ${questions.length} questions from this test? This will also delete all related user answers and cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch("/api/admin/delete-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: parseInt(selectedTestId),
          deleteAll: true,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error("Failed to delete questions: " + (result.error || "Unknown error"));
        return;
      }

      setQuestions([]);
      toast.success(`All ${result.deleted} questions deleted successfully`);
    } catch (err) {
      console.error("Delete all error:", err);
      toast.error("Failed to delete questions");
    }
  };

  // Generate AI explanations for all MCQ questions in current test
  const handleGenerateExplanations = async () => {
    const mcqIds = questions
      .filter((q) => q.type === "mcq" && q.correct_answer)
      .map((q) => q.id);

    if (mcqIds.length === 0) {
      toast.error("No MCQ questions found to generate explanations for");
      return;
    }

    setIsGeneratingExplanations(true);
    setExplanationProgress({ done: 0, total: mcqIds.length });

    let done = 0;
    let failed = 0;

    // Process in client-side batches of 5 with live progress
    const BATCH = 5;
    for (let i = 0; i < mcqIds.length; i += BATCH) {
      const batch = mcqIds.slice(i, i + BATCH);

      const results = await Promise.allSettled(
        batch.map((id) =>
          fetch("/api/admin/generate-mcq-explanation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId: id }),
          }).then((r) => r.json())
        )
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value.success) done++;
        else failed++;
      }
      setExplanationProgress({ done: done + failed, total: mcqIds.length });
    }

    toast.success(`AI explanations: ${done} generated, ${failed} failed out of ${mcqIds.length}`);
    setIsGeneratingExplanations(false);
    setExplanationProgress({ done: 0, total: 0 });
  };

  // Update option text
  const updateOption = (index: number, text: string) => {
    setOptions((prev) =>
      prev.map((opt, i) => (i === index ? { ...opt, text } : opt))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Questions</h1>
          <p className="text-muted-foreground">Manage test questions</p>
        </div>

        <div className="flex items-center gap-4">
          <Select value={selectedTestId} onValueChange={setSelectedTestId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a test" />
            </SelectTrigger>
            <SelectContent>
              {tests.map((test) => (
                <SelectItem key={test.id} value={test.id.toString()}>
                  {test.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Download Template */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Template
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleDownloadTemplate("csv")}>
                <FileText className="w-4 h-4 mr-2" />
                Download CSV Template
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadTemplate("excel")}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Download Excel Template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Import Questions */}
          <div className="relative">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
                e.target.value = "";
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={!selectedTestId || isImporting}
            />
            <Button variant="outline" disabled={!selectedTestId || isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {importProgress}%
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                </>
              )}
            </Button>
          </div>

          {/* Export Questions */}
          <Button variant="outline" onClick={handleExport} disabled={!selectedTestId || questions.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>

          {/* Generate AI Explanations */}
          <Button
            variant="outline"
            onClick={handleGenerateExplanations}
            disabled={!selectedTestId || questions.length === 0 || isGeneratingExplanations}
          >
            {isGeneratingExplanations ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {explanationProgress.done}/{explanationProgress.total}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                AI Explain
              </>
            )}
          </Button>

          {/* Delete All Questions */}
          <Button
            variant="outline"
            onClick={handleDeleteAllQuestions}
            disabled={!selectedTestId || questions.length === 0}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete All
          </Button>

          {/* Add Section Dialog */}
          <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!selectedTestId}>
                <Plus className="w-4 h-4 mr-2" />
                Section
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Section</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sectionName">Section Name</Label>
                  <Input
                    id="sectionName"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="e.g., Indian History, Polity, Geography"
                  />
                </div>
                {sections.length > 0 && (
                  <div className="space-y-2">
                    <Label>Existing Sections</Label>
                    <div className="flex flex-wrap gap-2">
                      {sections.map((section) => (
                        <Badge key={section.id} variant="secondary">
                          {section.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <Button onClick={handleAddSection} className="w-full">
                  Add Section
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} disabled={!selectedTestId}>
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingQuestion ? "Edit Question" : "Add New Question"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="content">Question *</Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Enter the question"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={type} onValueChange={(v) => setType(v as "mcq" | "conventional")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mcq">Multiple Choice (MCQ)</SelectItem>
                        <SelectItem value="conventional">Conventional (Essay)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Section (for analytics)</Label>
                    <Select value={sectionId || "none"} onValueChange={(v) => setSectionId(v === "none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No section</SelectItem>
                        {sections.map((section) => (
                          <SelectItem key={section.id} value={section.id.toString()}>
                            {section.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {type === "mcq" && (
                  <div className="space-y-3">
                    <Label>Options</Label>
                    {options.map((option, index) => (
                      <div key={option.id} className="flex items-center gap-2">
                        <span className="w-6 text-muted-foreground font-medium">
                          {option.id.toUpperCase()}.
                        </span>
                        <Input
                          value={option.text}
                          onChange={(e) => updateOption(index, e.target.value)}
                          placeholder={`Option ${option.id.toUpperCase()}`}
                          className="flex-1"
                        />
                        <input
                          type="radio"
                          name="correct"
                          checked={correctAnswer === option.id}
                          onChange={() => setCorrectAnswer(option.id)}
                          className="w-4 h-4"
                        />
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      Select the radio button next to the correct answer
                    </p>
                  </div>
                )}

                {type === "conventional" && (
                  <div className="space-y-4 p-4 border border-dashed rounded-lg bg-secondary/20">
                    <p className="text-sm font-medium text-muted-foreground">
                      Conventional Question Settings
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="wordLimit">Word Limit</Label>
                      <Input
                        id="wordLimit"
                        type="number"
                        value={wordLimit}
                        onChange={(e) => setWordLimit(e.target.value)}
                        placeholder="e.g., 250"
                      />
                      <p className="text-xs text-muted-foreground">
                        Expected answer length in words
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-xs text-primary">
                        <strong>AI-Powered Evaluation:</strong> The AI will automatically analyze the question and evaluate student answers without needing a model answer.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="marks">Marks</Label>
                    <Input
                      id="marks"
                      type="number"
                      value={marks}
                      onChange={(e) => setMarks(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="negativeMarks">Negative Marks</Label>
                    <Input
                      id="negativeMarks"
                      type="number"
                      step="0.25"
                      value={negativeMarks}
                      onChange={(e) => setNegativeMarks(e.target.value)}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-blue-400">
                    <strong>AI Explanation:</strong> The explanation for this question will be automatically generated by AI after saving.
                  </p>
                </div>

                <Button onClick={handleSave} className="w-full" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {editingQuestion ? "Updating..." : "Adding..."}
                    </>
                  ) : (
                    editingQuestion ? "Update Question" : "Add Question"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Questions List */}
      {!selectedTestId ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          Select a test to view and manage its questions
        </div>
      ) : isLoading ? (
        <div className="glass-card p-12 text-center">Loading...</div>
      ) : questions.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          No questions yet. Add your first question!
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((question, index) => (
            <div
              key={question.id}
              className="glass-card p-4 flex items-start gap-4"
            >
              <div className="text-muted-foreground">
                <GripVertical className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Q{index + 1}
                  </span>
                  <Badge variant="secondary">
                    {question.type === "mcq" ? "MCQ" : "Conventional"}
                  </Badge>
                  <Badge variant="outline">{question.marks} marks</Badge>
                  {question.section_id && (
                    <Badge variant="default" className="bg-primary/20 text-primary">
                      {sections.find((s) => s.id === question.section_id)?.name || "Section"}
                    </Badge>
                  )}
                  {question.type === "conventional" && question.word_limit && (
                    <Badge variant="outline" className="text-muted-foreground">
                      {question.word_limit} words
                    </Badge>
                  )}
                </div>
                <p className="line-clamp-2">{question.content}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(question)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(question.id)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionsLoadingFallback() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Questions</h1>
          <p className="text-muted-foreground">Manage test questions</p>
        </div>
      </div>
      <div className="glass-card p-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    </div>
  );
}

export default function AdminQuestionsPage() {
  return (
    <Suspense fallback={<QuestionsLoadingFallback />}>
      <QuestionsContent />
    </Suspense>
  );
}
