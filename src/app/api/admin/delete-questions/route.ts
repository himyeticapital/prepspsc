import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { applyRateLimit } from "@/lib/rate-limit";
import { validateBody, deleteQuestionsSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const authClient = await createAuthClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin role verification
    const { data: profile } = await authClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "teacher"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limiting
    const rateLimitResponse = await applyRateLimit(request, "admin", user.id);
    if (rateLimitResponse) return rateLimitResponse;

    let rawBody;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validation = validateBody(deleteQuestionsSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    const { questionIds, testId, deleteAll } = validation.data;

    // Use service role for deletion operations (bypasses RLS for cascading deletes)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let idsToDelete: number[] = questionIds || [];

    // If deleteAll is true, fetch all question IDs for the test
    if (deleteAll && testId) {
      const { data: questions, error: fetchError } = await supabase
        .from("questions")
        .select("id")
        .eq("test_id", testId);

      if (fetchError) {
        return NextResponse.json(
          { error: "Failed to fetch questions" },
          { status: 500 }
        );
      }

      idsToDelete = questions?.map((q) => q.id) || [];
    }

    if (idsToDelete.length === 0) {
      return NextResponse.json({ success: true, deleted: 0 });
    }

    // Delete related user_answers first
    const { error: answersError } = await supabase
      .from("user_answers")
      .delete()
      .in("question_id", idsToDelete);

    if (answersError) {
      console.error("Error deleting user answers:", answersError);
    }

    // Delete related bookmarks
    const { error: bookmarksError } = await supabase
      .from("bookmarks")
      .delete()
      .in("question_id", idsToDelete);

    if (bookmarksError) {
      console.error("Error deleting bookmarks:", bookmarksError);
    }

    // Now delete the questions
    const { error: deleteError } = await supabase
      .from("questions")
      .delete()
      .in("id", idsToDelete);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete questions" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deleted: idsToDelete.length,
    });
  } catch (error) {
    console.error("Delete questions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
