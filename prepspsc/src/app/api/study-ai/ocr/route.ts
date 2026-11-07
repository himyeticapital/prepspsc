import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini lazily for OCR
// Uses gemini-2.0-flash for fast OCR (just transcription, speed matters more than reasoning)
function getGeminiModel() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_NOT_CONFIGURED");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
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

    // Check if user is Pro (bypass in development)
    const isDev = process.env.NODE_ENV === "development";
    if (!isDev) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_pro_member")
        .eq("id", user.id)
        .single();

      if (!profile?.is_pro_member) {
        return NextResponse.json(
          {
            error: "Pro feature",
            code: "PRO_REQUIRED",
            message: "Paper Blurt is a Pro-only feature",
          },
          { status: 403 }
        );
      }
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload an image." },
        { status: 400 }
      );
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = file.type;

    // OCR prompt for handwritten notes
    const prompt = `You are an expert at reading handwritten text. This is a photo of handwritten notes from a student practicing active recall.

Carefully transcribe ALL the handwritten text in this image:
1. Preserve the original structure (bullet points, numbered lists, paragraphs)
2. Include headings and subheadings if present
3. Transcribe abbreviations as they appear
4. If any word is unclear, make your best guess based on context
5. Indicate illegible portions with [illegible]

Return ONLY the transcribed text, maintaining the original formatting as much as possible.`;

    let model;
    try {
      model = getGeminiModel();
    } catch {
      return NextResponse.json(
        { error: "AI service is not configured. Please contact support." },
        { status: 503 }
      );
    }

    try {
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType,
            data: base64,
          },
        },
      ]);

      const transcribedText = result.response.text();

      return NextResponse.json({
        success: true,
        text: transcribedText,
      });
    } catch (ocrError) {
      console.error("OCR error:", ocrError);
      return NextResponse.json(
        { error: "Failed to process image. Please try with a clearer photo." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Paper Blurt OCR error:", error);
    return NextResponse.json(
      { error: "Failed to process image" },
      { status: 500 }
    );
  }
}
