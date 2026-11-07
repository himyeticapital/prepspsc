import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { applyRateLimit } from "@/lib/rate-limit";
import { YoutubeTranscript } from "youtube-transcript";

// Disable caching for this route
export const dynamic = "force-dynamic";

// Fetch actual YouTube video title using oEmbed API (no API key required)
async function getYouTubeVideoTitle(videoId: string): Promise<string | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl, {
      cache: "no-store",
      headers: { "User-Agent": "PrepSPSC/1.0" }
    });
    if (response.ok) {
      const data = await response.json();
      return data.title || null;
    }
  } catch (error) {
    console.error("[YouTube] Failed to fetch video title from oEmbed:", error);
  }
  return null;
}

// YouTube transcript fetcher with multiple methods
interface TranscriptResult {
  text: string;
  hasTranscript: boolean;
  method?: string;
  error?: string;
}

// Method 1: Use youtube-transcript package (most reliable)
async function fetchWithYoutubeTranscriptPackage(videoId: string): Promise<TranscriptResult> {
  try {
    console.log(`[YouTube] Method 1: Trying youtube-transcript package for ${videoId}`);

    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: 'en',
    });

    if (!transcriptItems || transcriptItems.length === 0) {
      return { text: '', hasTranscript: false, error: 'No transcript items returned' };
    }

    const fullText = transcriptItems
      .map(item => item.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (fullText.length < 50) {
      return { text: '', hasTranscript: false, error: 'Transcript too short' };
    }

    console.log(`[YouTube] Method 1 SUCCESS: ${fullText.length} characters`);
    return { text: fullText, hasTranscript: true, method: 'youtube-transcript-package' };
  } catch (error: any) {
    console.log(`[YouTube] Method 1 failed: ${error.message}`);
    return { text: '', hasTranscript: false, error: error.message };
  }
}

