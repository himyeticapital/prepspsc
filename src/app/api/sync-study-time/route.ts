import { hasProAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { XP_REWARDS, PRO_XP_MULTIPLIER, getLevelFromXP } from "@/lib/xp";
import { applyRateLimit } from "@/lib/rate-limit";
import { validateBody, syncStudyTimeSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResponse = await applyRateLimit(request, "general", user.id);
    if (rateLimitResponse) return rateLimitResponse;

    let rawBody;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validation = validateBody(syncStudyTimeSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    const { minutes } = validation.data;

    const today = new Date().toISOString().split("T")[0];
    console.log(`[sync-study-time] User ${user.id} syncing ${minutes} min for ${today}`);

    // Try using the RPC function first
    const { data: rpcData, error: rpcError } = await supabase.rpc("log_study_time", {
      p_user_id: user.id,
      p_minutes: minutes,
    });

    if (rpcError) {
      console.log("[sync-study-time] RPC log_study_time failed, using fallback:", rpcError.message);

      // Fallback: try direct insert/update
      const { data: existingLog } = await supabase
        .from("daily_study_logs")
        .select("id, minutes_studied")
        .eq("user_id", user.id)
        .eq("study_date", today)
        .single();

      if (existingLog) {
        const { error: updateError } = await supabase
          .from("daily_study_logs")
          .update({ minutes_studied: existingLog.minutes_studied + minutes })
          .eq("id", existingLog.id);

        if (updateError) {
          console.error("Failed to update daily_study_logs:", updateError);
        }
      } else {
        const { error: insertError } = await supabase.from("daily_study_logs").insert({
          user_id: user.id,
          study_date: today,
          minutes_studied: minutes,
        });

        if (insertError) {
          console.error("Failed to insert daily_study_logs:", insertError);
        }
      }

      // Update total in profile
      const { error: incrementError } = await supabase.rpc("increment_study_time", {
        user_id: user.id,
        minutes: minutes,
      });

      if (incrementError) {
        console.error("Failed to increment_study_time:", incrementError);

        // Direct fallback for profile update
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("total_minutes_all_time")
          .eq("id", user.id)
          .single();

        if (currentProfile) {
          await supabase
            .from("profiles")
            .update({
              total_minutes_all_time: (currentProfile.total_minutes_all_time || 0) + minutes
            })
            .eq("id", user.id);
        }
      }
    } else {
      console.log("[sync-study-time] RPC log_study_time succeeded");
    }

    // Calculate and update streak
    const { data: streakData, error: streakError } = await supabase.rpc("calculate_streak", {
      p_user_id: user.id,
    });

    if (streakError) {
      console.error("[sync-study-time] Failed to calculate streak:", streakError.message);
    } else if (streakData && streakData.length > 0) {
      console.log(`[sync-study-time] Streak updated: ${streakData[0].current_streak} days (max: ${streakData[0].max_streak})`);
    }

    // Award XP for study session
    const { data: profile } = await supabase
      .from("profiles")
      .select("total_minutes_all_time, current_streak, xp_points, xp_level, is_pro_member")
      .eq("id", user.id)
      .single();

    let xpAwarded = 0;
    if (profile) {
      // Calculate XP: 1 XP per minute, with Pro multiplier
      const baseXP = minutes * XP_REWARDS.STUDY_SESSION_PER_MINUTE;
      const multiplier = hasProAccess(profile) ? PRO_XP_MULTIPLIER : 1;
      xpAwarded = Math.floor(baseXP * multiplier);

      if (xpAwarded > 0) {
        // Insert XP transaction
        const { error: xpInsertError } = await supabase.from("xp_transactions").insert({
          user_id: user.id,
          amount: xpAwarded,
          reason: "study_session",
          multiplier: multiplier,
          reference_id: `timer_${Date.now()}`,
        });

        if (xpInsertError) {
          console.error("Failed to insert XP transaction:", xpInsertError);
        }

        // Update profile XP and level
        const newXP = (profile.xp_points || 0) + xpAwarded;
        const newLevel = getLevelFromXP(newXP);

        const { error: profileUpdateError } = await supabase
          .from("profiles")
          .update({
            xp_points: newXP,
            xp_level: newLevel,
          })
          .eq("id", user.id);

        if (profileUpdateError) {
          console.error("Failed to update profile XP:", profileUpdateError);
        } else {
          console.log(`[sync-study-time] Awarded ${xpAwarded} XP for ${minutes} min study session (Pro: ${profile.is_pro_member})`);
        }
      }
    }

    // Get today's total
    const { data: todayLog } = await supabase
      .from("daily_study_logs")
      .select("minutes_studied")
      .eq("user_id", user.id)
      .eq("study_date", today)
      .single();

    // Get updated profile
    const { data: updatedProfile } = await supabase
      .from("profiles")
      .select("total_minutes_all_time, current_streak, xp_points")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      success: true,
      totalMinutes: updatedProfile?.total_minutes_all_time || 0,
      todayMinutes: todayLog?.minutes_studied || 0,
      streak: updatedProfile?.current_streak || 0,
      xpAwarded: xpAwarded,
      totalXP: updatedProfile?.xp_points || 0,
    });
  } catch (error) {
    console.error("Error syncing study time:", error);
    return NextResponse.json(
      { error: "Failed to sync study time" },
      { status: 500 }
    );
  }
}
