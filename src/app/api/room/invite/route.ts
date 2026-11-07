import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// POST — Create a room invite
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { room_id, invitee_id } = await request.json();

    if (!room_id || !invitee_id) {
      return NextResponse.json(
        { error: "room_id and invitee_id are required" },
        { status: 400 }
      );
    }

    if (invitee_id === user.id) {
      return NextResponse.json(
        { error: "You cannot invite yourself" },
        { status: 400 }
      );
    }

    // Verify caller is a member of this room
    const { data: membership } = await supabase
      .from("user_room_subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("room_id", room_id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "You are not a member of this room" },
        { status: 403 }
      );
    }

    // Verify invitee is caller's active buddy
    const { data: buddyMatch } = await supabase
      .from("buddy_matches")
      .select("id")
      .eq("status", "active")
      .or(
        `and(user_a_id.eq.${user.id},user_b_id.eq.${invitee_id}),and(user_a_id.eq.${invitee_id},user_b_id.eq.${user.id})`
      )
      .limit(1)
      .single();

    if (!buddyMatch) {
      return NextResponse.json(
        { error: "You can only invite active buddies" },
        { status: 403 }
      );
    }

    // Get room details for member count check
    const { data: room } = await supabase
      .from("rooms")
      .select("id, max_members")
      .eq("id", room_id)
      .single();

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Count current members
    const { count: memberCount } = await supabase
      .from("user_room_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room_id);

    const currentMembers = memberCount ?? 0;

    // If room has max_members: 2 (default buddy room), auto-expand to 5
    const adminDb = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (room.max_members === 2) {
      await adminDb
        .from("rooms")
        .update({ max_members: 5 })
        .eq("id", room_id);
    }

    const effectiveMax = room.max_members === 2 ? 5 : room.max_members;

    if (currentMembers >= effectiveMax) {
      return NextResponse.json(
        { error: "Room is full" },
        { status: 409 }
      );
    }

    // Check no pending invite exists for this invitee+room
    const { data: existingInvite } = await supabase
      .from("room_invites")
      .select("id")
      .eq("room_id", room_id)
      .eq("invitee_id", invitee_id)
      .eq("status", "pending")
      .limit(1);

    if (existingInvite && existingInvite.length > 0) {
      return NextResponse.json(
        { error: "An invite is already pending for this user" },
        { status: 409 }
      );
    }

    // Insert the invite
    const { data, error: insertError } = await adminDb
      .from("room_invites")
      .insert({
        room_id,
        inviter_id: user.id,
        invitee_id,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ inviteId: data.id });
  } catch (error) {
    console.error("Room invite create error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH — Accept or decline an invite
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { invite_id, action } = await request.json();

    if (!invite_id || !["accept", "decline"].includes(action)) {
      return NextResponse.json(
        { error: "invite_id and action (accept/decline) required" },
        { status: 400 }
      );
    }

    // Fetch the invite and verify it belongs to the caller
    const { data: invite } = await supabase
      .from("room_invites")
      .select("id, room_id, inviter_id, invitee_id, status")
      .eq("id", invite_id)
      .single();

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.invitee_id !== user.id) {
      return NextResponse.json(
        { error: "This invite is not for you" },
        { status: 403 }
      );
    }

    if (invite.status !== "pending") {
      return NextResponse.json(
        { error: "Invite is no longer pending" },
        { status: 400 }
      );
    }

    const adminDb = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (action === "accept") {
      // Insert user into room subscriptions
      const { error: subError } = await adminDb
        .from("user_room_subscriptions")
        .insert({
          user_id: user.id,
          room_id: invite.room_id,
        });

      if (subError) {
        // If already subscribed, that's fine (unique constraint)
        if (!subError.message?.includes("duplicate")) {
          throw subError;
        }
      }

      // Update invite status
      await adminDb
        .from("room_invites")
        .update({
          status: "accepted",
          responded_at: new Date().toISOString(),
        })
        .eq("id", invite_id);

      // Update room name to include new member
      const { data: members } = await adminDb
        .from("user_room_subscriptions")
        .select("user_id, profiles:user_id(full_name, username)")
        .eq("room_id", invite.room_id);

      if (members && members.length > 0) {
        const names = members
          .map((m: any) => {
            const profile = m.profiles;
            return profile?.full_name || profile?.username || "User";
          })
          .slice(0, 3);

        const roomName =
          members.length <= 3
            ? names.join(" & ")
            : `${names.join(", ")} +${members.length - 3}`;

        await adminDb
          .from("rooms")
          .update({ name: roomName })
          .eq("id", invite.room_id);
      }

      return NextResponse.json({
        status: "accepted",
        room_id: invite.room_id,
      });
    } else {
      // Decline
      await adminDb
        .from("room_invites")
        .update({
          status: "declined",
          responded_at: new Date().toISOString(),
        })
        .eq("id", invite_id);

      return NextResponse.json({ status: "declined" });
    }
  } catch (error) {
    console.error("Room invite respond error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET — List pending invites for the current user
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: invites, error } = await supabase
      .from("room_invites")
      .select(
        `
        id,
        room_id,
        inviter_id,
        status,
        created_at,
        rooms:room_id (name),
        profiles:inviter_id (full_name, username, avatar_url)
      `
      )
      .eq("invitee_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const formatted = (invites || []).map((inv: any) => ({
      id: inv.id,
      room_id: inv.room_id,
      room_name: inv.rooms?.name || "Study Room",
      inviter_name:
        inv.profiles?.full_name || inv.profiles?.username || "Someone",
      inviter_avatar: inv.profiles?.avatar_url || null,
      created_at: inv.created_at,
    }));

    return NextResponse.json({ invites: formatted });
  } catch (error) {
    console.error("Room invite list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
