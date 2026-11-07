import { hasProAccess } from "@/lib/access";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getLevelFromXP, XP_REWARDS, PRO_XP_MULTIPLIER } from "@/lib/xp";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { target_user_id, source } = await request.json();

    if (!target_user_id) {
      return NextResponse.json(
        { error: "target_user_id is required" },
        { status: 400 }
      );
    }

    if (target_user_id === user.id) {
      return NextResponse.json(
        { error: "Cannot add yourself as a buddy" },
        { status: 400 }
      );
    }

    // Verify target user exists
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, xp_level, current_streak, profile_frame, bio")
      .eq("id", target_user_id)
      .single();

    if (!targetProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if already matched
    const userA = user.id < target_user_id ? user.id : target_user_id;
    const userB = user.id < target_user_id ? target_user_id : user.id;

    const { data: existingMatch } = await supabase
      .from("buddy_matches")
      .select("id")
      .eq("user_a_id", userA)
      .eq("user_b_id", userB)
      .single();

    if (existingMatch) {
      return NextResponse.json({
        matched: true,
        matchId: existingMatch.id,
        buddyProfile: targetProfile,
        alreadyMatched: true,
      });
    }

    // --- Search flow: create a buddy request instead of instant match ---
    if (source !== "invite") {
      const adminDb = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Check if a pending request already exists in either direction
      const { data: existingRequest } = await adminDb
        .from("buddy_requests")
        .select("id")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${target_user_id}),and(sender_id.eq.${target_user_id},receiver_id.eq.${user.id})`
        )
        .eq("status", "pending")
        .limit(1)
        .maybeSingle();

      if (existingRequest) {
        return NextResponse.json(
          { error: "Request already pending" },
          { status: 409 }
        );
      }

      // Insert buddy request
      const { error: insertError } = await adminDb
        .from("buddy_requests")
        .insert({
          sender_id: user.id,
          receiver_id: target_user_id,
          status: "pending",
        });

      if (insertError) {
        console.error("Failed to create buddy request:", insertError);
        return NextResponse.json(
          { error: "Failed to send buddy request" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        requestSent: true,
        buddyProfile: targetProfile,
      });
    }

    // --- Invite flow: instant mutual match (existing behavior) ---
    const adminDb = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Insert both swipes (mutual like) to trigger the match
    await adminDb
      .from("buddy_swipes")
      .upsert(
        { swiper_id: user.id, swiped_id: target_user_id, direction: "like" },
        { onConflict: "swiper_id,swiped_id" }
      );

    await adminDb
      .from("buddy_swipes")
      .upsert(
        { swiper_id: target_user_id, swiped_id: user.id, direction: "like" },
        { onConflict: "swiper_id,swiped_id" }
      );

    // The DB trigger should have created the match. Fetch it.
    const { data: match } = await adminDb
      .from("buddy_matches")
      .select("id")
      .eq("user_a_id", userA)
      .eq("user_b_id", userB)
      .eq("status", "active")
      .single();

    if (match) {
      // Award XP for buddy match
      try {
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
        buddyProfile: targetProfile,
      });
    }

    return NextResponse.json(
      { error: "Failed to create match" },
      { status: 500 }
    );
  } catch (error) {
    console.error("Buddy add error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
