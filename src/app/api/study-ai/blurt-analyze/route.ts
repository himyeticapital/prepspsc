import { AI_MODELS } from "@/lib/ai-models";
import { hasProAccess } from "@/lib/access";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { applyRateLimit } from "@/lib/rate-limit";

// Initialize Gemini lazily
// Uses gemini-3.1-flash-lite-preview for fast analysis (simpler task, speed matters)
function getGeminiModel() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_NOT_CONFIGURED");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: AI_MODELS.basic });
}

const BLURT_XP = {
  BASE: 15,
  SCORE_90_PLUS: 25,
  SCORE_80_PLUS: 20,
  SCORE_60_PLUS: 15,
  SCORE_40_PLUS: 10,
};

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

    const { goalId, goalText, sourceContent, userInput, mode } = await request.json();

    if (!userInput?.trim() || !goalText?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify user owns the goal (only if goalId is provided)
    if (goalId) {
      const { data: goal, error: goalError } = await supabase
        .from("study_ai_goals")
        .select("id, user_id, revision_count")
        .eq("id", goalId)
        .single();

      if (goalError || !goal || goal.user_id !== user.id) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }
    }

    // Build the analysis prompt
    const sourceSection = sourceContent?.trim()
      ? `ORIGINAL SOURCE CONTENT:\n${sourceContent.slice(0, 10000)}\n\nIMPORTANT: First check if the source content above is actually relevant to the study topic "${goalText}". If the source content is NOT related to the topic (e.g., it's about something else entirely), IGNORE the source content and evaluate the student's response based on generally accepted knowledge about "${goalText}" instead. Only compare against the source content if it is genuinely about the same topic.`
      : `No specific source material was provided. Evaluate the student's response based on generally accepted knowledge about "${goalText}". Focus on key concepts, definitions, relationships, and important facts. Be fair in scoring since the student may have learned from different sources.`;

    // Calculate approximate word count for scoring adjustment
    const wordCount = userInput.trim().split(/\s+/).length;

    const prompt = `You are a STRICT examiner analyzing a student's active recall exercise. Your job is to be rigorous and fair - not generous.

STUDY TOPIC: ${goalText}

${sourceSection}

STUDENT'S BLURTED RESPONSE (${wordCount} words):
${userInput}

CRITICAL EVALUATION RULES:
1. COUNT ONLY SPECIFIC, DETAILED POINTS as "matched". Vague statements like "Sikkim is a state" or "it has culture" do NOT count as recalled knowledge.
2. A "matched point" must contain SPECIFIC information: names, dates, numbers, proper nouns, or detailed explanations.
3. Short responses (under 100 words) CANNOT score above 60% regardless of accuracy - depth matters.
4. Medium responses (100-200 words) are CAPPED at 75% unless exceptionally detailed.
5. Only responses with 200+ words AND comprehensive coverage can score 80%+.
6. To score 90%+, the student must demonstrate THOROUGH understanding with specific facts, examples, and connections.

WORD COUNT PENALTY:
- Under 50 words: Maximum possible score is 40%
- 50-100 words: Maximum possible score is 60%
- 100-200 words: Maximum possible score is 75%
- 200-350 words: Maximum possible score is 85%
- 350+ words with depth: Can achieve 90%+

Return ONLY valid JSON (no markdown, no code blocks):
{
  "score": <number 0-100 - BE STRICT, most responses should score 40-70%>,
  "matchedPoints": [<ONLY specific, detailed points - NOT vague statements>],
  "missedConcepts": [<important concepts the student forgot - be comprehensive here>],
  "corrections": [<factual errors or misconceptions>],
  "feedback": "<2-3 sentences - be constructive but honest about gaps. Mention what specific details were missing.>"
}

STRICT SCORING RUBRIC:
- 90-100: RARE - Requires 350+ words, comprehensive coverage, specific facts/dates/names, no major gaps
- 80-89: UNCOMMON - Requires 200+ words, most key concepts with specific details, minor gaps only
- 70-79: AVERAGE GOOD - 150+ words, solid coverage but missing some specifics
- 60-69: FAIR - Some correct information but lacks depth or specificity
- 50-59: BASIC - Superficial coverage, mostly general statements
- 40-49: WEAK - Very limited recall, vague points
- 0-39: POOR - Major gaps, errors, or near-empty response

Remember: A student who writes 3 sentences about a complex topic should NOT score above 50%, even if those sentences are technically correct. Active recall requires DEPTH, not just surface-level accuracy.`;

    // Generate analysis
    const model = getGeminiModel();
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Clean and parse JSON response
    const cleanedText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    let analysis;
    try {
      analysis = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", cleanedText.slice(0, 500));
      return NextResponse.json(
        { error: "Failed to analyze response. Please try again." },
        { status: 500 }
      );
    }

    // Calculate XP based on score
    let xpEarned = BLURT_XP.BASE;
    if (analysis.score >= 90) {
      xpEarned = BLURT_XP.SCORE_90_PLUS;
    } else if (analysis.score >= 80) {
      xpEarned = BLURT_XP.SCORE_80_PLUS;
    } else if (analysis.score >= 60) {
      xpEarned = BLURT_XP.SCORE_60_PLUS;
    } else if (analysis.score >= 40) {
      xpEarned = BLURT_XP.SCORE_40_PLUS;
    }

    // Check if user is Pro for XP multiplier
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro_member, xp_points")
      .eq("id", user.id)
      .single();

    const isPro = hasProAccess(profile);
    const finalXp = isPro ? Math.floor(xpEarned * 1.5) : xpEarned;

    // Save blurt session to database
    const { data: blurtSession, error: insertError } = await supabase
      .from("blurt_sessions")
      .insert({
        user_id: user.id,
        goal_id: goalId || null,
        topic: goalText,
        mode: mode || "digital",
        user_input: userInput,
        ai_analysis: analysis,
        score: analysis.score,
        xp_earned: finalXp,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to save blurt session:", insertError);
      // Continue even if save fails - still return analysis
    }

    // Award XP
    await supabase.from("xp_transactions").insert({
      user_id: user.id,
      amount: finalXp,
      reason: "blurt_session",
      multiplier: isPro ? 1.5 : 1,
      reference_id: blurtSession?.id?.toString() || null,
    });

    // Update profile XP
    if (profile) {
      const newXP = (profile.xp_points || 0) + finalXp;
      await supabase
        .from("profiles")
        .update({ xp_points: newXP })
        .eq("id", user.id);
    }

    // Update goal's last revised date (only if linked to a goal)
    if (goalId) {
      const { data: goalData } = await supabase
        .from("study_ai_goals")
        .select("revision_count")
        .eq("id", goalId)
        .single();

      await supabase
        .from("study_ai_goals")
        .update({
          last_revised_at: new Date().toISOString(),
          revision_count: (goalData?.revision_count || 0) + 1,
        })
        .eq("id", goalId);
    }

    return NextResponse.json({
      success: true,
      analysis,
      xpEarned: finalXp,
      sessionId: blurtSession?.id,
    });
  } catch (error) {
    console.error("Blurt analyze error:", error);
    return NextResponse.json(
      { error: "Failed to analyze response" },
      { status: 500 }
    );
  }
}
