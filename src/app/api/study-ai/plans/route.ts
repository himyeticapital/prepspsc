import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: plans, error } = await supabase
      .from("study_plans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch plans:", error);
      return NextResponse.json(
        { error: "Failed to fetch plans" },
        { status: 500 }
      );
    }

    // Transform to match frontend interface
    const transformedPlans = plans.map((plan) => ({
      id: plan.id,
      title: plan.title,
      examType: plan.exam_type,
      durationWeeks: plan.duration_weeks,
      hoursPerDay: plan.hours_per_day,
      createdAt: plan.created_at,
      schedule: plan.schedule,
      resources: plan.resources,
      progress: plan.progress || 0,
      microthemes: plan.microthemes || [],
    }));

    return NextResponse.json({ plans: transformedPlans });
  } catch (error: any) {
    console.error("Plans fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    );
  }
}
