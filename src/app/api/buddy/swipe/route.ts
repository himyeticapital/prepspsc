import { hasProAccess } from "@/lib/access";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getLevelFromXP, XP_REWARDS, PRO_XP_MULTIPLIER } from "@/lib/xp";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { swiped_id, direction } = await request.json();

    if (!swiped_id || !direction || !["like", "pass"].includes(direction)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (swiped_id === user.id) {
      return NextResponse.json({ error: "Cannot swipe on yourself" }, { status: 400 });
    }

    // Record the swipe
    const { error: swipeError } = await supabase
      .from("buddy_swipes")
      .insert({ swiper_id: user.id, swiped_id, direction });

    if (swipeError) {
      if (swipeError.code === "23505") {
        return NextResponse.json({ error: "Already swiped on this user" }, { status: 409 });
      }
      throw swipeError;
    }

    // Check if match was created by the DB trigger
    if (direction === "like") {
      const userA = user.id < swiped_id ? user.id : swiped_id;
      const userB = user.id < swiped_id ? swiped_id : user.id;

      const { data: match } = await supabase
        .from("buddy_matches")
        .select("id")
        .eq("user_a_id", userA)
        .eq("user_b_id", userB)
        .eq("status", "active")
        .single();

      if (match) {
        // Get buddy profile
        const { data: buddyProfile } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url, bio, xp_level, current_streak, profile_frame")
          .eq("id", swiped_id)
          .single();

        // Award XP for buddy match
        try {
          const adminDb = createServiceClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          const { data: userProfile } = await adminDb
            .from("profiles")
            .select("xp_points, is_pro_member")
            .eq("id", user.id)
            .single();

          if (userProfile) {
            const multiplier = hasProAccess(userProfile) ? PRO_XP_MULTIPLIER : 1;
            const xpAmount = Math.floor(XP_REWARDS.BUDDY_MATCH * multiplier);
            const newXP = (userProfile.xp_points || 0) + xpAmount;
            const newLevel = getLevelFromXP(newXP);

            await adminDb.from("xp_transactions").insert({
              user_id: user.id,
              amount: xpAmount,
              reason: "buddy_match",
              multiplier,
              reference_id: match.id.toString(),
            });

            await adminDb
              .from("profiles")
              .update({ xp_points: newXP, xp_level: newLevel })
              .eq("id", user.id);
          }
        } catch (xpError) {
          console.error("Failed to award buddy match XP:", xpError);
        }

        return NextResponse.json({
          matched: true,
          matchId: match.id,
          buddyProfile,
        });
      }
    }

    return NextResponse.json({ matched: false });
  } catch (error) {
    console.error("Buddy swipe error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
