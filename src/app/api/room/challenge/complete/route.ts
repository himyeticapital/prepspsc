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

    const { challenge_id, attempt_id } = await request.json();

    if (!challenge_id || !attempt_id) {
      return NextResponse.json(
        { error: "challenge_id and attempt_id are required" },
        { status: 400 }
      );
    }

    // Verify user is a participant of this challenge
    const { data: participant, error: pError } = await supabase
      .from("room_challenge_participants")
      .select("id, status")
      .eq("challenge_id", challenge_id)
      .eq("user_id", user.id)
      .single();

    if (pError || !participant) {
      return NextResponse.json(
        { error: "You are not a participant of this challenge" },
        { status: 403 }
      );
    }

    const adminDb = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Update participant: set attempt_id, status='completed', completed_at=now
    const { error: updateError } = await adminDb
      .from("room_challenge_participants")
      .update({
        attempt_id,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", participant.id);

    if (updateError) throw updateError;

    // Fetch all participants to check if everyone has completed
    const { data: allParticipants } = await adminDb
      .from("room_challenge_participants")
      .select("id, user_id, status, attempt_id")
      .eq("challenge_id", challenge_id);

    const accepted = (allParticipants || []).filter(
      (p) => p.status === "completed" || p.status === "accepted"
    );
    const completed = (allParticipants || []).filter(
      (p) => p.status === "completed"
    );

    // Check if ALL accepted (non-declined) participants have completed
    const allDone = accepted.length > 0 && accepted.every((p) => p.status === "completed");

    if (allDone) {
      // Fetch the challenge for room_id
      const { data: challenge } = await adminDb
        .from("room_challenges")
        .select("id, room_id, test_id, mode")
        .eq("id", challenge_id)
        .single();

      if (!challenge) {
        return NextResponse.json(
          { error: "Challenge not found" },
          { status: 404 }
        );
      }

      // Mark challenge as completed
      await adminDb
        .from("room_challenges")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", challenge_id);

      // Fetch all completed participants' test_attempts + profiles
      const attemptIds = completed
        .map((p) => p.attempt_id)
        .filter((id): id is number => id !== null);

      const { data: attempts } = await adminDb
        .from("test_attempts")
        .select("id, user_id, score, total_marks")
        .in("id", attemptIds);

      const userIds = completed.map((p) => p.user_id);

      const { data: profiles } = await adminDb
        .from("profiles")
        .select("id, full_name, username")
        .in("id", userIds);

      // Build results sorted by score descending
      const results = completed
        .map((p) => {
          const attempt = attempts?.find((a) => a.user_id === p.user_id);
          const profile = profiles?.find((pr) => pr.id === p.user_id);
          return {
            userId: p.user_id,
            name: profile?.full_name || profile?.username || "Unknown",
            score: attempt?.score ?? 0,
            totalMarks: attempt?.total_marks ?? 0,
          };
        })
        .sort((a, b) => b.score - a.score);

      // Build ranked results message
      const rankEmojis = ["\uD83E\uDD47", "\uD83E\uDD48", "\uD83E\uDD49"];
      const lines = results.map((r, i) => {
        const rank = i < 3 ? rankEmojis[i] : `${i + 1}th:`;
        return `${rank} ${r.name} ${r.score}/${r.totalMarks}`;
      });

      const resultMessage = `\uD83C\uDFC6 Group Challenge Complete!\n${lines.join("\n")}`;

      await adminDb.from("messages").insert({
        room_id: challenge.room_id,
        user_id: user.id,
        content: resultMessage,
        type: "system",
        message_scope: "room",
        table_id: null,
      });

      return NextResponse.json({
        completed: true,
        results,
      });
    }

    // Not all done yet
    // Fetch challenge mode
    const { data: challengeInfo } = await supabase
      .from("room_challenges")
      .select("mode")
      .eq("id", challenge_id)
      .single();

    return NextResponse.json({
      completed: false,
      completedCount: completed.length,
      totalAccepted: accepted.length,
      mode: challengeInfo?.mode || "async",
    });
  } catch (error) {
    console.error("Room challenge complete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