// Method 2: Direct timedtext API with different format
async function fetchWithTimedTextAPI(videoId: string): Promise<TranscriptResult> {
  try {
    console.log(`[YouTube] Method 2: Trying timedtext API for ${videoId}`);

    // Try different timedtext URL formats
    const urls = [
      `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`,
      `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}&fmt=srv3`,
      `https://video.google.com/timedtext?lang=en&v=${videoId}`,
    ];

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': '*/*',
          }
        });

        if (!response.ok) continue;

        const xml = await response.text();
        if (!xml || xml.length < 100) continue;

        // Parse XML
        const textMatches = xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g);
        const texts: string[] = [];

        for (const match of textMatches) {
          let text = match[1]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .replace(/\\n/g, ' ')
            .trim();
          if (text) texts.push(text);
        }

        const fullText = texts.join(' ').replace(/\s+/g, ' ').trim();

        if (fullText.length >= 50) {
          console.log(`[YouTube] Method 2 SUCCESS: ${fullText.length} characters`);
          return { text: fullText, hasTranscript: true, method: 'timedtext-api' };
        }
      } catch {
        continue;
      }
    }

    return { text: '', hasTranscript: false, error: 'All timedtext URLs failed' };
  } catch (error: any) {
    console.log(`[YouTube] Method 2 failed: ${error.message}`);
    return { text: '', hasTranscript: false, error: error.message };
  }
}

// Method 3: Scrape from video page (fallback)
async function fetchWithPageScraping(videoId: string): Promise<TranscriptResult> {
  const USER_AGENTS = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  ];

  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  try {
    console.log(`[YouTube] Method 3: Trying page scraping for ${videoId}`);

    // Fetch video page
    const videoPageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': userAgent,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
        'Cookie': 'CONSENT=YES+cb.20210328-17-p0.en+FX+111'
      }
    });

    if (!videoPageResponse.ok) {
      return { text: '', hasTranscript: false, error: 'Failed to fetch video page' };
    }

    const html = await videoPageResponse.text();

    // Check for CAPTCHA
    if (html.includes('class="g-recaptcha"')) {
      console.log('[YouTube] CAPTCHA detected');
      return { text: '', hasTranscript: false, error: 'YouTube requires CAPTCHA verification' };
    }

    // Extract caption tracks from ytInitialPlayerResponse
    const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\});/);
    if (!playerMatch) {
      return { text: '', hasTranscript: false, error: 'No player response in page' };
    }

    let playerResponse;
    try {
      playerResponse = JSON.parse(playerMatch[1]);
    } catch {
      return { text: '', hasTranscript: false, error: 'Failed to parse video data' };
    }

    const captions = playerResponse.captions?.playerCaptionsTracklistRenderer;
    if (!captions || !captions.captionTracks || captions.captionTracks.length === 0) {
      return { text: '', hasTranscript: false, error: 'No captions available for this video' };
    }

    // Find English track (prefer manual over auto-generated)
    let track = captions.captionTracks.find(
      (t: any) => t.languageCode === 'en' && t.kind !== 'asr'
    );
    if (!track) {
      track = captions.captionTracks.find((t: any) => t.languageCode === 'en');
    }
    if (!track) {
      track = captions.captionTracks[0];
    }

    console.log(`[YouTube] Found track: ${track.name?.simpleText || track.languageCode} (${track.kind || 'manual'})`);

    // Fetch transcript XML with modified URL (add fmt=json3 for better compatibility)
    const baseUrl = track.baseUrl;
    const transcriptUrl = baseUrl.includes('?')
      ? `${baseUrl}&fmt=json3`
      : `${baseUrl}?fmt=json3`;

    const transcriptResponse = await fetch(transcriptUrl, {
      headers: {
        'User-Agent': userAgent,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': '*/*',
        'Referer': `https://www.youtube.com/watch?v=${videoId}`
      }
    });

    const transcriptText = await transcriptResponse.text();
    console.log(`[YouTube] Method 3 response length: ${transcriptText.length}`);

    if (!transcriptText || transcriptText.length === 0) {
      return { text: '', hasTranscript: false, error: 'Empty transcript response' };
    }

    let fullText = '';

    // Try parsing as JSON first (json3 format)
    try {
      const jsonData = JSON.parse(transcriptText);
      if (jsonData.events) {
        fullText = jsonData.events
          .filter((e: any) => e.segs)
          .flatMap((e: any) => e.segs.map((s: any) => s.utf8 || ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    } catch {
      // Fall back to XML parsing
      const textMatches = transcriptText.matchAll(/<text[^>]*>([^<]*)<\/text>/g);
      const texts: string[] = [];

      for (const match of textMatches) {
        let text = match[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ')
          .replace(/\\n/g, ' ')
          .trim();
        if (text) texts.push(text);
      }

      fullText = texts.join(' ').replace(/\s+/g, ' ').trim();
    }

    if (fullText.length < 50) {
      return { text: '', hasTranscript: false, error: 'Transcript too short' };
    }

    console.log(`[YouTube] Method 3 SUCCESS: ${fullText.length} characters`);
    return { text: fullText, hasTranscript: true, method: 'page-scraping' };

  } catch (error: any) {
    console.log(`[YouTube] Method 3 failed: ${error.message}`);
    return { text: '', hasTranscript: false, error: error.message };
  }
}

// Main transcript fetcher - tries multiple methods
async function fetchYouTubeTranscript(videoId: string): Promise<TranscriptResult> {
  console.log(`[YouTube] Starting transcript fetch for: ${videoId}`);

  // Method 1: youtube-transcript package (most reliable)
  let result = await fetchWithYoutubeTranscriptPackage(videoId);
  if (result.hasTranscript) return result;

  // Method 2: Direct timedtext API
  result = await fetchWithTimedTextAPI(videoId);
  if (result.hasTranscript) return result;

  // Method 3: Page scraping (fallback)
  result = await fetchWithPageScraping(videoId);
  if (result.hasTranscript) return result;

  // All methods failed
  console.log(`[YouTube] All methods failed for ${videoId}`);
  return {
    text: '',
    hasTranscript: false,
    error: 'Unable to fetch transcript. The video may not have captions, or YouTube is blocking access.'
  };
}

// Extract detailed video metadata from YouTube page for fallback content
interface VideoMetadata {
  title: string;
  description: string;
  channelName: string;
  duration: string;
  viewCount: string;
  publishDate: string;
  category: string;
  keywords: string[];
}

async function fetchVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': 'CONSENT=YES+cb.20210328-17-p0.en+FX+111'
      }
    });

    if (!response.ok) return null;

    const html = await response.text();

    // Extract ytInitialPlayerResponse
    const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\});/);
    if (!playerMatch) return null;

    const player = JSON.parse(playerMatch[1]);
    const videoDetails = player.videoDetails || {};
    const microformat = player.microformat?.playerMicroformatRenderer || {};

    // Extract ytInitialData for more details
    const initialDataMatch = html.match(/var ytInitialData = (\{[\s\S]+?\});/);
    let description = videoDetails.shortDescription || '';

    if (initialDataMatch) {
      try {
        const initialData = JSON.parse(initialDataMatch[1]);
        // Try to get full description from engagement panels
        const panels = initialData.engagementPanels || [];
        for (const panel of panels) {
          const content = panel.engagementPanelSectionListRenderer?.content;
          const descBody = content?.structuredDescriptionContentRenderer?.items;
          if (descBody) {
            for (const item of descBody) {
              if (item.expandableVideoDescriptionBodyRenderer?.descriptionBodyText?.runs) {
                description = item.expandableVideoDescriptionBodyRenderer.descriptionBodyText.runs
                  .map((r: any) => r.text)
                  .join('');
                break;
              }
            }
          }
        }
      } catch {
        // Use default description
      }
    }

    return {
      title: videoDetails.title || '',
      description: description,
      channelName: videoDetails.author || microformat.ownerChannelName || '',
      duration: formatDuration(parseInt(videoDetails.lengthSeconds || '0')),
      viewCount: formatViewCount(parseInt(videoDetails.viewCount || '0')),
      publishDate: microformat.publishDate || '',
      category: microformat.category || '',
      keywords: videoDetails.keywords || [],
    };
  } catch (error) {
    console.error('[YouTube] Failed to fetch metadata:', error);
    return null;
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

function formatViewCount(views: number): string {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  } else if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
}

