"use client";

import { hasProAccess } from "@/lib/access";
import { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, Clock, Play, Lock, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

interface TestItem {
  id: number;
  title: string;
  category: string;
  duration: number;
  questions: number;
  isPremium: boolean;
}

interface ExamCategory {
  id: number;
  name: string;
  slug: string;
}

export function TestsWidget() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [tests, setTests] = useState<TestItem[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [isLoading, setIsLoading] = useState(true);
  const { profile } = useAuthStore();
  const isPro = hasProAccess(profile);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      // Fetch categories from database
      const { data: categoriesData } = await supabase
        .from("exam_categories")
        .select("id, name, slug")
        .order("name", { ascending: true });

      if (categoriesData) {
        const categoryNames = categoriesData.map((cat: ExamCategory) => cat.name);
        setCategories(["All", ...categoryNames]);
      }

      // Fetch tests
      const { data, error } = await supabase
        .from("tests")
        .select(`
          id,
          title,
          duration_minutes,
          is_premium,
          category:exam_categories(name),
          questions(id)
        `)
        .limit(10);

      if (error) {
        console.error("Failed to fetch tests:", error.message);
        setIsLoading(false);
        return;
      }

      const formattedTests: TestItem[] = (data || []).map((test: any) => ({
        id: test.id,
        title: test.title,
        category: test.category?.[0]?.name || test.category?.name || "General",
        duration: test.duration_minutes,
        questions: test.questions?.length || 0,
        isPremium: test.is_premium,
      }));

      setTests(formattedTests);
      setIsLoading(false);
    };

    fetchData();
  }, [supabase]);

  const filteredTests =
    selectedCategory === "All"
      ? tests
      : tests.filter((t) => t.category === selectedCategory);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[420px]">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[420px]">
      {/* Category Filter - Horizontal Scroll */}
      <div className="px-4 pt-4 pb-2">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors flex-shrink-0",
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="h-1.5" />
        </ScrollArea>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-3 pb-4">
          {/* Quick Start */}
          <Button className="w-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30">
            <Shuffle className="w-4 h-4 mr-2" />
            Start Random Quiz
          </Button>

          {/* Test List */}
          {filteredTests.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-8 h-8 text-white/20 mx-auto mb-2" />
              <p className="text-sm text-white/40">No tests available</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTests.map((test) => (
                <Link
                  key={test.id}
                  href={test.isPremium && !isPro ? "#" : `/test/${test.id}`}
                  className={cn(
                    "block p-3 rounded-xl transition-all",
                    "bg-white/5 hover:bg-white/10 border border-white/5",
                    test.isPremium && !isPro && "opacity-70"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-white truncate">
                          {test.title}
                        </h4>
                        {test.isPremium && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-destructive/50 text-destructive flex-shrink-0"
                          >
                            PRO
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {test.duration}m
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          {test.questions} Q
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {test.isPremium && !isPro ? (
                        <div className="w-8 h-8 rounded-lg bg-destructive/20 flex items-center justify-center">
                          <Lock className="w-4 h-4 text-destructive" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                          <Play className="w-4 h-4 text-primary" />
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* View All */}
          <Link
            href="/tests"
            className="block text-center text-xs text-primary hover:underline pt-1"
          >
            View All Tests →
          </Link>
        </div>
      </ScrollArea>
    </div>
  );
}
