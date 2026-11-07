import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { challenge_id, attempt_id } = await request.json();

    if (!challenge_id || !attempt_id) {
      return NextResponse.json({ error: "challenge_id and attempt_id are required" }, { status: 400 });
    }

    // Fetch the challenge
    const { data: challenge, error: fetchError } = await supabase
      .from("buddy_challenges")
      .select("*")
      .eq("id", challenge_id)
      .single();

    if (fetchError || !challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    // Verify user is part of this challenge
    const isChallenger = challenge.challenger_id === user.id;
    const isChallenged = challenge.challenged_id === user.id;

    if (!isChallenger && !isChallenged) {
      return NextResponse.json({ error: "You are not part of this challenge" }, { status: 403 });
    }

    // Update the appropriate attempt field
    const updateField = isChallenger
      ? { challenger_attempt_id: attempt_id }
      : { challenged_attempt_id: attempt_id };

    const { error: updateError } = await supabase
      .from("buddy_challenges")
      .update({ ...updateField, updated_at: new Date().toISOString() })
      .eq("id", challenge_id);

    if (updateError) throw updateError;

    // Re-fetch the challenge to check if both attempts are now set
    const { data: updated, error: refetchError } = await supabase
      .from("buddy_challenges")
      .select("*")
      .eq("id", challenge_id)
      .single();

    if (refetchError || !updated) {
      return NextResponse.json({ error: "Failed to re-fetch challenge" }, { status: 500 });
    }

    const bothCompleted = updated.challenger_attempt_id && updated.challenged_attempt_id;

    if (bothCompleted) {
      // Mark challenge as completed
      await supabase
        .from("buddy_challenges")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", challenge_id);

      // Fetch both attempts' scores
      const { data: attempts } = await supabase
        .from("test_attempts")
        .select("id, user_id, score, total_marks")
        .in("id", [updated.challenger_attempt_id, updated.challenged_attempt_id]);

      const challengerAttempt = attempts?.find(a => a.user_id === updated.challenger_id);
      const challengedAttempt = attempts?.find(a => a.user_id === updated.challenged_id);

      // Fetch both users' names
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .in("id", [updated.challenger_id, updated.challenged_id]);

      const challengerProfile = profiles?.find(p => p.id === updated.challenger_id);
      const challengedProfile = profiles?.find(p => p.id === updated.challenged_id);

      const challengerName = challengerProfile?.full_name || challengerProfile?.username || "Player 1";
      const challengedName = challengedProfile?.full_name || challengedProfile?.username || "Player 2";

      const challengerScore = challengerAttempt?.score ?? 0;
      const challengerTotal = challengerAttempt?.total_marks ?? 0;
      const challengedScore = challengedAttempt?.score ?? 0;
      const challengedTotal = challengedAttempt?.total_marks ?? 0;

      // Post system message using service role client (bypasses RLS for cross-user operation)
      const adminDb = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      await adminDb
        .from("buddy_messages")
        .insert({
          match_id: updated.match_id,
          sender_id: user.id,
          content: `\u{1F3C6} Challenge complete! ${challengerName} scored ${challengerScore}/${challengerTotal}, ${challengedName} scored ${challengedScore}/${challengedTotal}`,
        });

      return NextResponse.json({
        completed: true,
        status: "completed",
        challenger: { name: challengerName, score: challengerScore, total: challengerTotal },
        challenged: { name: challengedName, score: challengedScore, total: challengedTotal },
      });
    }

    return NextResponse.json({
      completed: false,
      status: updated.status,
      mode: updated.mode,
    });
  } catch (error) {
    console.error("Buddy challenge complete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
