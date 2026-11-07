import { enforceDailyCap } from "@/lib/daily-cap";
import { hasProAccess } from "@/lib/access";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// This API now creates a background job and returns immediately
// The actual generation happens in a Supabase Edge Function

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

    const body = await request.json();
    const { examType, customSyllabus, durationWeeks, hoursPerDay, studySlots = 1, focusAreas, startWithSubject, startDay } = body;

    if (!examType || !durationWeeks || !hoursPerDay) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check user's Pro status
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro_member")
      .eq("id", user.id)
      .single();

    const isPro = hasProAccess(profile);

    // Check rate limit for free users (1 plan per week)
    if (!isPro) {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { count } = await supabase
        .from("study_plans")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", oneWeekAgo.toISOString());

      if ((count ?? 0) >= 1) {
        return NextResponse.json(
          {
            error: "Free users can create 1 study plan per week. Upgrade to Pro for unlimited plans.",
            code: "WEEKLY_LIMIT",
          },
          { status: 429 }
        );
      }
    }

    // Check for existing pending/processing jobs for this user
    const { data: existingJobs } = await supabase
      .from("plan_generation_jobs")
      .select("id, status")
      .eq("user_id", user.id)
      .in("status", ["pending", "processing"])
      .limit(1);

    if (existingJobs && existingJobs.length > 0) {
      return NextResponse.json({
        jobId: existingJobs[0].id,
        status: existingJobs[0].status,
        message: "A plan is already being generated",
      });
    }

    // Per-user daily cap (abuse guard; see src/lib/daily-cap.ts)
    const dailyCapResponse = await enforceDailyCap(user.id, "studyPlan");
    if (dailyCapResponse) return dailyCapResponse;

    // Create a new job
    const { data: job, error: jobError } = await supabase
      .from("plan_generation_jobs")
      .insert({
        user_id: user.id,
        status: "pending",
        input_params: {
          examType,
          customSyllabus,
          durationWeeks,
          hoursPerDay,
          studySlots,
          focusAreas,
          startWithSubject,
          startDay,
        },
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error("[generate-plan] Failed to create job:", jobError);
      return NextResponse.json(
        { error: "Failed to start plan generation" },
        { status: 500 }
      );
    }

    console.log(`[generate-plan] Created job: ${job.id}`);

    // The frontend will trigger the Edge Function directly
    // This avoids Vercel's 10s timeout - browser has no such limitation

    // Return immediately with job ID
    return NextResponse.json({
      jobId: job.id,
      status: "pending",
      message: "Plan generation started. Poll /api/study-ai/generate-plan/status for updates.",
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[generate-plan] Error:", errorMessage);
    return NextResponse.json(
      { error: "Failed to start plan generation" },
      { status: 500 }
    );
  }
}
