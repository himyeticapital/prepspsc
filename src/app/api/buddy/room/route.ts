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

    const { match_id } = await request.json();

    if (!match_id) {
      return NextResponse.json({ error: "match_id is required" }, { status: 400 });
    }

    // Verify match exists and user is part of it
    const { data: match } = await supabase
      .from("buddy_matches")
      .select("id, user_a_id, user_b_id, status")
      .eq("id", match_id)
      .single();

    if (!match || match.status !== "active") {
      return NextResponse.json({ error: "Active match not found" }, { status: 404 });
    }

    const isUserA = match.user_a_id === user.id;
    const isUserB = match.user_b_id === user.id;

    if (!isUserA && !isUserB) {
      return NextResponse.json({ error: "You are not part of this match" }, { status: 403 });
    }

    const buddyId = isUserA ? match.user_b_id : match.user_a_id;

    // Use service role to check/create rooms (bypasses RLS)
    const adminDb = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if a buddy room already exists for this pair
    const { data: existingRooms } = await adminDb
      .from("rooms")
      .select("id, name")
      .eq("privacy_level", "private")
      .contains("tags", ["buddy"])
      .eq("is_active", true);

    if (existingRooms?.length) {
      // Find a room where both users are subscribed
      for (const room of existingRooms) {
        const { data: subs } = await adminDb
          .from("user_room_subscriptions")
          .select("user_id")
          .eq("room_id", room.id)
          .in("user_id", [user.id, buddyId]);

        if (subs && subs.length === 2) {
          // Room already exists — return it
          return NextResponse.json({
            roomId: room.id,
            roomName: room.name,
            existing: true,
          });
        }
      }
    }

    // Get buddy's name for room title
    const { data: buddyProfile } = await supabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", buddyId)
      .single();

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", user.id)
      .single();

    const myName = myProfile?.full_name || myProfile?.username || "User";
    const buddyName = buddyProfile?.full_name || buddyProfile?.username || "Buddy";

    // Create a private room
    const { data: room, error: roomError } = await adminDb
      .from("rooms")
      .insert({
        name: `${myName} & ${buddyName}`,
        description: "Private buddy study room",
        privacy_level: "private",
        owner_id: user.id,
        max_members: 2,
        tags: ["buddy"],
        color: "#ec4899", // pink
        created_by: user.id,
      })
      .select("id")
      .single();

    if (roomError) throw roomError;

    // Subscribe both users to the room
    await adminDb
      .from("user_room_subscriptions")
      .insert([
        { user_id: user.id, room_id: room.id },
        { user_id: buddyId, room_id: room.id },
      ]);

    // Send a chat message to the buddy about the new room
    await adminDb
      .from("buddy_messages")
      .insert({
        match_id,
        sender_id: user.id,
        content: `📚 I created a private study room for us! Join here: /room/${room.id}`,
      });

    return NextResponse.json({
      roomId: room.id,
      roomName: `${myName} & ${buddyName}`,
    });
  } catch (error) {
    console.error("Buddy room error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
