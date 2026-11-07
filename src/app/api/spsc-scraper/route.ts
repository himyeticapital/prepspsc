import { NextResponse } from "next/server";
import https from "https";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // Cache for 1 hour

const BASE_URL = "https://spsc.sikkim.gov.in";
const ADVERTISEMENT_URL = `${BASE_URL}/Advertisement.html`;

// Fetch with SSL certificate bypass (SPSC site has invalid cert)
function fetchInsecure(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { rejectUnauthorized: false }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
  });
}

export interface ScrapedExam {
  title: string;
  posts: number | null;
  advertisementNo: string;
  issuedDate: string;
  issuedDateParsed: string | null; // ISO date for sorting
  department: string;
  links: {
    advertisement: string | null;
    notification: string | null;
    syllabus: string | null;
    apply: string | null;
  };
  // Mapped pattern ID from our 64 mock-test patterns
  patternId: string | null;
  patternConfidence: "exact" | "close" | "none";
}

// Pattern mapping: keywords in exam title → our mock-test pattern ID
const PATTERN_MAP: { keywords: string[]; patternId: string; label: string }[] = [
  { keywords: ["under secretary"], patternId: "undersecretary-prelims", label: "Under Secretary Prelims" },
  { keywords: ["sub inspector", "police"], patternId: "si-police-prelims", label: "SI Police Prelims" },
  { keywords: ["sub inspector", "excise"], patternId: "si-excise", label: "SI Excise" },
  { keywords: ["labour inspector", "labor inspector"], patternId: "general-prelims", label: "General Prelims" },
  { keywords: ["block officer", "forest"], patternId: "forest-ranger-prelims", label: "Forest Ranger Prelims" },
  { keywords: ["forest guard"], patternId: "forest-ranger-prelims", label: "Forest Ranger Prelims" },
  { keywords: ["junior engineer", "civil"], patternId: "junior-engineer-prelims", label: "JE Prelims" },
  { keywords: ["junior engineer", "mechanical"], patternId: "junior-engineer-prelims", label: "JE Prelims" },
  { keywords: ["assistant engineer", "electrical"], patternId: "assistant-engineer-electrical", label: "AE Electrical" },
  { keywords: ["assistant engineer", "civil"], patternId: "assistant-engineer-civil", label: "AE Civil" },
  { keywords: ["assistant engineer", "mechanical"], patternId: "assistant-engineer-mechanical", label: "AE Mechanical" },
  { keywords: ["accounts officer"], patternId: "undersecretary-prelims", label: "Under Secretary Prelims" },
  { keywords: ["assistant professor"], patternId: "general-prelims", label: "General Prelims" },
  { keywords: ["medical stores inspector"], patternId: "drug-inspector", label: "Drug Inspector" },
  { keywords: ["lower division clerk", "ldc"], patternId: "ldc-prelims", label: "LDC" },
  { keywords: ["stenographer"], patternId: "stenographer", label: "Stenographer" },
  { keywords: ["veterinary officer"], patternId: "veterinary-officer", label: "Veterinary Officer" },
  { keywords: ["dental surgeon"], patternId: "dental-surgeon", label: "Dental Surgeon" },
  { keywords: ["staff nurse"], patternId: "staff-nurse", label: "Staff Nurse" },
  { keywords: ["sub jailer"], patternId: "sub-jailer", label: "Sub Jailer" },
  { keywords: ["sub fire officer"], patternId: "sub-fire-officer", label: "Sub Fire Officer" },
  { keywords: ["cooperative inspector", "cooperative auditor"], patternId: "cooperative-inspector", label: "Cooperative Inspector" },
  { keywords: ["statistical inspector"], patternId: "statistical-inspector", label: "Statistical Inspector" },
  { keywords: ["revenue inspector"], patternId: "revenue-inspector", label: "Revenue Inspector" },
  { keywords: ["food safety"], patternId: "food-safety-officer", label: "Food Safety Officer" },
];

function matchPattern(title: string): { patternId: string; confidence: "exact" | "close" | "none" } {
  const lower = title.toLowerCase();

  for (const entry of PATTERN_MAP) {
    const allMatch = entry.keywords.every((kw) => lower.includes(kw));
    if (allMatch) {
      return { patternId: entry.patternId, confidence: "exact" };
    }
  }

  // Try partial match (at least one keyword matches)
  for (const entry of PATTERN_MAP) {
    const someMatch = entry.keywords.some((kw) => lower.includes(kw));
    if (someMatch) {
      return { patternId: entry.patternId, confidence: "close" };
    }
  }

  // Fallback to general prelims for any SPSC exam
  return { patternId: "general-prelims", confidence: "none" };
}

function parseDate(dateStr: string): string | null {
  // Format: "11/12/2025" (DD/MM/YYYY)
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

function extractPosts(title: string): number | null {
  // Match patterns like "24 (twenty four) posts" or "09 Posts" or "100 Posts"
  const match = title.match(/(\d+)\s*(?:\([^)]+\)\s*)?posts?\b/i);
  return match ? parseInt(match[1], 10) : null;
}

