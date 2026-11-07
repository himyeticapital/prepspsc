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

describe("RLS: Personal Data Tables", () => {
  let userAId: string;
  let userBId: string;
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;

  beforeAll(async () => {
    // Create test users
    userAId = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
    userBId = await createTestUser(TEST_USER_B.email, TEST_USER_B.password);

    // Create authenticated clients
    clientA = await createAuthenticatedClient(
      TEST_USER_A.email,
      TEST_USER_A.password
    );
    clientB = await createAuthenticatedClient(
      TEST_USER_B.email,
      TEST_USER_B.password
    );

    // Ensure profiles exist for both users (created by auth trigger usually)
    await adminClient.from("profiles").upsert([
      { id: userAId, full_name: "Test User A" },
      { id: userBId, full_name: "Test User B" },
    ]);
  });

  afterAll(async () => {
    // Clean up test data
    await adminClient
      .from("daily_study_logs")
      .delete()
      .in("user_id", [userAId, userBId]);
    await adminClient
      .from("study_sessions")
      .delete()
      .in("user_id", [userAId, userBId]);
    await adminClient
      .from("profiles")
      .update({ full_name: null })
      .in("id", [userAId, userBId]);

    // Delete test users
    await deleteTestUser(userAId);
    await deleteTestUser(userBId);
  });

  // ============================================================
  // PROFILES
  // ============================================================
  describe("profiles", () => {
    it("User A can update their own profile", async () => {
      const { error } = await clientA
        .from("profiles")
        .update({ full_name: "User A Updated" })
        .eq("id", userAId);

      expect(error).toBeNull();
    });

    it("User A cannot update User B's profile", async () => {
      const { error } = await clientA
        .from("profiles")
        .update({ full_name: "Hacked by A" })
        .eq("id", userBId);

      // RLS should block this — either error or 0 rows affected
      // Supabase returns no error but updates 0 rows when RLS blocks
      if (!error) {
        const { data } = await adminClient
          .from("profiles")
          .select("full_name")
          .eq("id", userBId)
          .single();
        expect(data?.full_name).not.toBe("Hacked by A");
      }
    });

    it("User A can read other users' profiles (for leaderboard)", async () => {
      const { data, error } = await clientA
        .from("profiles")
        .select("id, full_name")
        .eq("id", userBId)
        .single();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data?.id).toBe(userBId);
    });
  });

  // ============================================================
  // DAILY_STUDY_LOGS
  // ============================================================
  describe("daily_study_logs", () => {
    const today = new Date().toISOString().split("T")[0];

    it("User A can insert their own study log", async () => {
      const { error } = await clientA.from("daily_study_logs").upsert({
        user_id: userAId,
        study_date: today,
        minutes_studied: 30,
      });

      expect(error).toBeNull();
    });

    it("User A cannot insert a study log with User B's user_id", async () => {
      const { error } = await clientA.from("daily_study_logs").insert({
        user_id: userBId,
        study_date: today,
        minutes_studied: 999,
      });

      // Should be blocked by RLS
      expect(error).not.toBeNull();
    });

    it("User A can update their own study log", async () => {
      const { error } = await clientA
        .from("daily_study_logs")
        .update({ minutes_studied: 60 })
        .eq("user_id", userAId)
        .eq("study_date", today);

      expect(error).toBeNull();
    });

    it("User A cannot update User B's study log", async () => {
      // First create a log for User B via admin
      await adminClient.from("daily_study_logs").upsert({
        user_id: userBId,
        study_date: today,
        minutes_studied: 45,
      });

      const { error } = await clientA
        .from("daily_study_logs")
        .update({ minutes_studied: 0 })
        .eq("user_id", userBId)
        .eq("study_date", today);

      // Verify User B's data is unchanged
      const { data } = await adminClient
        .from("daily_study_logs")
        .select("minutes_studied")
        .eq("user_id", userBId)
        .eq("study_date", today)
        .single();

      expect(data?.minutes_studied).toBe(45);
    });

    it("User A cannot delete User B's study log", async () => {
      const { error } = await clientA
        .from("daily_study_logs")
        .delete()
        .eq("user_id", userBId)
        .eq("study_date", today);

      // Verify User B's data still exists
      const { data } = await adminClient
        .from("daily_study_logs")
        .select("minutes_studied")
        .eq("user_id", userBId)
        .eq("study_date", today)
        .single();

      expect(data).not.toBeNull();
    });
  });

  // ============================================================
  // STUDY_SESSIONS
  // ============================================================
  describe("study_sessions", () => {
    let userASessionId: string;

    it("User A can insert their own study session", async () => {
      const { data, error } = await clientA
        .from("study_sessions")
        .insert({
          user_id: userAId,
          duration_seconds: 1500,
          mode: "pomodoro",
          xp_earned: 10,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBeDefined();
      userASessionId = data!.id;
    });

    it("User A cannot insert a session with User B's user_id", async () => {
      const { error } = await clientA.from("study_sessions").insert({
        user_id: userBId,
        duration_seconds: 1500,
        mode: "pomodoro",
        xp_earned: 999,
        started_at: new Date().toISOString(),
      });

      expect(error).not.toBeNull();
    });

    it("User A can update their own session", async () => {
      const { error } = await clientA
        .from("study_sessions")
        .update({ duration_seconds: 3000 })
        .eq("id", userASessionId);

      expect(error).toBeNull();
    });

    it("User B cannot update User A's session", async () => {
      const { error } = await clientB
        .from("study_sessions")
        .update({ xp_earned: 0 })
        .eq("id", userASessionId);

      // Verify unchanged
      const { data } = await adminClient
        .from("study_sessions")
        .select("xp_earned")
        .eq("id", userASessionId)
        .single();

      expect(data?.xp_earned).toBe(10);
    });

    it("User B cannot delete User A's session", async () => {
      const { error } = await clientB
        .from("study_sessions")
        .delete()
        .eq("id", userASessionId);

      // Verify still exists
      const { data } = await adminClient
        .from("study_sessions")
        .select("id")
        .eq("id", userASessionId)
        .single();

      expect(data).not.toBeNull();
    });

    it("User A can delete their own session", async () => {
      const { error } = await clientA
        .from("study_sessions")
        .delete()
        .eq("id", userASessionId);

      expect(error).toBeNull();
    });
  });

  // ============================================================
  // XP_TRANSACTIONS (append-only)
  // ============================================================
  describe("xp_transactions", () => {
    it("User A can insert their own XP transaction", async () => {
      const { error } = await clientA.from("xp_transactions").insert({
        user_id: userAId,
        amount: 10,
        reason: "test_completion",
      });

      expect(error).toBeNull();
    });

    it("User A cannot insert XP for User B", async () => {
      const { error } = await clientA.from("xp_transactions").insert({
        user_id: userBId,
        amount: 9999,
        reason: "test_completion",
      });

      expect(error).not.toBeNull();
    });
  });
});
