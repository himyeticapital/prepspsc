"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Plus,
  BookOpen,
  Loader2,
  Trash2,
  Edit2,
  Sparkles,
  FolderOpen,
  GraduationCap,
  School,
  Briefcase,
  MoreHorizontal,
  Play,
  Trophy,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ExamEditorModal } from "./exam-editor-modal";

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

interface MyExamsSectionProps {
  onSelectExam?: (examId: string) => void;
}

const categoryIcons = {
  university: GraduationCap,
  school: School,
  competitive: Trophy,
  professional: Briefcase,
  other: FolderOpen,
};

const categoryLabels = {
  university: "University",
  school: "School",
  competitive: "Competitive",
  professional: "Professional",
  other: "Other",
};

export function MyExamsSection({ onSelectExam }: MyExamsSectionProps) {
  const [exams, setExams] = useState<UserCustomExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<UserCustomExam | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState<UserCustomExam | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchExams = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/user-exams");
      if (!res.ok) throw new Error("Failed to fetch exams");
      const data = await res.json();
      setExams(data.exams || []);
    } catch (error) {
      console.error("Error fetching exams:", error);
      toast.error("Failed to load your exams");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const handleCreateNew = () => {
    setEditingExam(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (exam: UserCustomExam) => {
    setEditingExam(exam);
    setIsEditorOpen(true);
  };

  const handleDelete = async () => {
    if (!examToDelete) return;

    try {
      setDeleting(true);
      const res = await fetch(`/api/user-exams?id=${examToDelete.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete exam");

      toast.success("Exam deleted successfully");
      setExams((prev) => prev.filter((e) => e.id !== examToDelete.id));
    } catch (error) {
      console.error("Error deleting exam:", error);
      toast.error("Failed to delete exam");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setExamToDelete(null);
    }
  };

  const handleEditorClose = (refreshList?: boolean) => {
    setIsEditorOpen(false);
    setEditingExam(null);
    if (refreshList) {
      fetchExams();
    }
  };

  const handleGeneratePlan = (examId: string) => {
    if (onSelectExam) {
      onSelectExam(`user:${examId}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-white">My Custom Exams</h3>
          {exams.length > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-white/60">
              {exams.length}
            </span>
          )}
        </div>
        <Button
          onClick={handleCreateNew}
          size="sm"
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Exam
        </Button>
      </div>

      {/* Exams Grid */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-12"
          >
            <Loader2 className="w-6 h-6 animate-spin text-white/40" />
          </motion.div>
        ) : exams.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center py-12 px-4"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-white/30" />
            </div>
            <h4 className="text-white font-medium mb-2">No custom exams yet</h4>
            <p className="text-white/50 text-sm mb-4 max-w-sm mx-auto">
              Create a custom exam by uploading your syllabus or pasting the content.
              Perfect for university exams, school tests, or any niche exam.
            </p>
            <Button onClick={handleCreateNew} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Your First Exam
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {exams.map((exam, index) => {
              const CategoryIcon = categoryIcons[exam.category || "other"];
              const microthemeCount = exam.microthemes?.length || 0;
              const hasContent = !!(exam.syllabus_content || (exam.user_custom_exam_uploads?.length || 0) > 0);

              return (
                <motion.div
                  key={exam.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "group relative p-4 rounded-xl border transition-all",
                    "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                  )}
                >
                  {/* Category Badge */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-primary/20">
                        <CategoryIcon className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-xs text-white/50">
                        {categoryLabels[exam.category || "other"]}
                      </span>
                    </div>

                    {/* Actions Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(exam)}>
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setExamToDelete(exam);
                            setDeleteDialogOpen(true);
                          }}
                          className="text-red-400"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Exam Name */}
                  <h4 className="font-medium text-white mb-1 line-clamp-2">{exam.name}</h4>

                  {/* Description */}
                  {exam.description && (
                    <p className="text-xs text-white/50 mb-3 line-clamp-2">{exam.description}</p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-3 mb-3 text-xs text-white/40">
                    {microthemeCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        {microthemeCount} topics
                      </span>
                    )}
                    {exam.pyq_years && exam.pyq_years.length > 0 && (
                      <span>{exam.pyq_years.length} PYQ years</span>
                    )}
                  </div>

                  {/* Status & Action */}
                  <div className="flex items-center justify-between">
                    {microthemeCount > 0 ? (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <Sparkles className="w-3 h-3" />
                        Ready
                      </span>
                    ) : hasContent ? (
                      <span className="text-xs text-yellow-400">Extract topics to continue</span>
                    ) : (
                      <span className="text-xs text-white/40">Add syllabus to start</span>
                    )}

                    {microthemeCount > 0 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleGeneratePlan(exam.id)}
                      >
                        <Play className="w-3 h-3" />
                        Generate Plan
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* Create New Card */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: exams.length * 0.05 }}
              onClick={handleCreateNew}
              className={cn(
                "flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed transition-all min-h-[160px]",
                "border-white/10 hover:border-primary/50 hover:bg-white/5"
              )}
            >
              <Plus className="w-8 h-8 text-white/30 mb-2" />
              <span className="text-sm text-white/50">Create New Exam</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor Modal */}
      <ExamEditorModal
        open={isEditorOpen}
        onClose={handleEditorClose}
        exam={editingExam}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exam</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{examToDelete?.name}"? This action cannot be undone.
              All uploaded files and extracted microthemes will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
