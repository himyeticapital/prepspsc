"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { BookmarkCheck, ChevronRight, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

interface BookmarkWithDetails {
  id: number;
  question_id: number;
  notes: string | null;
  question: string;
  testTitle: string;
  testId: number;
  category: string;
}

export function BookmarksWidget() {
  const { user } = useAuthStore();
  const [bookmarks, setBookmarks] = useState<BookmarkWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let isCancelled = false;

    const fetchBookmarks = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch bookmarks with question details
        const { data: bookmarksData, error: bookmarksError } = await supabase
          .from("bookmarks")
          .select(`
            id,
            question_id,
            notes,
            questions!inner (
              id,
              content,
              test_id,
              tests!inner (
                id,
                title,
                category_id,
                exam_categories (
                  name
                )
              )
            )
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);

        if (isCancelled) return;

        if (bookmarksError) {
          if (bookmarksError.message?.includes("aborted") || bookmarksError.message?.includes("AbortError")) {
            return;
          }
          console.error("Bookmarks fetch error:", bookmarksError.message);
          setBookmarks([]);
        } else {
          // Transform the data
          const transformedBookmarks: BookmarkWithDetails[] = (bookmarksData || []).map((b: any) => ({
            id: b.id,
            question_id: b.question_id,
            notes: b.notes,
            question: b.questions?.content || "Question not found",
            testTitle: b.questions?.tests?.title || "Unknown Test",
            testId: b.questions?.tests?.id || 0,
            category: b.questions?.tests?.exam_categories?.name || "Uncategorized",
          }));
          setBookmarks(transformedBookmarks);
        }
      } catch (err: any) {
        if (isCancelled) return;
        if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
          return;
        }
        console.error("Error fetching bookmarks:", err);
        setBookmarks([]);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchBookmarks();

    return () => {
      isCancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filteredBookmarks = bookmarks.filter(
    (b) =>
      b.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[350px] text-center p-4">
        <BookmarkCheck className="w-10 h-10 text-white/20 mb-3" />
        <p className="text-sm text-white/50">Sign in to see your bookmarks</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[350px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-white/10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bookmarks..."
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40"
          />
        </div>
      </div>

      {/* Bookmarks List */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: 350 }}>
        {bookmarks.length === 0 ? (
          <div className="p-8 text-center">
            <BookmarkCheck className="w-10 h-10 text-white/20 mx-auto mb-2" />
            <p className="text-sm text-white/40">No saved questions yet</p>
            <p className="text-xs text-white/30 mt-1">
              Bookmark questions while taking tests to review later
            </p>
          </div>
        ) : filteredBookmarks.length === 0 ? (
          <div className="p-8 text-center">
            <Search className="w-10 h-10 text-white/20 mx-auto mb-2" />
            <p className="text-sm text-white/40">No bookmarks match your search</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {filteredBookmarks.map((bookmark) => (
              <Link
                key={bookmark.id}
                href={`/test/${bookmark.testId}?question=${bookmark.question_id}`}
                className={cn(
                  "block p-3 rounded-xl transition-colors",
                  "bg-white/5 hover:bg-white/10 border border-white/5"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white line-clamp-2">
                      {bookmark.question}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] border-white/20 text-white/60"
                      >
                        {bookmark.category}
                      </Badge>
                      <span className="text-[10px] text-white/40 truncate">
                        {bookmark.testTitle}
                      </span>
                    </div>
                    {bookmark.notes && (
                      <p className="text-xs text-primary/80 mt-2 line-clamp-1">
                        {bookmark.notes}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/30 flex-shrink-0 mt-1" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/10">
        <p className="text-xs text-white/40 text-center">
          {bookmarks.length} saved question{bookmarks.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
