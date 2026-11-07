import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseRSSFeed } from "@/lib/rss";
import type { NewsCategory } from "@/types/news.types";
import { applyRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await applyRateLimit(request, "news");
    if (rateLimitResponse) return rateLimitResponse;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as NewsCategory | null;

    console.log(`[News API] Fetching news for category: ${category}`);

    if (!category || !["sikkim", "national", "international"].includes(category)) {
      return NextResponse.json(
        { error: "Invalid category. Must be sikkim, national, or international" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Try to get cached articles from database first
    const { data: cachedArticles, error: dbError } = await supabase
      .from("news_articles")
      .select("*")
      .eq("category", category)
      .order("published_at", { ascending: false })
      .limit(20);

    if (dbError) {
      console.log(`[News API] Database query failed (table may not exist): ${dbError.message}`);
    } else {
      console.log(`[News API] Found ${cachedArticles?.length || 0} cached articles`);
    }

    let articles = cachedArticles || [];

    // If no cached articles, fetch fresh from RSS
    if (articles.length === 0) {
      console.log(`[News API] No cached articles, fetching from RSS...`);
      const freshArticles = await parseRSSFeed(category, 15);
      console.log(`[News API] RSS returned ${freshArticles.length} articles`);

      if (freshArticles.length > 0) {
        // Return fresh articles directly (cron job will handle caching)
        articles = freshArticles.map((a, index) => ({
          id: index,
          ...a,
          fetched_at: new Date().toISOString(),
        }));
      }
    }

    console.log(`[News API] Returning ${articles.length} articles for ${category}`);

    // Return all articles - Current Affairs is free for everyone
    return NextResponse.json({
      articles,
      totalAvailable: articles.length,
    });
  } catch (error) {
    console.error("[News API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 }
    );
  }
}

// POST endpoint no longer needed - Current Affairs is free for everyone
export async function POST() {
  return NextResponse.json({ success: true });
}
