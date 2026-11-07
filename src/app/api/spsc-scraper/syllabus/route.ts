import crypto from "crypto";
import https from "https";
import { NextResponse } from "next/server";

import { extractPdfTextFromBase64 } from "@/lib/gemini";
import { parseSyllabusText } from "@/lib/spsc/syllabus-parser";

export const dynamic = "force-dynamic";
export const revalidate = 3600;
export const maxDuration = 60;

interface SyllabusRequestBody {
  examTitle?: string;
  pdfUrl?: string;
}

interface CachedSyllabusResult {
  pdfHash: string;
  parsedAt: string;
  extractedTextHash: string;
  extractionMethod: "direct" | "vision";
  result: ReturnType<typeof parseSyllabusText>;
}

const PDF_CACHE_TTL = 60 * 60 * 1000;
const syllabusCache = new Map<string, { timestamp: number; value: CachedSyllabusResult }>();

function fetchPdfBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { rejectUnauthorized: false }, (res) => {
      if (!res.statusCode || res.statusCode >= 400) {
        reject(new Error(`Failed to fetch PDF: ${res.statusCode || "unknown status"}`));
        return;
      }

      const chunks: Buffer[] = [];
      res.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      res.on("end", () => {
        const rawContentType = res.headers["content-type"];
        resolve({
          buffer: Buffer.concat(chunks),
          contentType: Array.isArray(rawContentType) ? rawContentType[0] : rawContentType || "application/pdf",
        });
      });
    });

    req.on("error", reject);
    req.setTimeout(20000, () => {
      req.destroy();
      reject(new Error("Timeout while fetching syllabus PDF"));
    });
  });
}

function getCachedSyllabus(pdfUrl: string, pdfHash: string) {
  const cached = syllabusCache.get(pdfUrl);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > PDF_CACHE_TTL) {
    syllabusCache.delete(pdfUrl);
    return null;
  }
  if (cached.value.pdfHash !== pdfHash) {
    return null;
  }
  return cached.value;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SyllabusRequestBody;
    const examTitle = body.examTitle?.trim();
    const pdfUrl = body.pdfUrl?.trim();

    if (!examTitle || !pdfUrl) {
      return NextResponse.json(
        { error: "examTitle and pdfUrl are required" },
        { status: 400 }
      );
    }

    const { buffer, contentType } = await fetchPdfBuffer(pdfUrl);
    const pdfHash = crypto.createHash("sha256").update(buffer).digest("hex");
    const cached = getCachedSyllabus(pdfUrl, pdfHash);

    if (cached) {
      return NextResponse.json({
        examTitle,
        pdfUrl,
        cacheHit: true,
        ...cached,
      });
    }

    const extraction = await extractPdfTextFromBase64({
      base64: buffer.toString("base64"),
      fileName: pdfUrl.split("/").pop(),
      mimeType: contentType,
    });

    const result = parseSyllabusText({
      examTitle,
      text: extraction.text,
    });

    const payload: CachedSyllabusResult = {
      pdfHash,
      parsedAt: new Date().toISOString(),
      extractedTextHash: result.contentHash,
      extractionMethod: extraction.extractionMethod,
      result,
    };

    syllabusCache.set(pdfUrl, {
      timestamp: Date.now(),
      value: payload,
    });

    return NextResponse.json({
      examTitle,
      pdfUrl,
      cacheHit: false,
      ...payload,
    });
  } catch (error) {
    console.error("[spsc-scraper/syllabus] parse failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to parse syllabus PDF",
      },
      { status: 500 }
    );
  }
}
