/**
 * SPSC Recruitment Scraper
 * Runs daily to check for new recruitment notifications on the SPSC portal
 * Alerts eligible users via Telegram
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendMessage } from "@/lib/bot/adapters/telegram";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PORTAL_URL = "https://spscrecruitment.sikkim.gov.in/rpaonline";

export const maxDuration = 60;

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch the SPSC portal page
    const response = await fetch(`${PORTAL_URL}/login`, {
      headers: {
        "User-Agent": "PrepSPSC Bot/1.0 (Recruitment Monitor)",
      },
    });

    if (!response.ok) {
      console.error(`SPSC portal returned ${response.status}`);
      return NextResponse.json({
        status: "error",
        message: `Portal returned ${response.status}`
      });
    }

    const html = await response.text();

    // Parse notifications from the HTML
    const notifications = parseNotifications(html);

    if (notifications.length === 0) {
      return NextResponse.json({
        status: "ok",
        message: "No notifications found on portal",
        scraped_at: new Date().toISOString(),
      });
    }

    // Check which notifications are new
    let newCount = 0;
    for (const notif of notifications) {
      // Try to insert (will fail on unique constraint if already exists)
      const { error } = await supabase
        .from("spsc_recruitments")
        .insert({
          title: notif.title,
          post_name: notif.postName,
          department: notif.department,
          notification_url: notif.url,
          published_date: notif.publishedDate,
          last_date_apply: notif.lastDate,
          raw_html: notif.rawHtml,
          is_active: true,
        })
        .single();

      if (!error) {
        newCount++;
        // This is a new recruitment -- notify eligible users
        await notifyEligibleUsers(notif);
      }
    }

    // Deactivate expired recruitments
    await supabase
      .from("spsc_recruitments")
      .update({ is_active: false })
      .lt("last_date_apply", new Date().toISOString().split("T")[0])
      .eq("is_active", true);

    return NextResponse.json({
      status: "ok",
      total_scraped: notifications.length,
      new_notifications: newCount,
      scraped_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("SPSC scrape error:", error);
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Parse recruitment notifications from portal HTML
 */
function parseNotifications(html: string): Array<{
  title: string;
  postName?: string;
  department?: string;
  url: string;
  publishedDate?: string;
  lastDate?: string;
  rawHtml: string;
}> {
  const notifications: Array<{
    title: string;
    postName?: string;
    department?: string;
    url: string;
    publishedDate?: string;
    lastDate?: string;
    rawHtml: string;
  }> = [];

  // Extract table rows from notification section
  const tableRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  let tableMatch;
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const rowHtml = tableMatch[1];

    // Extract cells
    const cells: string[] = [];
    const tdRegexLocal = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRegexLocal.exec(rowHtml)) !== null) {
      cells.push(tdMatch[1].replace(/<[^>]*>/g, "").trim());
    }

    // Extract links
    const linkRegexLocal = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let linkMatch;
    while ((linkMatch = linkRegexLocal.exec(rowHtml)) !== null) {
      const url = linkMatch[1];
      const text = linkMatch[2].replace(/<[^>]*>/g, "").trim();

      if (text && text.length > 10 && !text.includes("Notification(s) when available")) {
        notifications.push({
          title: text,
          postName: extractPostName(text),
          department: cells.length > 1 ? cells[1] : undefined,
          url: url.startsWith("http") ? url : `${PORTAL_URL}/${url}`,
          publishedDate: extractDate(cells),
          lastDate: extractLastDate(cells, text),
          rawHtml: rowHtml,
        });
      }
    }
  }

  return notifications;
}

/**
 * Extract post name from notification title
 */
function extractPostName(title: string): string | undefined {
  const match = title.match(/post\s+of\s+(.+?)(?:\s+under|\s+in|\s+at|\.|$)/i);
  return match?.[1]?.trim();
}

/**
 * Extract published date from table cells
 */
function extractDate(cells: string[]): string | undefined {
  for (const cell of cells) {
    const dateMatch = cell.match(/\d{2}[/-]\d{2}[/-]\d{4}/);
    if (dateMatch) {
      const parts = dateMatch[0].split(/[/-]/);
      return `${parts[2]}-${parts[1]}-${parts[0]}`; // Convert to YYYY-MM-DD
    }
  }
  return undefined;
}

/**
 * Extract last date to apply
 */
function extractLastDate(cells: string[], title: string): string | undefined {
  // Check cells first (usually the last date column)
  for (let i = cells.length - 1; i >= 0; i--) {
    const dateMatch = cells[i].match(/\d{2}[/-]\d{2}[/-]\d{4}/);
    if (dateMatch) {
      const parts = dateMatch[0].split(/[/-]/);
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }

  // Try extracting from title
  const titleDate = title.match(/(?:last\s+date|deadline|closing\s+date)[:\s]+(\d{2}[/-]\d{2}[/-]\d{4})/i);
  if (titleDate) {
    const parts = titleDate[1].split(/[/-]/);
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  return undefined;
}

/**
 * Notify eligible users about a new recruitment
 */
async function notifyEligibleUsers(notif: {
  title: string;
  postName?: string;
  department?: string;
  url: string;
  lastDate?: string;
}): Promise<void> {
  // Get all users who want recruitment notifications
  const { data: prefs } = await supabase
    .from("spsc_user_preferences")
    .select("user_id")
    .eq("notify_new_recruitments", true);

  if (!prefs || prefs.length === 0) return;

  // Get their Telegram connections
  const userIds = prefs.map((p) => p.user_id);
  const { data: connections } = await supabase
    .from("bot_connections")
    .select("platform_user_id, user_id")
    .eq("platform", "telegram")
    .eq("is_active", true)
    .in("user_id", userIds);

  if (!connections || connections.length === 0) return;

  // Send notification to each user
  const deadlineText = notif.lastDate
    ? `\nDeadline: <b>${notif.lastDate}</b>`
    : "";

  const message = {
    text: `📢 <b>New SPSC Recruitment!</b>\n\n${notif.title}${notif.postName ? `\nPost: ${notif.postName}` : ""}${notif.department ? `\nDepartment: ${notif.department}` : ""}${deadlineText}\n\nUse /fillspscform to apply through the bot!`,
    parseMode: "HTML" as const,
    buttons: [
      { text: "📋 Apply Now", callbackData: "spsc_start" },
      { text: "🔗 View Details", url: notif.url },
    ],
  };

  for (const conn of connections) {
    try {
      await sendMessage(conn.platform_user_id, message);
    } catch (error) {
      console.error(`Failed to notify user ${conn.user_id}:`, error);
    }
  }
}
