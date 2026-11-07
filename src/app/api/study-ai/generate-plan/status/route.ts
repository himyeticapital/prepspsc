import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Check the status of a plan generation job
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    // Fetch the job (RLS ensures user can only see their own jobs)
    const { data: job, error: jobError } = await supabase
      .from("plan_generation_jobs")
      .select("id, status, error_message, result_plan_id, created_at, started_at, completed_at")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // If completed, fetch the plan
    let plan = null;
    if (job.status === "completed" && job.result_plan_id) {
      const { data: planData } = await supabase
        .from("study_plans")
        .select("*")
        .eq("id", job.result_plan_id)
        .single();

      if (planData) {
        plan = {
          id: planData.id,
          title: planData.title,
          examType: planData.exam_type,
          durationWeeks: planData.duration_weeks,
          hoursPerDay: planData.hours_per_day,
          createdAt: planData.created_at,
          schedule: planData.schedule,
          resources: planData.resources,
          progress: planData.progress,
          microthemes: planData.microthemes || [],
        };
      }
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      error: job.error_message,
      plan,
      timing: {
        created: job.created_at,
        started: job.started_at,
        completed: job.completed_at,
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[generate-plan/status] Error:", errorMessage);
    return NextResponse.json(
      { error: "Failed to check job status" },
      { status: 500 }
    );
  }
}
