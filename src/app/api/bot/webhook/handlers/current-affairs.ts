/**
 * Current Affairs Handler
 * Fetches latest news from news_articles table (cached RSS feeds)
 * Supports category filtering: sikkim, national, international
 */

import { createClient } from "@supabase/supabase-js";
import type { BotConnection, BotResponse } from "@/lib/bot/types";
import * as personality from "@/lib/bot/personality";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type NewsCategory = "sikkim" | "national" | "international";

const VALID_CATEGORIES: NewsCategory[] = ["sikkim", "national", "international"];

/**
 * Handle /ca command - show latest current affairs
 */
export async function handleCurrentAffairs(
  connection: BotConnection,
  category?: string
): Promise<BotResponse> {
  try {
    // Validate category filter
    const filterCategory = category && VALID_CATEGORIES.includes(category as NewsCategory)
      ? (category as NewsCategory)
      : undefined;

    // Query cached news articles (fetched by cron from RSS feeds)
    let query = supabase
      .from("news_articles")
      .select("title, summary, source_url, source_name, category, published_at")
      .order("published_at", { ascending: false });

    if (filterCategory) {
      query = query.eq("category", filterCategory);
      query = query.limit(6);
    } else {
      // Get 3 per category for a balanced briefing
      query = query.limit(15);
    }

    const { data: articles, error } = await query;

    if (error) {
      console.error("Current affairs fetch error:", error);
      return personality.currentAffairsError();
    }

    if (!articles || articles.length === 0) {
      return personality.currentAffairsEmpty(filterCategory);
    }

    // If no filter, pick top articles per category for balanced view
    let displayArticles = articles;
    if (!filterCategory) {
      const grouped: Record<string, typeof articles> = {};
      for (const article of articles) {
        if (!grouped[article.category]) grouped[article.category] = [];
        grouped[article.category].push(article);
      }
      displayArticles = [];
      for (const cat of VALID_CATEGORIES) {
        if (grouped[cat]) {
          displayArticles.push(...grouped[cat].slice(0, 3));
        }
      }
    }

    return personality.currentAffairsBriefing(displayArticles, filterCategory);
  } catch (error) {
    console.error("Current affairs handler error:", error);
    return personality.currentAffairsError();
  }
}
