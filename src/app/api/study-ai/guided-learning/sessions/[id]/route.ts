import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type {
  GuidedLearningSessionRow,
  GuidedLearningMessageRow,
  SessionResult,
} from "@/lib/guided-learning/types";

export const dynamic = "force-dynamic";

// GET - Get session details with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = parseInt(id);
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from("guided_learning_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Fetch messages
    const { data: messages } = await supabase
      .from("guided_learning_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      session: session as GuidedLearningSessionRow,
      messages: (messages || []) as GuidedLearningMessageRow[],
    });
  } catch (error) {
    console.error("Get session error:", error);
    return NextResponse.json(
      { error: "Failed to get session" },
      { status: 500 }
    );
  }
}

// PATCH - Update session (complete or abandon)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = parseInt(id);
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body; // "complete" or "abandon"

    if (!["complete", "abandon"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Use 'complete' or 'abandon'" },
        { status: 400 }
      );
    }

    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from("guided_learning_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.status !== "active") {
      return NextResponse.json(
        { error: "Session is not active" },
        { status: 400 }
      );
    }

    const newStatus = action === "complete" ? "completed" : "abandoned";

    // Calculate final understanding score
    const understandingScore = session.checkpoints_total > 0
      ? Math.round((session.checkpoints_passed / session.checkpoints_total) * 100)
      : session.total_exchanges > 0 ? 50 : 0; // Default to 50% if no checkpoints but had exchanges

    // Update session
    const { data: updatedSession, error: updateError } = await supabase
      .from("guided_learning_sessions")
      .update({
        status: newStatus,
        completed_at: new Date().toISOString(),
        understanding_score: understandingScore,
      })
      .eq("id", sessionId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating session:", updateError);
      return NextResponse.json(
        { error: "Failed to update session" },
        { status: 500 }
      );
    }

    // If completing and goal_id exists, update the goal's Leitner box
    if (action === "complete" && session.goal_id) {
      await updateGoalFromSession(supabase, user.id, session.goal_id, {
        sessionId: session.id,
        userId: user.id,
        goalId: session.goal_id,
        conceptsMastered: session.concepts_mastered || [],
        conceptsStruggling: session.concepts_struggling || [],
        understandingScore,
        totalExchanges: session.total_exchanges,
        checkpointsPassed: session.checkpoints_passed,
        checkpointsTotal: session.checkpoints_total,
      });
    }

    // Award XP for completion
    if (action === "complete") {
      const xpAmount = Math.max(10, Math.floor(understandingScore / 10) * 5); // 10-50 XP

      await supabase.from("xp_transactions").insert({
        user_id: user.id,
        amount: xpAmount,
        reason: "guided_learning_complete",
        reference_id: `guided_session_${session.id}`,
      });

      // Update profile XP
      await supabase.rpc("increment_xp", {
        user_id: user.id,
        xp_amount: xpAmount,
      });
    }

    const result: SessionResult = {
      sessionId: session.id,
      userId: user.id,
      goalId: session.goal_id,
      conceptsMastered: session.concepts_mastered || [],
      conceptsStruggling: session.concepts_struggling || [],
      understandingScore,
      totalExchanges: session.total_exchanges,
      checkpointsPassed: session.checkpoints_passed,
      checkpointsTotal: session.checkpoints_total,
    };

    return NextResponse.json({
      session: updatedSession as GuidedLearningSessionRow,
      result,
    });
  } catch (error) {
    console.error("Update session error:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}

// Helper to update goal's Leitner box based on session result
async function updateGoalFromSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  goalId: number,
  sessionResult: SessionResult
) {
  try {
    // Fetch current goal state
    const { data: goal } = await supabase
      .from("study_ai_goals")
      .select("leitner_box, revision_count")
      .eq("id", goalId)
      .eq("user_id", userId)
      .single();

    if (!goal) return;

    // Calculate new Leitner box based on understanding score
    let newBox = goal.leitner_box;

    if (sessionResult.understandingScore >= 80) {
      // Strong understanding - move up
      newBox = Math.min(goal.leitner_box + 1, 5);
    } else if (sessionResult.understandingScore >= 50) {
      // Partial understanding - stay same
      newBox = goal.leitner_box;
    } else {
      // Struggling - move down
      newBox = Math.max(goal.leitner_box - 1, 1);
    }

    // Calculate next revision based on new box
    const intervals: Record<number, number> = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
    const nextRevisionAt = new Date();
    nextRevisionAt.setDate(nextRevisionAt.getDate() + intervals[newBox]);

    // Update goal
    await supabase
      .from("study_ai_goals")
      .update({
        leitner_box: newBox,
        revision_count: goal.revision_count + 1,
        last_revised_at: new Date().toISOString(),
        next_revision_at: nextRevisionAt.toISOString(),
      })
      .eq("id", goalId);
  } catch (error) {
    console.error("Error updating goal from session:", error);
    // Don't throw - this is a background update
  }
}
