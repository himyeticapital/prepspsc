import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { room_id, test_id, mode = "async" } = await request.json();

    if (!room_id || !test_id) {
      return NextResponse.json(
        { error: "room_id and test_id are required" },
        { status: 400 }
      );
    }

    if (!["sync", "async"].includes(mode)) {
      return NextResponse.json(
        { error: "mode must be 'sync' or 'async'" },
        { status: 400 }
      );
    }

    // Verify caller is a room member
    const { data: membership, error: memberError } = await supabase
      .from("user_room_subscriptions")
      .select("id")
      .eq("room_id", room_id)
      .eq("user_id", user.id)
      .single();

    if (memberError || !membership) {
      return NextResponse.json(
        { error: "You are not a member of this room" },
        { status: 403 }
      );
    }

    // Verify no active/pending challenge already exists in this room
    const { data: existing } = await supabase
      .from("room_challenges")
      .select("id")
      .eq("room_id", room_id)
      .in("status", ["pending", "active"])
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "There's already an active challenge in this room" },
        { status: 409 }
      );
    }

    // Verify the test exists and is active
    const { data: test } = await supabase
      .from("tests")
      .select("id, title")
      .eq("id", test_id)
      .eq("is_active", true)
      .single();

    if (!test) {
      return NextResponse.json(
        { error: "Test not found or inactive" },
        { status: 404 }
      );
    }

    // Use service role client for cross-user inserts (bypasses RLS)
    const adminDb = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Create the challenge
    const { data: challenge, error: insertError } = await adminDb
      .from("room_challenges")
      .insert({
        room_id,
        creator_id: user.id,
        test_id,
        mode,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    // Get all room members
    const { data: members, error: membersError } = await adminDb
      .from("user_room_subscriptions")
      .select("user_id")
      .eq("room_id", room_id);

    if (membersError) throw membersError;

    // Insert all members as participants
    // Creator gets status='accepted', others get status='pending'
    const participantRows = (members || []).map((m) => ({
      challenge_id: challenge.id,
      user_id: m.user_id,
      status: m.user_id === user.id ? ("accepted" as const) : ("pending" as const),
    }));

    if (participantRows.length > 0) {
      const { error: participantError } = await adminDb
        .from("room_challenge_participants")
        .insert(participantRows);

      if (participantError) throw participantError;
    }

    // Get creator's name for the system message
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", user.id)
      .single();

    const creatorName =
      creatorProfile?.full_name || creatorProfile?.username || "Someone";

    const modeText =
      mode === "sync"
        ? "Let's take it together now!"
        : "Take it at your own pace.";

    const systemMessage = `\u2694\uFE0F Group Challenge! ${creatorName} challenged everyone to take "${test.title}"! ${modeText}`;

    // Post system message in room chat
    await adminDb.from("messages").insert({
      room_id,
      user_id: user.id,
      content: systemMessage,
      type: "system",
      message_scope: "room",
      table_id: null,
    });

    return NextResponse.json({
      challengeId: challenge.id,
      testTitle: test.title,
      mode,
      participantCount: participantRows.length,
    });
  } catch (error) {
    console.error("Room challenge create error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { challenge_id, action } = await request.json();

    if (!challenge_id || !["accept", "decline"].includes(action)) {
      return NextResponse.json(
        { error: "challenge_id and action (accept/decline) required" },
        { status: 400 }
      );
    }

    // Fetch the participant row for this user + challenge
    const { data: participant, error: pError } = await supabase
      .from("room_challenge_participants")
      .select("id, status, challenge_id")
      .eq("challenge_id", challenge_id)
      .eq("user_id", user.id)
      .single();

    if (pError || !participant) {
      return NextResponse.json(
        { error: "You are not a participant of this challenge" },
        { status: 403 }
      );
    }

    if (participant.status !== "pending") {
      return NextResponse.json(
        { error: "You have already responded to this challenge" },
        { status: 400 }
      );
    }

    const adminDb = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const newStatus = action === "accept" ? "accepted" : "declined";

    // Update participant status
    const { error: updateError } = await adminDb
      .from("room_challenge_participants")
      .update({ status: newStatus })
      .eq("id", participant.id);

    if (updateError) throw updateError;

    // Fetch the challenge to get room_id for the system message
    const { data: challenge } = await supabase
      .from("room_challenges")
      .select("id, room_id, status, mode, test_id")
      .eq("id", challenge_id)
      .single();

    if (!challenge) {
      return NextResponse.json(
        { error: "Challenge not found" },
        { status: 404 }
      );
    }

    // Get user's name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", user.id)
      .single();

    const userName = profile?.full_name || profile?.username || "Someone";

    // Post system message
    const message =
      action === "accept"
        ? `\u2705 ${userName} accepted the challenge!`
        : `\u274C ${userName} declined the challenge`;

    await adminDb.from("messages").insert({
      room_id: challenge.room_id,
      user_id: user.id,
      content: message,
      type: "system",
      message_scope: "room",
      table_id: null,
    });

    // If accepted, check if ALL non-declined participants have accepted
    if (action === "accept") {
      const { data: allParticipants } = await adminDb
        .from("room_challenge_participants")
        .select("id, status")
        .eq("challenge_id", challenge_id);

      const nonDeclined = (allParticipants || []).filter(
        (p) => p.status !== "declined"
      );
      const allAccepted = nonDeclined.every((p) => p.status === "accepted");

      if (allAccepted && challenge.status === "pending") {
        await adminDb
          .from("room_challenges")
          .update({ status: "active" })
          .eq("id", challenge_id);

        return NextResponse.json({
          status: "accepted",
          challengeStatus: "active",
          test_id: challenge.test_id,
          mode: challenge.mode,
        });
      }

      return NextResponse.json({
        status: "accepted",
        challengeStatus: challenge.status,
      });
    }

    return NextResponse.json({ status: "declined" });
  } catch (error) {
    console.error("Room challenge update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
