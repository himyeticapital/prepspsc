import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// POST /api/study-ai/collab-plan
// Creates a collab session, validates buddy match, notifies guest via buddy DM.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { guestId, matchId, initialFormParams } = body;

  if (!guestId || !matchId) {
    return NextResponse.json({ error: "guestId and matchId are required" }, { status: 400 });
  }

  // Validate an active buddy match exists between caller and guestId
  const { data: match } = await supabase
    .from("buddy_matches")
    .select("id")
    .eq("id", matchId)
    .eq("status", "active")
    .or(`and(user_a_id.eq.${user.id},user_b_id.eq.${guestId}),and(user_a_id.eq.${guestId},user_b_id.eq.${user.id})`)
    .maybeSingle();

  if (!match) {
    return NextResponse.json({ error: "No active buddy match found" }, { status: 404 });
  }

  // Return existing active session if one already exists
  const { data: existing } = await supabase
    .from("collab_plan_sessions")
    .select("id, status")
    .or(`host_id.eq.${user.id},guest_id.eq.${user.id}`)
    .in("status", ["pending", "active", "generating"])
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ sessionId: existing.id, alreadyExists: true });
  }

  // Create the session row
  const { data: session, error: sessionError } = await supabase
    .from("collab_plan_sessions")
    .insert({
      host_id: user.id,
      guest_id: guestId,
      status: "pending",
      form_params: initialFormParams || {},
    })
    .select()
    .single();

  if (sessionError || !session) {
    console.error("[collab-plan] Failed to create session:", sessionError);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  // Notify the guest via a buddy DM — reuses the existing buddy_messages notification
  // system, which auto-fires a toast in buddy-store.ts subscribeToUpdates()
  const adminDb = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: hostProfile } = await adminDb
    .from("profiles")
    .select("full_name, username")
    .eq("id", user.id)
    .single();

  const hostName = hostProfile?.full_name || hostProfile?.username || "Your buddy";

  await adminDb.from("buddy_messages").insert({
    match_id: matchId,
    sender_id: user.id,
    content: `📋 **Study Plan Invite** — ${hostName} wants to create a study plan together! [Join Session](/study-ai?collab=${session.id}&tab=planner)`,
  });

  return NextResponse.json({ sessionId: session.id });
}

// PATCH /api/study-ai/collab-plan
// Updates session status, form_params, or plan IDs. Used by both host and guest.
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { sessionId, status, formParams, hostPlanId, guestPlanId } = body;

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (status !== undefined) update.status = status;
  if (formParams !== undefined) update.form_params = formParams;
  if (hostPlanId !== undefined) update.host_plan_id = hostPlanId;
  if (guestPlanId !== undefined) update.guest_plan_id = guestPlanId;

  const { error } = await supabase
    .from("collab_plan_sessions")
    .update(update)
    .eq("id", sessionId);

  if (error) {
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// GET /api/study-ai/collab-plan?sessionId=
// Fetches a session. Used by the guest on cold-join to hydrate form state.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });

  const { data: session, error } = await supabase
    .from("collab_plan_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ session });
}
