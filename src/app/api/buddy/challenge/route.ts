import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { match_id, test_id, mode = "async" } = await request.json();

    if (!match_id || !test_id) {
      return NextResponse.json({ error: "match_id and test_id are required" }, { status: 400 });
    }

    if (!["sync", "async"].includes(mode)) {
      return NextResponse.json({ error: "mode must be 'sync' or 'async'" }, { status: 400 });
    }

    // Verify the match exists and user is part of it
    const { data: match, error: matchError } = await supabase
      .from("buddy_matches")
      .select("id, user_a_id, user_b_id, status")
      .eq("id", match_id)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (match.status !== "active") {
      return NextResponse.json({ error: "Match is not active" }, { status: 400 });
    }

    const isUserA = match.user_a_id === user.id;
    const isUserB = match.user_b_id === user.id;

    if (!isUserA && !isUserB) {
      return NextResponse.json({ error: "You are not part of this match" }, { status: 403 });
    }

    const challengedId = isUserA ? match.user_b_id : match.user_a_id;

    // Verify test exists and is active
    const { data: test } = await supabase
      .from("tests")
      .select("id, title")
      .eq("id", test_id)
      .eq("is_active", true)
      .single();

    if (!test) {
      return NextResponse.json({ error: "Test not found or inactive" }, { status: 404 });
    }

    // Check for existing pending/accepted challenge in this match
    const { data: existing } = await supabase
      .from("buddy_challenges")
      .select("id")
      .eq("match_id", match_id)
      .in("status", ["pending", "accepted"])
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "There's already an active challenge in this match" }, { status: 409 });
    }

    // Create the challenge
    const { data: challenge, error: insertError } = await supabase
      .from("buddy_challenges")
      .insert({
        match_id,
        challenger_id: user.id,
        challenged_id: challengedId,
        test_id,
        status: "pending",
        mode,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    // Send a system message in the chat about the challenge
    const challengeMessage = mode === "sync"
      ? `\u{1F3C6} Challenge! I challenged you to take "${test.title}" together right now! Accept?`
      : `\u{1F3C6} Challenge! I challenged you to take "${test.title}" at your own pace. Accept?`;

    await supabase
      .from("buddy_messages")
      .insert({
        match_id,
        sender_id: user.id,
        content: challengeMessage,
      });

    return NextResponse.json({
      challengeId: challenge.id,
      testTitle: test.title,
      mode,
    });
  } catch (error) {
    console.error("Buddy challenge error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH to accept/decline a challenge
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { challenge_id, action } = await request.json();

    if (!challenge_id || !["accept", "decline"].includes(action)) {
      return NextResponse.json({ error: "challenge_id and action (accept/decline) required" }, { status: 400 });
    }

    // Fetch the challenge
    const { data: challenge } = await supabase
      .from("buddy_challenges")
      .select("*, tests:test_id(title)")
      .eq("id", challenge_id)
      .single();

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    if (challenge.challenged_id !== user.id) {
      return NextResponse.json({ error: "Only the challenged user can respond" }, { status: 403 });
    }

    if (challenge.status !== "pending") {
      return NextResponse.json({ error: "Challenge is no longer pending" }, { status: 400 });
    }

    const newStatus = action === "accept" ? "accepted" : "declined";

    const { error: updateError } = await supabase
      .from("buddy_challenges")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", challenge_id);

    if (updateError) throw updateError;

    // Send system message
    const testTitle = (challenge as any).tests?.title || "a test";
    const message = action === "accept"
      ? `\u2705 Challenge accepted! Let's take "${testTitle}" together.`
      : `\u274C Challenge declined.`;

    await supabase
      .from("buddy_messages")
      .insert({
        match_id: challenge.match_id,
        sender_id: user.id,
        content: message,
      });

    if (newStatus === "accepted") {
      return NextResponse.json({
        status: "accepted",
        test_id: challenge.test_id,
        mode: challenge.mode,
        match_id: challenge.match_id,
        challenge_id: challenge.id,
      });
    }

    return NextResponse.json({ status: "declined" });
  } catch (error) {
    console.error("Buddy challenge update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
