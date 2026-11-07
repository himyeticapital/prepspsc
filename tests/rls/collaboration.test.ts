import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  adminClient,
  createAuthenticatedClient,
  createTestUser,
  deleteTestUser,
  TEST_USER_A,
  TEST_USER_B,
} from "../setup";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("RLS: Collaboration Tables", () => {
  let userAId: string;
  let userBId: string;
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let testRoomId: string;

  beforeAll(async () => {
    userAId = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
    userBId = await createTestUser(TEST_USER_B.email, TEST_USER_B.password);

    clientA = await createAuthenticatedClient(
      TEST_USER_A.email,
      TEST_USER_A.password
    );
    clientB = await createAuthenticatedClient(
      TEST_USER_B.email,
      TEST_USER_B.password
    );

    // Ensure profiles exist
    await adminClient.from("profiles").upsert([
      { id: userAId, full_name: "Test User A" },
      { id: userBId, full_name: "Test User B" },
    ]);

    // Create a test room via admin
    const { data: room } = await adminClient
      .from("rooms")
      .insert({
        name: "RLS Test Room",
        owner_id: userAId,
        privacy_level: "public",
      })
      .select("id")
      .single();

    testRoomId = room!.id;
  });

  afterAll(async () => {
    // Clean up in order (foreign keys)
    await adminClient.from("messages").delete().eq("room_id", testRoomId);
    await adminClient
      .from("user_room_subscriptions")
      .delete()
      .eq("room_id", testRoomId);
    await adminClient
      .from("room_presence")
      .delete()
      .in("user_id", [userAId, userBId]);
    await adminClient
      .from("table_members")
      .delete()
      .in("user_id", [userAId, userBId]);
    await adminClient
      .from("study_tables")
      .delete()
      .eq("room_id", testRoomId);
    await adminClient.from("rooms").delete().eq("id", testRoomId);
    await adminClient
      .from("profiles")
      .update({ full_name: null })
      .in("id", [userAId, userBId]);

    await deleteTestUser(userAId);
    await deleteTestUser(userBId);
  });

  // ============================================================
  // MESSAGES
  // ============================================================
  describe("messages", () => {
    let userAMessageId: string;
    let userBMessageId: string;

    it("User A can send a message as themselves", async () => {
      const { data, error } = await clientA
        .from("messages")
        .insert({
          room_id: testRoomId,
          user_id: userAId,
          content: "Hello from User A",
          message_scope: "room",
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBeDefined();
      userAMessageId = data!.id;
    });

    it("User A cannot send a message as User B", async () => {
      const { error } = await clientA.from("messages").insert({
        room_id: testRoomId,
        user_id: userBId,
        content: "Impersonating User B",
        message_scope: "room",
      });

      expect(error).not.toBeNull();
    });

    it("User B can send their own message", async () => {
      const { data, error } = await clientB
        .from("messages")
        .insert({
          room_id: testRoomId,
          user_id: userBId,
          content: "Hello from User B",
          message_scope: "room",
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      userBMessageId = data!.id;
    });

    it("User A can read all messages in the room", async () => {
      const { data, error } = await clientA
        .from("messages")
        .select("id, content, user_id")
        .eq("room_id", testRoomId);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(2);
    });

    it("User A cannot delete User B's message", async () => {
      await clientA.from("messages").delete().eq("id", userBMessageId);

      // Verify message still exists
      const { data } = await adminClient
        .from("messages")
        .select("id")
        .eq("id", userBMessageId)
        .single();

      expect(data).not.toBeNull();
    });

    it("User A cannot update User B's message", async () => {
      await clientA
        .from("messages")
        .update({ content: "Hacked!" })
        .eq("id", userBMessageId);

      // Verify unchanged
      const { data } = await adminClient
        .from("messages")
        .select("content")
        .eq("id", userBMessageId)
        .single();

      expect(data?.content).toBe("Hello from User B");
    });

    it("User A can delete their own message", async () => {
      const { error } = await clientA
        .from("messages")
        .delete()
        .eq("id", userAMessageId);

      expect(error).toBeNull();
    });
  });

  // ============================================================
  // USER_ROOM_SUBSCRIPTIONS
  // ============================================================
  describe("user_room_subscriptions", () => {
    it("User A can subscribe themselves to a room", async () => {
      const { error } = await clientA.from("user_room_subscriptions").insert({
        user_id: userAId,
        room_id: testRoomId,
      });

      expect(error).toBeNull();
    });

    it("User A cannot subscribe User B to a room", async () => {
      const { error } = await clientA.from("user_room_subscriptions").insert({
        user_id: userBId,
        room_id: testRoomId,
      });

      expect(error).not.toBeNull();
    });

    it("User B cannot delete User A's subscription", async () => {
      await clientB
        .from("user_room_subscriptions")
        .delete()
        .eq("user_id", userAId)
        .eq("room_id", testRoomId);

      // Verify still exists
      const { data } = await adminClient
        .from("user_room_subscriptions")
        .select("user_id")
        .eq("user_id", userAId)
        .eq("room_id", testRoomId)
        .single();

      expect(data).not.toBeNull();
    });

    it("User A can unsubscribe themselves", async () => {
      const { error } = await clientA
        .from("user_room_subscriptions")
        .delete()
        .eq("user_id", userAId)
        .eq("room_id", testRoomId);

      expect(error).toBeNull();
    });
  });

  // ============================================================
  // ROOM_PRESENCE
  // ============================================================
  describe("room_presence", () => {
    it("User A can set their own presence", async () => {
      const { error } = await clientA.from("room_presence").upsert({
        user_id: userAId,
        room_id: testRoomId,
        status: "studying",
      });

      expect(error).toBeNull();
    });

    it("User A cannot set presence for User B", async () => {
      const { error } = await clientA.from("room_presence").insert({
        user_id: userBId,
        room_id: testRoomId,
        status: "online",
      });

      expect(error).not.toBeNull();
    });

    it("User B cannot update User A's presence", async () => {
      await clientB
        .from("room_presence")
        .update({ status: "away" })
        .eq("user_id", userAId)
        .eq("room_id", testRoomId);

      // Verify unchanged
      const { data } = await adminClient
        .from("room_presence")
        .select("status")
        .eq("user_id", userAId)
        .eq("room_id", testRoomId)
        .single();

      expect(data?.status).toBe("studying");
    });

    it("User A can read everyone's presence (for room UI)", async () => {
      const { data, error } = await clientA
        .from("room_presence")
        .select("user_id, status")
        .eq("room_id", testRoomId);

      expect(error).toBeNull();
      expect(data).not.toBeNull();
    });
  });

  // ============================================================
  // ROOMS (owner can update/delete)
  // ============================================================
  describe("rooms", () => {
    it("Owner (User A) can update their room", async () => {
      const { error } = await clientA
        .from("rooms")
        .update({ name: "Updated Room Name" })
        .eq("id", testRoomId);

      expect(error).toBeNull();
    });

    it("Non-owner (User B) cannot update the room", async () => {
      await clientB
        .from("rooms")
        .update({ name: "Hacked Room" })
        .eq("id", testRoomId);

      // Verify unchanged
      const { data } = await adminClient
        .from("rooms")
        .select("name")
        .eq("id", testRoomId)
        .single();

      expect(data?.name).toBe("Updated Room Name");
    });

    it("Non-owner (User B) cannot delete the room", async () => {
      await clientB.from("rooms").delete().eq("id", testRoomId);

      // Verify still exists
      const { data } = await adminClient
        .from("rooms")
        .select("id")
        .eq("id", testRoomId)
        .single();

      expect(data).not.toBeNull();
    });
  });
});
