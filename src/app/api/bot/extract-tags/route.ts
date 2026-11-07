/**
 * Extract Tags API
 * Uses AI to extract relevant study tags from note content
 */

import { NextResponse } from "next/server";
import { extractNoteTags } from "@/lib/bot/ai";

export async function POST(request: Request) {
  try {
    const { content } = await request.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const tags = await extractNoteTags(content);

    return NextResponse.json({ tags });
  } catch (error) {
    console.error("Tag extraction error:", error);
    return NextResponse.json(
      { error: "Failed to extract tags", tags: [] },
      { status: 500 }
    );
  }
}
