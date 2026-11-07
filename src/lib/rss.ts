import Parser from "rss-parser";
import type { NewsCategory } from "@/types/news.types";

const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
      ["enclosure", "enclosure"],
    ],
  },
});

/**
 * Fix common XML encoding issues in RSS feeds
 * Many feeds have unescaped & characters which break XML parsing
 */
function fixMalformedXml(xml: string): string {
  // Fix unescaped & characters (but not already-escaped ones like &amp;, &lt;, etc.)
  // Match & not followed by amp, lt, gt, apos, quot, or # (numeric entities)
  return xml.replace(/&(?!(amp|lt|gt|apos|quot|#)[;]?)/g, '&amp;');
}

// RSS Feed URLs for each category (supports multiple feeds per category)
export const RSS_FEEDS: Record<NewsCategory, { url: string; sourceName: string }[]> = {
  sikkim: [
    {
      url: "https://sikkimexpress.com/Feed/rss_feed/latest-news",
      sourceName: "Sikkim Express",
    },
    {
      url: "https://eastmojo.com/sikkim/feed/",
      sourceName: "EastMojo Sikkim",
    },
  ],
  national: [
    {
      url: "https://www.thehindu.com/news/national/feeder/default.rss",
      sourceName: "The Hindu",
    },
    {
      url: "https://feeds.feedburner.com/ndtvnews-india-news",
      sourceName: "NDTV",
    },
  ],
  international: [
    {
      url: "https://feeds.bbci.co.uk/news/world/rss.xml",
      sourceName: "BBC World",
    },
    {
      url: "https://www.aljazeera.com/xml/rss/all.xml",
      sourceName: "Al Jazeera",
    },
    {
      url: "https://feeds.feedburner.com/ndtvnews-world-news",
      sourceName: "NDTV World",
    },
  ],
};

export interface ParsedArticle {
  title: string;
  summary: string | null;
  source_url: string;
  source_name: string;
  category: NewsCategory;
  published_at: string | null;
  image_url: string | null;
}

/**
 * Extract image URL from various RSS feed formats
 */
function extractImageUrl(item: Record<string, unknown>): string | null {
  // Try media:content
  if (item.mediaContent && typeof item.mediaContent === "object") {
    const media = item.mediaContent as { $?: { url?: string } };
    if (media.$?.url) return media.$.url;
  }

  // Try media:thumbnail
  if (item.mediaThumbnail && typeof item.mediaThumbnail === "object") {
    const thumb = item.mediaThumbnail as { $?: { url?: string } };
    if (thumb.$?.url) return thumb.$.url;
  }

  // Try enclosure
  if (item.enclosure && typeof item.enclosure === "object") {
    const enc = item.enclosure as { url?: string; type?: string };
    if (enc.url && enc.type?.startsWith("image/")) return enc.url;
  }

  // Try to extract from content/description
  const content = (item.content || item["content:encoded"] || item.description) as string;
  if (content) {
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) return imgMatch[1];
  }

  return null;
}

/**
 * Clean HTML from text
 */
function stripHtml(html: string | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Parse a single RSS feed URL and return normalized articles
 */
async function parseSingleFeed(
  feedConfig: { url: string; sourceName: string },
  category: NewsCategory,
  limit: number
): Promise<ParsedArticle[]> {
  try {
    // Fetch RSS manually to fix malformed XML before parsing
    const response = await fetch(feedConfig.url, {
      headers: {
        'User-Agent': 'PrepSPSC News Bot/1.0',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS from ${feedConfig.sourceName}: ${response.status}`);
    }

    const rawXml = await response.text();
    const fixedXml = fixMalformedXml(rawXml);
    const feed = await parser.parseString(fixedXml);

    const articles: ParsedArticle[] = feed.items.slice(0, limit).map((item) => {
      // Cast item to any to access custom fields
      const itemAny = item as unknown as Record<string, unknown>;
      const summary = stripHtml(
        item.contentSnippet || item.content || (itemAny.description as string | undefined)
      );

      return {
        title: stripHtml(item.title) || "Untitled",
        summary: summary.length > 300 ? summary.slice(0, 300) + "..." : summary || null,
        source_url: (item.link || "").trim(),
        source_name: feedConfig.sourceName,
        category,
        published_at: item.pubDate || item.isoDate || null,
        image_url: extractImageUrl(itemAny),
      };
    });

    return articles.filter((a) => a.source_url); // Filter out items without links
  } catch (error) {
    console.error(`Error parsing RSS feed from ${feedConfig.sourceName}:`, error);
    return [];
  }
}

/**
 * Parse all RSS feeds for a category and return combined articles
 */
export async function parseRSSFeed(
  category: NewsCategory,
  limit: number = 20
): Promise<ParsedArticle[]> {
  const feedConfigs = RSS_FEEDS[category];

  // Calculate limit per feed to stay within total limit
  const limitPerFeed = Math.ceil(limit / feedConfigs.length);

  // Fetch all feeds in parallel
  const results = await Promise.allSettled(
    feedConfigs.map((config) => parseSingleFeed(config, category, limitPerFeed))
  );

  const allArticles: ParsedArticle[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      allArticles.push(...result.value);
    } else {
      console.error(`Failed to fetch ${feedConfigs[index].sourceName} feed:`, result.reason);
    }
  });

  // Sort by published date (newest first) and limit total results
  return allArticles
    .sort((a, b) => {
      if (!a.published_at) return 1;
      if (!b.published_at) return -1;
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    })
    .slice(0, limit);
}

/**
 * Fetch all RSS feeds and return combined articles
 */
export async function fetchAllFeeds(
  limitPerCategory: number = 15
): Promise<ParsedArticle[]> {
  const categories: NewsCategory[] = ["sikkim", "national", "international"];

  const results = await Promise.allSettled(
    categories.map((cat) => parseRSSFeed(cat, limitPerCategory))
  );

  const allArticles: ParsedArticle[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      allArticles.push(...result.value);
    } else {
      console.error(`Failed to fetch ${categories[index]} feed:`, result.reason);
    }
  });

  return allArticles;
}