function extractDepartment(title: string): string {
  const deptMatch = title.match(/under\s+(?:the\s+)?(.+?)(?:\.\s*$|$)/i);
  if (deptMatch) {
    return deptMatch[1].replace(/,\s*Government of Sikkim\.?/i, "").trim();
  }
  return "SPSC";
}

function resolveUrl(href: string): string {
  if (href.startsWith("http")) return href;
  // Relative URL — resolve against base
  return `${BASE_URL}/${href.replace(/^\//, "")}`;
}

function parseHTML(html: string): ScrapedExam[] {
  const exams: ScrapedExam[] = [];

  // Split by table rows containing exam data
  // Each <tr> contains one exam entry
  const trRegex = /<tr>\s*<td[^>]*>([\s\S]*?)<\/td>/g;
  let trMatch;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const cellContent = trMatch[1];

    // Extract title — first <a> tag text or the main text content
    const titleMatch = cellContent.match(/<a[^>]*>([^<]+(?:(?!<\/a>)[\s\S])*?)<\/a>/);
    if (!titleMatch) continue;

    const title = titleMatch[1]
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!title || title.length < 10) continue;

    // Extract advertisement number
    const advNoMatch = cellContent.match(/Advertisement No\.\s*([^\s<]+)/i);
    const advertisementNo = advNoMatch ? advNoMatch[1].trim() : "";

    // Extract issued date
    const dateMatch = cellContent.match(/Issued Date:\s*(\d{2}\/\d{2}\/\d{4})/i);
    const issuedDate = dateMatch ? dateMatch[1] : "";

    // Extract PDF links
    const links = {
      advertisement: null as string | null,
      notification: null as string | null,
      syllabus: null as string | null,
      apply: null as string | null,
    };

    // Find all <a href="..."> links within this cell
    const linkRegex = /<a\s+href="([^"]*)"[^>]*>([^<]*(?:<[^/][^>]*>[^<]*)*)<\/a>/gi;
    let linkMatch;

    while ((linkMatch = linkRegex.exec(cellContent)) !== null) {
      const href = linkMatch[1];
      const linkText = linkMatch[2].replace(/<[^>]+>/g, "").trim().toLowerCase();

      if (linkText.includes("scheme") || linkText.includes("syllabus")) {
        links.syllabus = resolveUrl(href);
      } else if (linkText.includes("notification")) {
        links.notification = resolveUrl(href);
      } else if (linkText.includes("advertisement") || linkText === "advertisement") {
        links.advertisement = resolveUrl(href);
      } else if (href.includes("spscrecruitment") || linkText.includes("apply")) {
        links.apply = resolveUrl(href);
      }
    }

    // If no advertisement link found from <li>, use the title's <a> if it points to a PDF
    if (!links.advertisement) {
      const titleHrefMatch = cellContent.match(/<a\s+href="([^"]*\.pdf)"[^>]*>/i);
      if (titleHrefMatch) {
        links.advertisement = resolveUrl(titleHrefMatch[1]);
      }
    }

    const posts = extractPosts(title);
    const department = extractDepartment(title);
    const { patternId, confidence } = matchPattern(title);

    exams.push({
      title,
      posts,
      advertisementNo,
      issuedDate,
      issuedDateParsed: parseDate(issuedDate),
      department,
      links,
      patternId,
      patternConfidence: confidence,
    });
  }

  return exams;
}

// In-memory cache
let cachedData: { exams: ScrapedExam[]; scrapedAt: string } | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET() {
  try {
    // Return cached data if fresh
    if (cachedData && Date.now() - cacheTimestamp < CACHE_TTL) {
      return NextResponse.json(cachedData);
    }

    // Fetch the advertisement page (SPSC site has invalid SSL cert)
    let html: string;
    try {
      html = await fetchInsecure(ADVERTISEMENT_URL);
    } catch {
      if (cachedData) {
        return NextResponse.json(cachedData);
      }
      return NextResponse.json({ exams: [], scrapedAt: null, error: "Failed to fetch SPSC page" });
    }
    const exams = parseHTML(html);

    // Sort by date (newest first)
    exams.sort((a, b) => {
      if (!a.issuedDateParsed || !b.issuedDateParsed) return 0;
      return b.issuedDateParsed.localeCompare(a.issuedDateParsed);
    });

    const result = {
      exams,
      scrapedAt: new Date().toISOString(),
    };

    // Cache the result
    cachedData = result;
    cacheTimestamp = Date.now();

    return NextResponse.json(result);
  } catch (error) {
    console.error("SPSC scraper error:", error);

    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    return NextResponse.json(
      { exams: [], scrapedAt: null, error: "Scraper failed" },
      { status: 500 }
    );
  }
}
