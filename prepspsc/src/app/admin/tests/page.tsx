"use client";

import { useState, useEffect, useMemo } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Archive, ArchiveRestore, FileQuestion, Tag, Settings, X } from "lucide-react";
import type { Test, ExamCategory, TestType, TestDifficulty } from "@/types/database.types";
import { notificationHelpers } from "@/stores/notification-store";

export default function AdminTestsPage() {
  const [tests, setTests] = useState<(Test & { category?: ExamCategory })[]>([]);
  const [archivedTests, setArchivedTests] = useState<(Test & { category?: ExamCategory })[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<Test | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [totalMarks, setTotalMarks] = useState("");
  const [passingMarks, setPassingMarks] = useState("");
  const [testType, setTestType] = useState<TestType>("mcq");
  const [difficulty, setDifficulty] = useState<TestDifficulty>("none");

  // Category management state
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");

  const supabase = useMemo(() => createClient(), []);

  // Fetch data
  useEffect(() => {
    let isCancelled = false;

    const fetchData = async () => {
      try {
        const [activeTestsResult, archivedTestsResult, categoriesResult] = await Promise.all([
          supabase
            .from("tests")
            .select(`*, category:exam_categories(*)`)
            .eq("is_active", true)
            .order("created_at", { ascending: false }),
          supabase
            .from("tests")
            .select(`*, category:exam_categories(*)`)
            .eq("is_active", false)
            .order("created_at", { ascending: false }),
          supabase.from("exam_categories").select("*").order("sort_order"),
        ]);

        if (isCancelled) return;

        if (activeTestsResult.error) {
          if (!activeTestsResult.error.message?.includes("aborted") && !activeTestsResult.error.message?.includes("AbortError")) {
            console.error("Failed to fetch tests:", activeTestsResult.error.message);
          }
        }
        if (categoriesResult.error) {
          if (!categoriesResult.error.message?.includes("aborted") && !categoriesResult.error.message?.includes("AbortError")) {
            console.error("Failed to fetch categories:", categoriesResult.error.message);
          }
        }

        setTests(activeTestsResult.data || []);
        setArchivedTests(archivedTestsResult.data || []);
        setCategories(categoriesResult.data || []);
      } catch (err: any) {
        if (isCancelled) return;
        if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
          return;
        }
        console.error("Error fetching data:", err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isCancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset form
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategoryId("");
    setUseCustomCategory(false);
    setCustomCategoryName("");
    setIsPremium(false);
    setDurationMinutes("60");
    setTotalMarks("");
    setPassingMarks("");
    setTestType("mcq");
    setDifficulty("none");
    setEditingTest(null);
  };

  // Open edit dialog
  const handleEdit = (test: Test) => {
    setEditingTest(test);
    setTitle(test.title);
    setDescription(test.description || "");
    setCategoryId(test.category_id?.toString() || "");
    setUseCustomCategory(false);
    setCustomCategoryName("");
    setIsPremium(test.is_premium);
    setDurationMinutes(test.duration_minutes.toString());
    setTotalMarks(test.total_marks?.toString() || "");
    setPassingMarks(test.passing_marks?.toString() || "");
    setTestType(test.test_type || "mcq");
    setDifficulty(test.difficulty || "none");
    setDialogOpen(true);
  };

  // Add new category
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Category name is required");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("exam_categories")
        .insert({
          name: newCategoryName.trim(),
          description: newCategoryDescription.trim() || null,
          sort_order: categories.length + 1,
        })
        .select()
        .single();

      if (error) {
        if (error.message?.includes("aborted") || error.message?.includes("AbortError")) {
          return;
        }
        toast.error("Failed to add category: " + error.message);
        return;
      }

      setCategories((prev) => [...prev, data]);
      setNewCategoryName("");
      setNewCategoryDescription("");
      toast.success("Category added successfully");
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
        return;
      }
      toast.error("Failed to add category");
    }
  };

  // Delete category
  const handleDeleteCategory = async (id: number) => {
    // Check if any tests use this category
    const testsWithCategory = tests.filter((t) => t.category_id === id);
    if (testsWithCategory.length > 0) {
      toast.error(`Cannot delete: ${testsWithCategory.length} test(s) use this category`);
      return;
    }

    try {
      const { error } = await supabase.from("exam_categories").delete().eq("id", id);

      if (error) {
        if (error.message?.includes("aborted") || error.message?.includes("AbortError")) {
          return;
        }
        toast.error("Failed to delete category: " + error.message);
        return;
      }

      setCategories((prev) => prev.filter((c) => c.id !== id));
      toast.success("Category deleted");
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
        return;
      }
      toast.error("Failed to delete category");
    }
  };

  // Save test
  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    try {
      let finalCategoryId = categoryId ? parseInt(categoryId) : null;

      // If using custom category, create it first
      if (useCustomCategory && customCategoryName.trim()) {
        const { data: newCat, error: catError } = await supabase
          .from("exam_categories")
          .insert({
            name: customCategoryName.trim(),
            sort_order: categories.length + 1,
          })
          .select()
          .single();

        if (catError) {
          if (catError.message?.includes("aborted") || catError.message?.includes("AbortError")) {
            return;
          }
          toast.error("Failed to create category: " + catError.message);
          return;
        }

        setCategories((prev) => [...prev, newCat]);
        finalCategoryId = newCat.id;
      }

      const testData = {
        title: title.trim(),
        description: description.trim() || null,
        category_id: finalCategoryId,
        is_premium: isPremium,
        duration_minutes: parseInt(durationMinutes),
        total_marks: totalMarks ? parseInt(totalMarks) : null,
        passing_marks: passingMarks ? parseInt(passingMarks) : null,
        test_type: testType,
        difficulty: difficulty,
      };

      if (editingTest) {
        const { error } = await supabase
          .from("tests")
          .update(testData)
          .eq("id", editingTest.id);

        if (error) {
          if (error.message?.includes("aborted") || error.message?.includes("AbortError")) {
            return;
          }
          toast.error("Failed to update test: " + error.message);
          return;
        }

        const category = categories.find((c) => c.id === testData.category_id);
        setTests((prev) =>
          prev.map((t) =>
            t.id === editingTest.id ? { ...t, ...testData, category } : t
          )
        );
        toast.success("Test updated successfully");
      } else {
        const { data, error } = await supabase
          .from("tests")
          .insert(testData)
          .select(`*, category:exam_categories(*)`)
          .single();

        if (error) {
          if (error.message?.includes("aborted") || error.message?.includes("AbortError")) {
            return;
          }
          toast.error("Failed to create test: " + error.message);
          return;
        }

        setTests((prev) => [data, ...prev]);
        toast.success("Test created successfully");

        // Broadcast notification to all users via Realtime
        try {
          await fetch("/api/broadcast-notification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "test_added",
              title: "New Test Available",
              message: `"${data.title}" has been added`,
              data: { testId: data.id, testName: data.title },
            }),
          });
        } catch (broadcastError) {
          console.error("Failed to broadcast notification:", broadcastError);
          // Fallback to local notification if broadcast fails
          notificationHelpers.newTestAdded(data.title, data.id);
        }
      }

      setDialogOpen(false);
      resetForm();
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
        return;
      }
      toast.error("An error occurred while saving");
    }
  };

  // Archive test (soft delete)
  const handleArchive = async (id: number) => {
    if (!confirm("Are you sure you want to archive this test? It will be hidden from users but all data will be preserved.")) {
      return;
    }

    try {
      const testToArchive = tests.find((t) => t.id === id);

      const { error } = await supabase
        .from("tests")
        .update({ is_active: false })
        .eq("id", id);

      if (error) {
        if (error.message?.includes("aborted") || error.message?.includes("AbortError")) {
          return;
        }
        toast.error("Failed to archive test: " + error.message);
        return;
      }

      setTests((prev) => prev.filter((t) => t.id !== id));
      if (testToArchive) {
        setArchivedTests((prev) => [{ ...testToArchive, is_active: false }, ...prev]);
      }
      toast.success("Test archived successfully");
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
        return;
      }
      toast.error("Failed to archive test");
    }
  };

  // Restore archived test
  const handleRestore = async (id: number) => {
    try {
      const testToRestore = archivedTests.find((t) => t.id === id);

      const { error } = await supabase
        .from("tests")
        .update({ is_active: true })
        .eq("id", id);

      if (error) {
        if (error.message?.includes("aborted") || error.message?.includes("AbortError")) {
          return;
        }
        toast.error("Failed to restore test: " + error.message);
        return;
      }

      setArchivedTests((prev) => prev.filter((t) => t.id !== id));
      if (testToRestore) {
        setTests((prev) => [{ ...testToRestore, is_active: true }, ...prev]);
      }
      toast.success("Test restored successfully");
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
        return;
      }
      toast.error("Failed to restore test");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tests</h1>
          <p className="text-muted-foreground">Manage your tests and mock exams</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Category Management Dialog */}
          <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Tag className="w-4 h-4 mr-2" />
                Manage Categories
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Manage Test Categories
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Add new category */}
                <div className="space-y-2">
                  <Input
                    placeholder="Category name..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="Description (optional)"
                      value={newCategoryDescription}
                      onChange={(e) => setNewCategoryDescription(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                    />
                    <Button onClick={handleAddCategory} size="icon">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Categories list */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  <p className="text-xs text-muted-foreground font-medium">
                    Existing Categories ({categories.length})
                  </p>
                  {categories.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No categories yet. Add your first category above.
                    </p>
                  ) : (
                    categories.map((cat) => {
                      const testCount = tests.filter((t) => t.category_id === cat.id).length;
                      return (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                        >
                          <div>
                            <span className="text-sm font-medium">{cat.name}</span>
                            {cat.description && (
                              <p className="text-xs text-muted-foreground">{cat.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {testCount > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {testCount} test{testCount !== 1 ? "s" : ""}
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleDeleteCategory(cat.id)}
                              disabled={testCount > 0}
                              title={testCount > 0 ? "Cannot delete: category has tests" : "Delete category"}
                            >
                              <X className={`w-3 h-3 ${testCount > 0 ? "text-muted" : "text-destructive"}`} />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Test Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" />
                Add Test
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingTest ? "Edit Test" : "Create New Test"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Test title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Test description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="category">Category</Label>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => setUseCustomCategory(!useCustomCategory)}
                      >
                        {useCustomCategory ? "Select existing" : "Create new"}
                      </button>
                    </div>
                    {useCustomCategory ? (
                      <Input
                        id="customCategory"
                        value={customCategoryName}
                        onChange={(e) => setCustomCategoryName(e.target.value)}
                        placeholder="New category name"
                      />
                    ) : (
                      <Select value={categoryId} onValueChange={setCategoryId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id.toString()}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="testType">Test Type *</Label>
                    <Select value={testType} onValueChange={(v) => setTestType(v as TestType)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select test type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mcq">MCQ Only</SelectItem>
                        <SelectItem value="conventional">Conventional Only</SelectItem>
                        <SelectItem value="mixed">MCQ + Conventional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty Level</Label>
                  <Select value={difficulty} onValueChange={(v) => setDifficulty(v as TestDifficulty)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Hidden)</SelectItem>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totalMarks">Total Marks</Label>
                    <Input
                      id="totalMarks"
                      type="number"
                      value={totalMarks}
                      onChange={(e) => setTotalMarks(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="passingMarks">Passing Marks</Label>
                  <Input
                    id="passingMarks"
                    type="number"
                    value={passingMarks}
                    onChange={(e) => setPassingMarks(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="premium"
                    checked={isPremium}
                    onCheckedChange={setIsPremium}
                  />
                  <Label htmlFor="premium">Premium Test</Label>
                </div>

                <Button onClick={handleSave} className="w-full">
                  {editingTest ? "Update Test" : "Create Test"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Toggle Active/Archived */}
      {archivedTests.length > 0 && (
        <div className="flex items-center gap-2">
          <Switch
            id="showArchived"
            checked={showArchived}
            onCheckedChange={setShowArchived}
          />
          <Label htmlFor="showArchived" className="text-sm text-muted-foreground">
            Show archived tests ({archivedTests.length})
          </Label>
        </div>
      )}

      {/* Tests Table */}
      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Access</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(showArchived ? archivedTests : tests).map((test) => (
              <TableRow key={test.id} className={showArchived ? "opacity-60" : ""}>
                <TableCell className="font-medium">
                  {test.title}
                  {showArchived && (
                    <Badge variant="outline" className="ml-2 text-xs">Archived</Badge>
                  )}
                </TableCell>
                <TableCell>{test.category?.name || "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {test.test_type === "mcq"
                      ? "MCQ"
                      : test.test_type === "conventional"
                      ? "Essay"
                      : "Mixed"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {test.difficulty && test.difficulty !== "none" ? (
                    <Badge
                      variant="outline"
                      className={`capitalize ${
                        test.difficulty === "easy"
                          ? "border-green-500 text-green-500"
                          : test.difficulty === "moderate"
                          ? "border-yellow-500 text-yellow-500"
                          : "border-red-500 text-red-500"
                      }`}
                    >
                      {test.difficulty}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell>{test.duration_minutes} min</TableCell>
                <TableCell>
                  {test.is_premium ? (
                    <Badge variant="destructive">Premium</Badge>
                  ) : (
                    <Badge variant="secondary">Free</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" asChild>
                      <a href={`/admin/questions?test_id=${test.id}`}>
                        <FileQuestion className="w-4 h-4" />
                      </a>
                    </Button>
                    {!showArchived ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(test)}
                          title="Edit test"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleArchive(test.id)}
                          title="Archive test"
                        >
                          <Archive className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRestore(test.id)}
                        title="Restore test"
                      >
                        <ArchiveRestore className="w-4 h-4 text-green-500" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(showArchived ? archivedTests : tests).length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  {showArchived ? "No archived tests." : "No tests yet. Create your first test!"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
