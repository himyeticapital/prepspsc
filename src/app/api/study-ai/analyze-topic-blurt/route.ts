import { AI_MODELS } from "@/lib/ai-models";
import { hasProAccess } from "@/lib/access";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_NOT_CONFIGURED");
  }
  return new GoogleGenerativeAI(apiKey);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { subject, topics, examType, userInput } = body;

    if (!subject || !topics || !userInput) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const prompt = `You are an expert ${examType === "sikkim-psc" ? "Sikkim PSC" : "UPSC"} educator analyzing a student's active recall attempt.

TOPIC: ${subject} - ${topics.join(", ")}

STUDENT'S BLURT (what they wrote from memory):
---
${userInput}
---

Analyze their knowledge:
1. What did they get RIGHT? (things that are factually correct)
2. What GAPS exist? (important things they missed or got wrong)
3. Give a score from 0-100 based on completeness and accuracy
4. Provide a suggestion for improvement

Return ONLY valid JSON:
{
  "score": 75,
  "strengths": ["Correctly mentioned X", "Good understanding of Y"],
  "gaps": ["Missed important point about Z", "Incorrect date for event"],
  "suggestions": "Focus on reviewing the timeline of events and specific names."
}`;

    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: AI_MODELS.basic,
      generationConfig: {
        temperature: 0.5,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Clean and parse JSON
    let cleanedText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const jsonStartIndex = cleanedText.indexOf("{");
    if (jsonStartIndex > 0) {
      cleanedText = cleanedText.slice(jsonStartIndex);
    }

    let analysis;
    try {
      analysis = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse analysis:", cleanedText.slice(0, 200));
      return NextResponse.json(
        { error: "Failed to analyze. Please try again." },
        { status: 500 }
      );
    }

    // Award XP for completing a blurt session
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro_member, xp_points")
      .eq("id", user.id)
      .single();

    const isPro = hasProAccess(profile);
    const xpAmount = isPro ? 15 : 10;

    await supabase.from("xp_transactions").insert({
      user_id: user.id,
      amount: xpAmount,
      reason: "topic_blurt_session",
      multiplier: isPro ? 1.5 : 1,
    });

    if (profile) {
      await supabase
        .from("profiles")
        .update({ xp_points: (profile.xp_points || 0) + xpAmount })
        .eq("id", user.id);
    }

    return NextResponse.json({
      success: true,
      analysis,
      xpEarned: xpAmount,
    });
  } catch (error: any) {
    console.error("Analyze blurt error:", error);
    return NextResponse.json(
      { error: "Failed to analyze. Please try again." },
      { status: 500 }
    );
  }
}