// Generate study-friendly content from video metadata when transcript unavailable
function generateMetadataBasedContent(metadata: VideoMetadata, videoUrl: string): string {
  const parts: string[] = [];

  parts.push(`# ${metadata.title}`);
  parts.push('');
  parts.push(`**Channel:** ${metadata.channelName}`);
  parts.push(`**Duration:** ${metadata.duration}`);
  if (metadata.publishDate) {
    parts.push(`**Published:** ${metadata.publishDate}`);
  }
  if (metadata.viewCount) {
    parts.push(`**Views:** ${metadata.viewCount}`);
  }
  if (metadata.category) {
    parts.push(`**Category:** ${metadata.category}`);
  }
  parts.push('');

  if (metadata.description && metadata.description.length > 50) {
    parts.push('## Video Description');
    parts.push('');
    parts.push(metadata.description);
    parts.push('');
  }

  if (metadata.keywords && metadata.keywords.length > 0) {
    parts.push('## Key Topics');
    parts.push('');
    const topKeywords = metadata.keywords.slice(0, 15);
    parts.push(topKeywords.map(k => `- ${k}`).join('\n'));
    parts.push('');
  }

  parts.push('---');
  parts.push('');
  parts.push('**Note:** Full transcript could not be extracted from this video.');
  parts.push('The AI will generate study materials based on the video title, description, and metadata.');
  parts.push('');
  parts.push(`**Source:** ${videoUrl}`);

  return parts.join('\n');
}

