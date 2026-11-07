import { hasProAccess } from "@/lib/access";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
    const { planId, week, day, completed } = body;

    if (!planId || week === undefined || day === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Fetch the current plan
    const { data: plan, error: fetchError } = await supabase
      .from("study_plans")
      .select("*")
      .eq("id", planId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    // Update the schedule with completion status
    const updatedSchedule = plan.schedule.map((w: any) => {
      if (w.week === week) {
        return {
          ...w,
          topics: w.topics.map((t: any) =>
            t.day === day ? { ...t, completed: completed } : t
          ),
        };
      }
      return w;
    });

    // Calculate new progress percentage
    let totalDays = 0;
    let completedDays = 0;
    updatedSchedule.forEach((w: any) => {
      w.topics.forEach((t: any) => {
        if (t.skipped) return;  // exclude skipped entries from progress
        totalDays++;
        if (t.completed) completedDays++;
      });
    });

    const progress = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

    // Update the plan
    const { error: updateError } = await supabase
      .from("study_plans")
      .update({
        schedule: updatedSchedule,
        progress: progress,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Failed to update progress:", updateError);
      return NextResponse.json(
        { error: "Failed to update progress" },
        { status: 500 }
      );
    }

    // Award XP for completing a day
    if (completed) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_pro_member, xp_points")
        .eq("id", user.id)
        .single();

      const isPro = hasProAccess(profile);
      const xpAmount = isPro ? 15 : 10; // Pro gets 1.5x

      await supabase.from("xp_transactions").insert({
        user_id: user.id,
        amount: xpAmount,
        reason: "study_plan_day_complete",
        multiplier: isPro ? 1.5 : 1,
        reference_id: `${planId}-${week}-${day}`,
      });

      if (profile) {
        await supabase
          .from("profiles")
          .update({ xp_points: (profile.xp_points || 0) + xpAmount })
          .eq("id", user.id);
      }

      // Create spaced repetition review entry
      // Get the topic details for the completed day
      const completedWeek = updatedSchedule.find((w: any) => w.week === week);
      const completedTopic = completedWeek?.topics?.find((t: any) => t.day === day);

      if (completedTopic) {
        // Calculate next review date (1 day from now for Leitner Box 1)
        const nextReviewAt = new Date();
        nextReviewAt.setDate(nextReviewAt.getDate() + 1);

        // Upsert review entry (create if not exists, update if exists)
        await supabase.from("study_plan_topic_reviews").upsert(
          {
            user_id: user.id,
            plan_id: planId,
            week_number: week,
            day_number: day,
            subject: completedTopic.subject || "Unknown",
            topics: completedTopic.topics || [],
            leitner_box: 1,
            next_review_at: nextReviewAt.toISOString(),
            is_active: true,
          },
          {
            onConflict: "plan_id,week_number,day_number",
          }
        );
      }
    }

    return NextResponse.json({
      success: true,
      progress,
    });
  } catch (error: any) {
    console.error("Progress update error:", error);
    return NextResponse.json(
      { error: "Failed to update progress" },
      { status: 500 }
    );
  }
}
