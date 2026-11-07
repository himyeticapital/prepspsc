import { hasProAccess } from "@/lib/access";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GuidedLearningSessionRow, GuidedLearningMessageRow } from "@/lib/guided-learning/types";

export const dynamic = "force-dynamic";

// GET - List sessions or get active session for context
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const goalId = searchParams.get("goalId");
    const planId = searchParams.get("planId");
    const subject = searchParams.get("subject");
    const status = searchParams.get("status") || "active";
    const includeMessages = searchParams.get("includeMessages") === "true";

    let query = supabase
      .from("guided_learning_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    // Filter by context
    if (goalId) {
      query = query.eq("goal_id", parseInt(goalId));
    }

    if (planId && subject) {
      query = query.eq("planner_plan_id", planId).eq("subject", subject);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error("Error fetching sessions:", error);
      return NextResponse.json(
        { error: "Failed to fetch sessions" },
        { status: 500 }
      );
    }

    // If includeMessages and we have sessions, fetch messages for the first one
    if (includeMessages && sessions && sessions.length > 0) {
      const sessionId = sessions[0].id;

      const { data: messages } = await supabase
        .from("guided_learning_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      return NextResponse.json({
        sessions: sessions as GuidedLearningSessionRow[],
        messages: (messages || []) as GuidedLearningMessageRow[],
      });
    }

    return NextResponse.json({
      sessions: sessions as GuidedLearningSessionRow[],
    });
  } catch (error) {
    console.error("Sessions list error:", error);
    return NextResponse.json(
      { error: "Failed to list sessions" },
      { status: 500 }
    );
  }
}

// POST - Create a new session (alternative to creating via chat)
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
    const { goalId, plannerContext } = body;

    if (!goalId && !plannerContext) {
      return NextResponse.json(
        { error: "goalId or plannerContext is required" },
        { status: 400 }
      );
    }

    // Get user profile to check pro status
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro_member, guided_sessions_today, guided_sessions_last_date")
      .eq("id", user.id)
      .single();

    const isPro = hasProAccess(profile);
    const today = new Date().toISOString().split("T")[0];
    const FREE_SESSIONS_PER_DAY = 3;

    // Check rate limits for free users
    if (!isPro) {
      const sessionsToday = profile?.guided_sessions_last_date === today
        ? (profile?.guided_sessions_today || 0)
        : 0;

      if (sessionsToday >= FREE_SESSIONS_PER_DAY) {
        return NextResponse.json(
          {
            error: "Daily limit reached",
            message: `Free users can start ${FREE_SESSIONS_PER_DAY} guided learning sessions per day.`,
          },
          { status: 429 }
        );
      }
    }

    // Get subject/topics from context
    let subject = plannerContext?.subject || "";
    let topics = plannerContext?.topics || [];
    let examType = plannerContext?.examType || "upsc";

    if (goalId) {
      const { data: goal } = await supabase
        .from("study_ai_goals")
        .select("goal_text")
        .eq("id", goalId)
        .eq("user_id", user.id)
        .single();

      if (goal) {
        subject = "General Studies";
        topics = [goal.goal_text];
      }
    }

    // Create session
    const { data: session, error: createError } = await supabase
      .from("guided_learning_sessions")
      .insert({
        user_id: user.id,
        goal_id: goalId || null,
        planner_plan_id: plannerContext?.planId || null,
        subject,
        topics,
        exam_type: examType,
        status: "active",
        concepts_mastered: [],
        concepts_struggling: [],
        total_exchanges: 0,
        checkpoints_passed: 0,
        checkpoints_total: 0,
      })
      .select()
      .single();

    if (createError || !session) {
      console.error("Error creating session:", createError);
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }

    // Update rate limit counters for free users
    if (!isPro) {
      const newCount = profile?.guided_sessions_last_date === today
        ? (profile?.guided_sessions_today || 0) + 1
        : 1;

      await supabase
        .from("profiles")
        .update({
          guided_sessions_today: newCount,
          guided_sessions_last_date: today,
        })
        .eq("id", user.id);
    }

    return NextResponse.json({
      session: session as GuidedLearningSessionRow,
    });
  } catch (error) {
    console.error("Session creation error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
