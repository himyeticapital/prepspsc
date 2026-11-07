"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { TestCard } from "@/components/tests/test-card";
import { UpgradeModal } from "@/components/tests/upgrade-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, Filter, BookOpen, Sparkles, FileText, ListChecks, Layers } from "lucide-react";
import type { Test, ExamCategory, TestAnalytics } from "@/types/database.types";

interface TestsClientProps {
  tests: (Test & { category: ExamCategory | null })[];
  categories: ExamCategory[];
  isPro: boolean;
  analytics: TestAnalytics[];
}

export function TestsClient({ tests, categories, isPro, analytics }: TestsClientProps) {
  // Create a map of test analytics by test_id
  const analyticsMap = new Map(analytics.map((a) => [a.test_id, a]));
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [showPremiumOnly, setShowPremiumOnly] = useState(false);
  const [showFreeOnly, setShowFreeOnly] = useState(false);
  const [selectedTestType, setSelectedTestType] = useState<"mcq" | "conventional" | "mixed" | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // Filter tests
  const filteredTests = tests.filter((test) => {
    // Search filter
    if (
      searchQuery &&
      !test.title.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    // Category filter
    if (selectedCategory && test.category_id !== selectedCategory) {
      return false;
    }

    // Premium/Free filter
    if (showPremiumOnly && !test.is_premium) {
      return false;
    }
    if (showFreeOnly && test.is_premium) {
      return false;
    }

    // Test type filter
    if (selectedTestType) {
      const testType = (test as any).test_type || "mcq";
      if (testType !== selectedTestType) {
        return false;
      }
    }

    return true;
  });

  // Separate free and premium tests
  const freeTests = filteredTests.filter((t) => !t.is_premium);
  const premiumTests = filteredTests.filter((t) => t.is_premium);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="widget-glass p-6 rounded-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">
              Test Arena
            </h1>
            <p className="text-white/60 text-sm">
              Practice with Sikkim PSC mock tests and quizzes
            </p>
            <p className="mt-2 text-xs text-white/40 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
              All our tests are brainstormed by seasoned SPSC professionals according to the needs of the exam — not AI generated
            </p>
          </div>
        </div>
      </motion.div>

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="widget-glass p-4 rounded-2xl"
      >
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              placeholder="Search tests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowFreeOnly(false);
                setShowPremiumOnly(false);
              }}
              className={cn(
                "text-white/70 hover:text-white hover:bg-white/10",
                !showFreeOnly && !showPremiumOnly && "bg-white/10 text-white"
              )}
            >
              <Filter className="w-4 h-4 mr-2" />
              All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowFreeOnly(true);
                setShowPremiumOnly(false);
              }}
              className={cn(
                "text-white/70 hover:text-white hover:bg-white/10",
                showFreeOnly && "bg-primary/20 text-primary"
              )}
            >
              Free
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowPremiumOnly(true);
                setShowFreeOnly(false);
              }}
              className={cn(
                "text-white/70 hover:text-white hover:bg-white/10",
                showPremiumOnly && "bg-orange-500/20 text-orange-400"
              )}
            >
              <Sparkles className="w-4 h-4 mr-1" />
              Premium
            </Button>

            {/* Divider */}
            <div className="w-px h-6 bg-white/10 mx-1" />

            {/* Test Type Filters */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedTestType(null)}
              className={cn(
                "text-white/70 hover:text-white hover:bg-white/10",
                selectedTestType === null && "bg-white/10 text-white"
              )}
            >
              <Layers className="w-4 h-4 mr-1" />
              All Types
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedTestType("mcq")}
              className={cn(
                "text-white/70 hover:text-white hover:bg-white/10",
                selectedTestType === "mcq" && "bg-blue-500/20 text-blue-400"
              )}
            >
              <ListChecks className="w-4 h-4 mr-1" />
              MCQ
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedTestType("conventional")}
              className={cn(
                "text-white/70 hover:text-white hover:bg-white/10",
                selectedTestType === "conventional" && "bg-purple-500/20 text-purple-400"
              )}
            >
              <FileText className="w-4 h-4 mr-1" />
              Essay
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedTestType("mixed")}
              className={cn(
                "text-white/70 hover:text-white hover:bg-white/10",
                selectedTestType === "mixed" && "bg-green-500/20 text-green-400"
              )}
            >
              <Layers className="w-4 h-4 mr-1" />
              MCQ + Essay
            </Button>
          </div>
        </div>

        {/* Category Filters */}
        {categories.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-4 pt-4 border-t border-white/10">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs transition-colors",
                selectedCategory === null
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              )}
            >
              All Categories
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs transition-colors",
                  selectedCategory === category.id
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                )}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Empty State */}
      {filteredTests.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="widget-glass p-12 rounded-2xl text-center"
        >
          <BookOpen className="w-12 h-12 text-white/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No tests found</h3>
          <p className="text-white/50">
            {searchQuery
              ? "Try adjusting your search or filters"
              : "Tests will appear here once they are added"}
          </p>
        </motion.div>
      )}

      {/* Free Tests Section */}
      {freeTests.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-primary"></span>
            <h2 className="text-lg font-semibold text-white">Free Tests</h2>
            <span className="text-xs text-white/40">({freeTests.length})</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {freeTests.map((test, index) => (
              <motion.div
                key={test.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <TestCard
                  test={test}
                  isPro={isPro}
                  analytics={analyticsMap.get(test.id)}
                  onLockedClick={() => setUpgradeModalOpen(true)}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Premium Tests Section */}
      {premiumTests.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500"></span>
            <h2 className="text-lg font-semibold text-white">Premium Tests</h2>
            <span className="text-xs text-white/40">({premiumTests.length})</span>
            {!isPro && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
                Requires Pro
              </span>
            )}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {premiumTests.map((test, index) => (
              <motion.div
                key={test.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <TestCard
                  test={test}
                  isPro={isPro}
                  analytics={analyticsMap.get(test.id)}
                  onLockedClick={() => setUpgradeModalOpen(true)}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
      />
    </div>
  );
}
