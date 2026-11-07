import { hasProAccess } from "@/lib/access";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getLevelFromXP, XP_REWARDS, PRO_XP_MULTIPLIER } from "@/lib/xp";

/**
 * Helper: award buddy match XP to a single user.
 * Reads the user's profile, calculates XP with pro multiplier,
 * inserts an xp_transaction, and updates the profile.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function awardBuddyMatchXP(
  adminDb: any,
  userId: string,
  matchId: number
) {
  const { data: profile } = await adminDb
    .from("profiles")
    .select("xp_points, is_pro_member")
    .eq("id", userId)
    .single();

  if (!profile) return;

  const p = profile as { xp_points: number | null; is_pro_member: boolean | null };
  const multiplier = hasProAccess(p) ? PRO_XP_MULTIPLIER : 1;
  const xpAmount = Math.floor(XP_REWARDS.BUDDY_MATCH * multiplier);
  const newXP = (p.xp_points || 0) + xpAmount;
  const newLevel = getLevelFromXP(newXP);

  await adminDb.from("xp_transactions").insert({
    user_id: userId,
    amount: xpAmount,
    reason: "buddy_match",
    multiplier,
    reference_id: matchId.toString(),
  });

  await adminDb
    .from("profiles")
    .update({ xp_points: newXP, xp_level: newLevel })
    .eq("id", userId);
}

/**
 * GET /api/buddy/request
 * Fetch all pending buddy requests for the current user (as receiver).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminDb = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch pending requests where current user is the receiver
    const { data: requests, error } = await adminDb
      .from("buddy_requests")
      .select("id, sender_id, created_at")
      .eq("receiver_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch buddy requests:", error);
      return NextResponse.json(
        { error: "Failed to fetch requests" },
        { status: 500 }
      );
    }

    if (!requests || requests.length === 0) {
      return NextResponse.json({ requests: [] });
    }

    // Fetch sender profiles
    const senderIds = requests.map((r) => r.sender_id);
    const { data: profiles } = await adminDb
      .from("profiles")
      .select("id, username, full_name, avatar_url, xp_level, current_streak, profile_frame, bio")
      .in("id", senderIds);

    const profileMap = new Map(
      (profiles || []).map((p) => [p.id, p])
    );

    const enrichedRequests = requests.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      sender: profileMap.get(r.sender_id) || null,
    }));

    return NextResponse.json({ requests: enrichedRequests });
  } catch (error) {
    console.error("Buddy request GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/buddy/request
 * Accept or decline a buddy request.
 * Body: { request_id: number, action: "accept" | "decline" }
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { request_id, action } = await request.json();

    if (!request_id || !action) {
      return NextResponse.json(
        { error: "request_id and action are required" },
        { status: 400 }
      );
    }

    if (action !== "accept" && action !== "decline") {
      return NextResponse.json(
        { error: "action must be 'accept' or 'decline'" },
        { status: 400 }
      );
    }

    const adminDb = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch the request — must belong to current user as receiver and be pending
    const { data: buddyRequest, error: fetchError } = await adminDb
      .from("buddy_requests")
      .select("id, sender_id, receiver_id, status")
      .eq("id", request_id)
      .single();

    if (fetchError || !buddyRequest) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    if (buddyRequest.receiver_id !== user.id) {
      return NextResponse.json(
        { error: "Not authorized to respond to this request" },
        { status: 403 }
      );
    }

    if (buddyRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Request is no longer pending" },
        { status: 409 }
      );
    }

    // --- Decline flow ---
    if (action === "decline") {
      await adminDb
        .from("buddy_requests")
        .update({ status: "declined", updated_at: new Date().toISOString() })
        .eq("id", request_id);

      return NextResponse.json({ declined: true });
    }

    // --- Accept flow ---
    // Update request status to accepted
    await adminDb
      .from("buddy_requests")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", request_id);

    const senderId = buddyRequest.sender_id;
    const receiverId = user.id;

    // Insert mutual swipes to trigger match via DB trigger
    await adminDb
      .from("buddy_swipes")
      .upsert(
        { swiper_id: senderId, swiped_id: receiverId, direction: "like" },
        { onConflict: "swiper_id,swiped_id" }
      );

    await adminDb
      .from("buddy_swipes")
      .upsert(
        { swiper_id: receiverId, swiped_id: senderId, direction: "like" },
        { onConflict: "swiper_id,swiped_id" }
      );

    // Fetch the match created by the DB trigger
    const userA = senderId < receiverId ? senderId : receiverId;
    const userB = senderId < receiverId ? receiverId : senderId;

    const { data: match } = await adminDb
      .from("buddy_matches")
      .select("id")
      .eq("user_a_id", userA)
      .eq("user_b_id", userB)
      .eq("status", "active")
      .single();

    if (match) {
      // Award XP to both users
      try {
        await Promise.all([
          awardBuddyMatchXP(adminDb, senderId, match.id),
          awardBuddyMatchXP(adminDb, receiverId, match.id),
        ]);
      } catch (xpError) {
        console.error("Failed to award buddy match XP:", xpError);
      }

      return NextResponse.json({
        matched: true,
        matchId: match.id,
      });
    }

    // Match creation failed — still accepted but no match
    return NextResponse.json(
      { error: "Request accepted but match creation failed" },
      { status: 500 }
    );
  } catch (error) {
    console.error("Buddy request PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