// Initialize Gemini lazily for OCR/text extraction
function getGeminiModel() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_NOT_CONFIGURED");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
}

// Retry helper with exponential backoff for rate limits
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  baseDelayMs: number = 3000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if it's a rate limit error
      const isRateLimit =
        error?.status === 429 ||
        error?.message?.includes("429") ||
        error?.message?.includes("Resource exhausted") ||
        error?.message?.includes("Too Many Requests");

      if (!isRateLimit || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: 3s, 6s (faster than before, max 2 retries)
      const delay = baseDelayMs * Math.pow(2, attempt);
      console.log(`[Retry] Rate limited, waiting ${delay}ms before retry ${attempt + 1}/${maxRetries}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 10 requests per minute per user
    const rateLimitResponse = await applyRateLimit(request, "aiGeneration", user.id);
    if (rateLimitResponse) return rateLimitResponse;

    let model;
    try {
      model = getGeminiModel();
    } catch {
      // Model is optional for YouTube transcript (only used for title generation)
      // Will be required for PDF/image processing
      model = null;
    }

    const contentType = request.headers.get("content-type") || "";

    // Handle JSON body (YouTube)
    if (contentType.includes("application/json")) {
      const rawBody = await request.json();

      const { z } = await import("zod");
      const schema = z.object({
        type: z.enum(["youtube"]),
        url: z.string().url().optional(),
        videoId: z.string().max(50).optional(),
      });

      const parsed = schema.safeParse(rawBody);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid input", details: parsed.error.issues },
          { status: 400 }
        );
      }

      const { type, url, videoId } = parsed.data;

      if (type === "youtube") {
        // Extract video ID from various YouTube URL formats (declare outside try for catch access)
        let extractedVideoId = videoId;
        if (!extractedVideoId && url) {
          const urlObj = new URL(url);
          if (urlObj.hostname.includes("youtu.be")) {
            extractedVideoId = urlObj.pathname.slice(1);
          } else {
            extractedVideoId = urlObj.searchParams.get("v") || "";
          }
        }

        if (!extractedVideoId) {
          return NextResponse.json(
            { error: "Could not extract video ID from URL" },
            { status: 400 }
          );
        }

        // Log for debugging
        console.log("[YouTube] Fetching transcript for videoId:", extractedVideoId, "from URL:", url);

        // First, get the actual video title from YouTube oEmbed API
        const actualVideoTitle = await getYouTubeVideoTitle(extractedVideoId);
        console.log("[YouTube] Actual video title from oEmbed:", actualVideoTitle);

        // Fetch transcript using our custom fetcher (more reliable than youtube-transcript library)
        const transcriptResult = await fetchYouTubeTranscript(extractedVideoId);
        console.log("[YouTube] Transcript result:", {
          hasTranscript: transcriptResult.hasTranscript,
          length: transcriptResult.text.length,
          method: transcriptResult.method,
          error: transcriptResult.error
        });

        if (!transcriptResult.hasTranscript || transcriptResult.text.length < 50) {
          console.log("[YouTube] Transcript unavailable, fetching detailed metadata for fallback...");

          // Fetch detailed metadata for better AI-generated content
          const metadata = await fetchVideoMetadata(extractedVideoId);

          if (metadata && (metadata.description.length > 100 || metadata.keywords.length > 3)) {
            // Generate rich content from metadata
            const metadataContent = generateMetadataBasedContent(metadata, url || `https://www.youtube.com/watch?v=${extractedVideoId}`);

            console.log("[YouTube] Using metadata fallback. Description length:", metadata.description.length, "Keywords:", metadata.keywords.length);

            return NextResponse.json({
              success: true,
              text: metadataContent,
              title: metadata.title || actualVideoTitle || `YouTube Video: ${extractedVideoId}`,
              hasTranscript: false,
              usingMetadataFallback: true,
              videoId: extractedVideoId,
            });
          }

          // Minimal fallback if metadata also unavailable
          let noteMessage = "Note: Could not fetch transcript.";
          if (transcriptResult.error?.includes("blocking")) {
            noteMessage = "Note: YouTube is temporarily blocking transcript access from our servers.";
          } else if (transcriptResult.error?.includes("No captions")) {
            noteMessage = "Note: This video does not have captions/subtitles available.";
          } else if (transcriptResult.error?.includes("CAPTCHA")) {
            noteMessage = "Note: YouTube is requiring verification. Please try again later.";
          }

          return NextResponse.json({
            success: true,
            text: `YouTube Video: ${actualVideoTitle || url}\n\n${noteMessage}\n\nAlternative: Take notes while watching the video and upload them as images or PDFs for AI processing.`,
            title: actualVideoTitle || `YouTube Video: ${extractedVideoId}`,
            hasTranscript: false,
            videoId: extractedVideoId,
          });
        }

        // Use actual video title from oEmbed, or generate from transcript
        let videoTitle = actualVideoTitle;
        if (!videoTitle) {
          const firstSentence = transcriptResult.text.split(/[.!?]\s/)[0] || "";
          videoTitle = firstSentence.length > 60
            ? firstSentence.slice(0, 57) + "..."
            : firstSentence || `YouTube Video: ${extractedVideoId}`;
        }

        console.log("[YouTube] Successfully fetched transcript. Title:", videoTitle, "Length:", transcriptResult.text.length);

        return NextResponse.json({
          success: true,
          text: transcriptResult.text,
          title: videoTitle,
          hasTranscript: true,
          videoId: extractedVideoId,
        });
      }

      return NextResponse.json(
        { error: "Invalid content type for JSON body" },
        { status: 400 }
      );
    }

    // Handle FormData (PDF, Image)
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!model) {
      return NextResponse.json(
        { error: "AI service is not configured. Please contact support." },
        { status: 503 }
      );
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = file.type;

    if (type === "pdf") {
      // Enhanced PDF extraction with multiple strategies
      // Strategy 1: Direct PDF text extraction with improved prompt
      const textExtractionPrompt = `You are extracting text from a PDF document for educational study purposes.

IMPORTANT: This may be a textbook, study material, or educational document. Extract ALL readable text content.

Instructions:
1. Extract ALL text content from every page
2. For diagrams/figures: Describe what they show and include any labels or captions
3. For equations/formulas: Write them out in text form (e.g., "E = mc²")
4. For tables: Format as readable text with clear column separation
5. Preserve chapter titles, section headings, and subheadings
6. Include numbered lists, bullet points, and definitions
7. If text is in columns, read left-to-right, top-to-bottom

Return ONLY the extracted text content. Do not add commentary like "Here is the extracted text" - just return the content directly.

If you cannot read any text from this document, respond with exactly: "NO_TEXT_EXTRACTED"`;

      let extractedText = "";
      let extractionMethod = "direct";

      // Try Strategy 1: Direct PDF extraction with retry
      try {
        console.log(`[PDF Extract] Attempting direct extraction for: ${file.name}`);
        const result = await withRetry(async () => {
          return await model.generateContent([
            textExtractionPrompt,
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64,
              },
            },
          ]);
        });

        extractedText = result.response.text().trim();
        console.log(`[PDF Extract] Direct extraction returned ${extractedText.length} characters`);

        // Check if extraction actually got content
        if (extractedText === "NO_TEXT_EXTRACTED" || extractedText.length < 50) {
          console.log("[PDF Extract] Direct extraction returned insufficient content, trying vision approach");
          extractedText = ""; // Reset to trigger fallback
        }
      } catch (directError: any) {
        console.error("[PDF Extract] Direct extraction failed:", directError);

        // Check for rate limit error (after all retries exhausted)
        if (directError?.status === 429 || directError?.message?.includes("429") || directError?.message?.includes("Resource exhausted")) {
          return NextResponse.json({
            success: false,
            error: "AI service is busy. Please wait a few minutes and try again.",
            code: "RATE_LIMITED",
            fileName: file.name,
          });
        }

        extractedText = "";
      }

      // Strategy 2: If direct extraction failed, try treating PDF as images (vision-based OCR)
      if (!extractedText || extractedText.length < 50) {
        try {
          console.log("[PDF Extract] Attempting vision-based extraction");
          extractionMethod = "vision";

          const visionPrompt = `This is a PDF document shown as images. Please extract ALL text content visible in these pages.

This appears to be educational/study material. Extract:
- All readable text, headings, and paragraphs
- Content from any diagrams (describe what they show)
- Formulas and equations (write them in text form)
- Table content (format as readable text)
- Figure captions and labels

Return ONLY the extracted text. If you cannot read any text, respond with: "NO_TEXT_EXTRACTED"`;

          const visionResult = await withRetry(async () => {
            return await model.generateContent([
              visionPrompt,
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: base64,
                },
              },
            ]);
          });

          extractedText = visionResult.response.text().trim();
          console.log(`[PDF Extract] Vision extraction returned ${extractedText.length} characters`);
        } catch (visionError: any) {
          console.error("[PDF Extract] Vision extraction also failed:", visionError);

          // Check for rate limit error (after all retries exhausted)
          if (visionError?.status === 429 || visionError?.message?.includes("429") || visionError?.message?.includes("Resource exhausted")) {
            return NextResponse.json({
              success: false,
              error: "AI service is busy. Please wait a few minutes and try again.",
              code: "RATE_LIMITED",
              fileName: file.name,
            });
          }
        }
      }

      // Final validation
      if (!extractedText || extractedText === "NO_TEXT_EXTRACTED" || extractedText.length < 50) {
        console.log(`[PDF Extract] All extraction methods failed for: ${file.name}`);
        return NextResponse.json({
          success: false,
          error: "Could not extract text from this PDF. It may be scanned, image-based, or have copy protection. Try uploading screenshots of individual pages as images instead.",
          fileName: file.name,
        });
      }

      console.log(`[PDF Extract] Success via ${extractionMethod}: ${extractedText.length} chars from ${file.name}`);
      return NextResponse.json({
        success: true,
        text: extractedText,
        fileName: file.name,
        extractionMethod,
      });
    }

    if (type === "image") {
      // For images, use Gemini Vision to extract text (OCR)
      const prompt = `Extract ALL text content from this image using OCR.

If this is:
- A document or notes: Extract all readable text
- A diagram or chart: Describe the content and any labels
- A screenshot: Extract all visible text
- Handwritten notes: Transcribe the handwriting as accurately as possible

Return ONLY the extracted text content, no additional commentary.`;

      try {
        const result = await withRetry(async () => {
          return await model.generateContent([
            prompt,
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
          ]);
        });

        const extractedText = result.response.text();

        return NextResponse.json({
          success: true,
          text: extractedText,
          fileName: file.name,
        });
      } catch (error: any) {
        console.error("Image OCR error:", error);

        // Check for rate limit error (after all retries exhausted)
        if (error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("Resource exhausted")) {
          return NextResponse.json({
            success: false,
            error: "AI service is busy. Please wait a few minutes and try again.",
            code: "RATE_LIMITED",
            fileName: file.name,
          });
        }

        // Return failure so UI doesn't show "Text extracted" for failed extractions
        return NextResponse.json({
          success: false,
          error: "Could not extract text from image. The image may be unclear or contain no readable text. Try uploading a clearer image.",
          fileName: file.name,
        });
      }
    }

    return NextResponse.json(
      { error: "Unsupported content type" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Parse content error:", error);
    return NextResponse.json(
      { error: "Failed to parse content" },
      { status: 500 }
    );
  }
}
