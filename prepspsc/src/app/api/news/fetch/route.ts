import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchAllFeeds } from "@/lib/rss";

// Use service role key for cron job (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret (mandatory — fail closed)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Starting RSS feed fetch...");

    // Fetch all feeds
    const articles = await fetchAllFeeds(15);

    console.log(`Fetched ${articles.length} articles from RSS feeds`);

    if (articles.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No articles fetched",
        count: 0,
      });
    }

    // Upsert articles to database (using source_url as unique key)
    const upsertData = articles.map((article) => ({
      title: article.title,
      summary: article.summary,
      source_url: article.source_url,
      source_name: article.source_name,
      category: article.category,
      published_at: article.published_at,
      image_url: article.image_url,
      fetched_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabaseAdmin
      .from("news_articles")
      .upsert(upsertData, {
        onConflict: "source_url",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      throw upsertError;
    }

    // Clean up old articles (older than 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { error: deleteError } = await supabaseAdmin
      .from("news_articles")
      .delete()
      .lt("fetched_at", sevenDaysAgo.toISOString());

    if (deleteError) {
      console.error("Delete old articles error:", deleteError);
    }

    // Also clean up old view records (older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await supabaseAdmin
      .from("user_news_views")
      .delete()
      .lt("view_date", thirtyDaysAgo.toISOString().split("T")[0]);

    console.log(`Successfully upserted ${articles.length} articles`);

    return NextResponse.json({
      success: true,
      message: `Fetched and cached ${articles.length} articles`,
      count: articles.length,
      categories: {
        sikkim: articles.filter((a) => a.category === "sikkim").length,
        national: articles.filter((a) => a.category === "national").length,
        international: articles.filter((a) => a.category === "international").length,
      },
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      { error: "Failed to fetch and cache news" },
      { status: 500 }
    );
  }
}

// Also support GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request);
}
