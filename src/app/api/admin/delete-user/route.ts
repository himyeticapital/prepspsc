import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { applyRateLimit } from "@/lib/rate-limit";

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

    // Admin role verification - ONLY admins can delete users
    const { data: profile } = await authClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Only admins can delete users" }, { status: 403 });
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

    const { userId } = rawBody;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Prevent admins from deleting themselves
    if (userId === user.id) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
    }

    // Use service role for deletion operations (bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify target user exists and is not an admin
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("role, full_name, username")
      .eq("id", userId)
      .single();

    if (!targetProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent deleting other admins
    if (targetProfile.role === "admin") {
      return NextResponse.json({ error: "Cannot delete admin users" }, { status: 403 });
    }

    console.log(`[Admin] Deleting user: ${targetProfile.full_name || targetProfile.username || userId}`);

    // Delete all related data in order (respecting foreign key constraints)
    // Each deletion is non-blocking - we log errors but continue
    const deletionResults: Record<string, { deleted: number; error?: string }> = {};

    // 1. Delete user_answers
    const { error: answersErr, count: answersCount } = await supabase
      .from("user_answers")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.user_answers = { deleted: answersCount || 0, error: answersErr?.message };

    // 2. Delete test_attempts
    const { error: attemptsErr, count: attemptsCount } = await supabase
      .from("test_attempts")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.test_attempts = { deleted: attemptsCount || 0, error: attemptsErr?.message };

    // 3. Delete bookmarks
    const { error: bookmarksErr, count: bookmarksCount } = await supabase
      .from("bookmarks")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.bookmarks = { deleted: bookmarksCount || 0, error: bookmarksErr?.message };

    // 4. Delete daily_study_logs
    const { error: logsErr, count: logsCount } = await supabase
      .from("daily_study_logs")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.daily_study_logs = { deleted: logsCount || 0, error: logsErr?.message };

    // 5. Delete study_sessions
    const { error: sessionsErr, count: sessionsCount } = await supabase
      .from("study_sessions")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.study_sessions = { deleted: sessionsCount || 0, error: sessionsErr?.message };

    // 6. Delete xp_transactions
    const { error: xpErr, count: xpCount } = await supabase
      .from("xp_transactions")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.xp_transactions = { deleted: xpCount || 0, error: xpErr?.message };

    // 7. Delete user_achievements
    const { error: achievementsErr, count: achievementsCount } = await supabase
      .from("user_achievements")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.user_achievements = { deleted: achievementsCount || 0, error: achievementsErr?.message };

    // 8. Delete payments
    const { error: paymentsErr, count: paymentsCount } = await supabase
      .from("payments")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.payments = { deleted: paymentsCount || 0, error: paymentsErr?.message };

    // 9. Delete messages
    const { error: messagesErr, count: messagesCount } = await supabase
      .from("messages")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.messages = { deleted: messagesCount || 0, error: messagesErr?.message };

    // 10. Delete room_presence
    const { error: presenceErr, count: presenceCount } = await supabase
      .from("room_presence")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.room_presence = { deleted: presenceCount || 0, error: presenceErr?.message };

    // 11. Delete table_members
    const { error: tableMembersErr, count: tableMembersCount } = await supabase
      .from("table_members")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.table_members = { deleted: tableMembersCount || 0, error: tableMembersErr?.message };

    // 12. Delete user_room_subscriptions
    const { error: subsErr, count: subsCount } = await supabase
      .from("user_room_subscriptions")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.user_room_subscriptions = { deleted: subsCount || 0, error: subsErr?.message };

    // 13. Delete room_notifications
    const { error: roomNotifErr, count: roomNotifCount } = await supabase
      .from("room_notifications")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.room_notifications = { deleted: roomNotifCount || 0, error: roomNotifErr?.message };

    // 14. Delete room_bans
    const { error: bansErr, count: bansCount } = await supabase
      .from("room_bans")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.room_bans = { deleted: bansCount || 0, error: bansErr?.message };

    // 15. Delete ai_generations
    const { error: genErr, count: genCount } = await supabase
      .from("ai_generations")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.ai_generations = { deleted: genCount || 0, error: genErr?.message };

    // 16. Delete study_uploads
    const { error: uploadsErr, count: uploadsCount } = await supabase
      .from("study_uploads")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.study_uploads = { deleted: uploadsCount || 0, error: uploadsErr?.message };

    // 17. Delete study_ai_goals
    const { error: goalsErr, count: goalsCount } = await supabase
      .from("study_ai_goals")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.study_ai_goals = { deleted: goalsCount || 0, error: goalsErr?.message };

    // 18. Delete revision_items
    const { error: revisionErr, count: revisionCount } = await supabase
      .from("revision_items")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.revision_items = { deleted: revisionCount || 0, error: revisionErr?.message };

    // 19. Delete blurt_sessions
    const { error: blurtErr, count: blurtCount } = await supabase
      .from("blurt_sessions")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.blurt_sessions = { deleted: blurtCount || 0, error: blurtErr?.message };

    // 20. Delete study_ai_notifications
    const { error: studyNotifErr, count: studyNotifCount } = await supabase
      .from("study_ai_notifications")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.study_ai_notifications = { deleted: studyNotifCount || 0, error: studyNotifErr?.message };

    // 21. Delete study_goals
    const { error: studyGoalsErr, count: studyGoalsCount } = await supabase
      .from("study_goals")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.study_goals = { deleted: studyGoalsCount || 0, error: studyGoalsErr?.message };

    // 22. Delete user_permissions
    const { error: permsErr, count: permsCount } = await supabase
      .from("user_permissions")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    deletionResults.user_permissions = { deleted: permsCount || 0, error: permsErr?.message };

    // Finally, delete the profile
    const { error: profileErr } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileErr) {
      console.error("[Admin] Failed to delete profile:", profileErr);
      return NextResponse.json(
        { error: "Failed to delete user profile", details: profileErr.message },
        { status: 500 }
      );
    }

    // Optionally delete the auth user (requires admin API)
    // This uses the Supabase Admin API
    try {
      const { error: authDeleteErr } = await supabase.auth.admin.deleteUser(userId);
      if (authDeleteErr) {
        console.error("[Admin] Failed to delete auth user:", authDeleteErr);
        // Don't fail the entire operation - profile is already deleted
      }
    } catch (authErr) {
      console.error("[Admin] Auth deletion error:", authErr);
      // Continue - profile deletion was successful
    }

    console.log(`[Admin] User deleted successfully:`, deletionResults);

    return NextResponse.json({
      success: true,
      message: `User ${targetProfile.full_name || targetProfile.username || userId} deleted successfully`,
      deletionResults,
    });
  } catch (error) {
    console.error("[Admin] Delete user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
