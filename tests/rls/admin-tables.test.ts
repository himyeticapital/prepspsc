import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  adminClient,
  createAuthenticatedClient,
  createTestUser,
  deleteTestUser,
  TEST_USER_A,
} from "../setup";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("RLS: Admin-Only Tables", () => {
  let userAId: string;
  let clientA: SupabaseClient;

  beforeAll(async () => {
    userAId = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
    clientA = await createAuthenticatedClient(
      TEST_USER_A.email,
      TEST_USER_A.password
    );

    await adminClient.from("profiles").upsert([
      { id: userAId, full_name: "Test User A" },
    ]);
  });

  afterAll(async () => {
    await adminClient
      .from("profiles")
      .update({ full_name: null })
      .eq("id", userAId);
    await deleteTestUser(userAId);
  });

  // ============================================================
  // TESTS table (admin-managed)
  // ============================================================
  describe("tests", () => {
    it("Regular user can SELECT tests (for test listing)", async () => {
      const { error } = await clientA
        .from("tests")
        .select("id, title")
        .limit(1);

      expect(error).toBeNull();
    });

    it("Regular user cannot INSERT a test", async () => {
      const { error } = await clientA.from("tests").insert({
        title: "Hacked Test",
        category: "GK",
        difficulty: "easy",
        created_by: userAId,
      });

      expect(error).not.toBeNull();
    });

    it("Regular user cannot UPDATE a test", async () => {
      // Get any existing test
      const { data: tests } = await adminClient
        .from("tests")
        .select("id, title")
        .limit(1);

      if (tests && tests.length > 0) {
        const originalTitle = tests[0].title;

        await clientA
          .from("tests")
          .update({ title: "Hacked Title" })
          .eq("id", tests[0].id);

        // Verify unchanged
        const { data } = await adminClient
          .from("tests")
          .select("title")
          .eq("id", tests[0].id)
          .single();

        expect(data?.title).toBe(originalTitle);
      }
    });

    it("Regular user cannot DELETE a test", async () => {
      const { data: tests } = await adminClient
        .from("tests")
        .select("id")
        .limit(1);

      if (tests && tests.length > 0) {
        await clientA.from("tests").delete().eq("id", tests[0].id);

        // Verify still exists
        const { data } = await adminClient
          .from("tests")
          .select("id")
          .eq("id", tests[0].id)
          .single();

        expect(data).not.toBeNull();
      }
    });
  });

  // ============================================================
  // QUESTIONS table (admin-managed)
  // ============================================================
  describe("questions", () => {
    it("Regular user can SELECT questions (for test taking)", async () => {
      const { error } = await clientA
        .from("questions")
        .select("id, content")
        .limit(1);

      expect(error).toBeNull();
    });

    it("Regular user cannot INSERT a question", async () => {
      // Get a test ID to reference
      const { data: tests } = await adminClient
        .from("tests")
        .select("id")
        .limit(1);

      if (tests && tests.length > 0) {
        const { error } = await clientA.from("questions").insert({
          test_id: tests[0].id,
          content: "Hacked question?",
          type: "mcq",
        });

        expect(error).not.toBeNull();
      }
    });

    it("Regular user cannot DELETE a question", async () => {
      const { data: questions } = await adminClient
        .from("questions")
        .select("id")
        .limit(1);

      if (questions && questions.length > 0) {
        await clientA.from("questions").delete().eq("id", questions[0].id);

        // Verify still exists
        const { data } = await adminClient
          .from("questions")
          .select("id")
          .eq("id", questions[0].id)
          .single();

        expect(data).not.toBeNull();
      }
    });
  });

  // ============================================================
  // ACHIEVEMENTS table (admin-managed, read-only for users)
  // ============================================================
  describe("achievements", () => {
    it("Regular user can SELECT achievements (for display)", async () => {
      const { error } = await clientA
        .from("achievements")
        .select("id, name, slug")
        .limit(1);

      expect(error).toBeNull();
    });

    it("Regular user cannot INSERT an achievement", async () => {
      const { error } = await clientA.from("achievements").insert({
        name: "Hacked Achievement",
        slug: "hacked",
        description: "You shouldn't see this",
        xp_reward: 99999,
      });

      expect(error).not.toBeNull();
    });

    it("Regular user cannot UPDATE an achievement", async () => {
      const { data: achievements } = await adminClient
        .from("achievements")
        .select("id, xp_reward")
        .limit(1);

      if (achievements && achievements.length > 0) {
        const originalXP = achievements[0].xp_reward;

        await clientA
          .from("achievements")
          .update({ xp_reward: 99999 })
          .eq("id", achievements[0].id);

        // Verify unchanged
        const { data } = await adminClient
          .from("achievements")
          .select("xp_reward")
          .eq("id", achievements[0].id)
          .single();

        expect(data?.xp_reward).toBe(originalXP);
      }
    });
  });
});
