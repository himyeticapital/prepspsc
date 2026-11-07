-- ============================================================
-- Phase H: Write-Ownership RLS Policies
-- ============================================================
-- PURPOSE: Add ownership-based INSERT/UPDATE/DELETE policies
-- so users can only write their own data.
--
-- SELECT policies are NOT touched — cross-user reads
-- (leaderboards, rooms, chat, presence) remain functional.
--
-- Run this in Supabase SQL Editor after supabase-rls-fixes-v2.sql
-- ============================================================

-- ============================================================
-- 1. PROFILES (ownership column: id)
-- ============================================================
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- 2. DAILY_STUDY_LOGS (ownership column: user_id)
-- ============================================================
DROP POLICY IF EXISTS "daily_study_logs_insert_own" ON daily_study_logs;
DROP POLICY IF EXISTS "daily_study_logs_update_own" ON daily_study_logs;
DROP POLICY IF EXISTS "daily_study_logs_delete_own" ON daily_study_logs;
DROP POLICY IF EXISTS "Users can manage own study logs" ON daily_study_logs;

CREATE POLICY "daily_study_logs_insert_own"
  ON daily_study_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "daily_study_logs_update_own"
  ON daily_study_logs FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "daily_study_logs_delete_own"
  ON daily_study_logs FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 3. TEST_ATTEMPTS (ownership column: user_id)
-- ============================================================
DROP POLICY IF EXISTS "test_attempts_insert_own" ON test_attempts;
DROP POLICY IF EXISTS "test_attempts_update_own" ON test_attempts;
DROP POLICY IF EXISTS "test_attempts_delete_own" ON test_attempts;
DROP POLICY IF EXISTS "Users can manage own test attempts" ON test_attempts;

CREATE POLICY "test_attempts_insert_own"
  ON test_attempts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "test_attempts_update_own"
  ON test_attempts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "test_attempts_delete_own"
  ON test_attempts FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 4. BOOKMARKS (ownership column: user_id)
-- ============================================================
DROP POLICY IF EXISTS "bookmarks_insert_own" ON bookmarks;
DROP POLICY IF EXISTS "bookmarks_update_own" ON bookmarks;
DROP POLICY IF EXISTS "bookmarks_delete_own" ON bookmarks;
DROP POLICY IF EXISTS "Users can manage own bookmarks" ON bookmarks;

CREATE POLICY "bookmarks_insert_own"
  ON bookmarks FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "bookmarks_update_own"
  ON bookmarks FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "bookmarks_delete_own"
  ON bookmarks FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 5. PAYMENTS (ownership column: user_id)
-- No DELETE allowed (payment records are immutable)
-- ============================================================
DROP POLICY IF EXISTS "payments_insert_own" ON payments;
DROP POLICY IF EXISTS "payments_update_own" ON payments;
DROP POLICY IF EXISTS "Users can manage own payments" ON payments;

CREATE POLICY "payments_insert_own"
  ON payments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "payments_update_own"
  ON payments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 6. STUDY_GOALS (ownership column: user_id)
-- ============================================================
DROP POLICY IF EXISTS "study_goals_insert_own" ON study_goals;
DROP POLICY IF EXISTS "study_goals_update_own" ON study_goals;
DROP POLICY IF EXISTS "study_goals_delete_own" ON study_goals;
DROP POLICY IF EXISTS "Users can manage own study goals" ON study_goals;

CREATE POLICY "study_goals_insert_own"
  ON study_goals FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "study_goals_update_own"
  ON study_goals FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "study_goals_delete_own"
  ON study_goals FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 7. XP_TRANSACTIONS (ownership column: user_id)
-- INSERT only (XP records are append-only, no update/delete)
-- ============================================================
DROP POLICY IF EXISTS "xp_transactions_insert_own" ON xp_transactions;
DROP POLICY IF EXISTS "Users can insert own xp" ON xp_transactions;

CREATE POLICY "xp_transactions_insert_own"
  ON xp_transactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 8. USER_ACHIEVEMENTS (ownership column: user_id)
-- INSERT only (achievements are permanent, no update/delete)
-- ============================================================
DROP POLICY IF EXISTS "user_achievements_insert_own" ON user_achievements;
DROP POLICY IF EXISTS "Users can insert own achievements" ON user_achievements;

CREATE POLICY "user_achievements_insert_own"
  ON user_achievements FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 9. STUDY_SESSIONS (ownership column: user_id)
-- ============================================================
DROP POLICY IF EXISTS "study_sessions_insert_own" ON study_sessions;
DROP POLICY IF EXISTS "study_sessions_update_own" ON study_sessions;
DROP POLICY IF EXISTS "study_sessions_delete_own" ON study_sessions;
DROP POLICY IF EXISTS "Users can manage own study sessions" ON study_sessions;

CREATE POLICY "study_sessions_insert_own"
  ON study_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "study_sessions_update_own"
  ON study_sessions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "study_sessions_delete_own"
  ON study_sessions FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 10. STUDY_AI_GOALS (ownership column: user_id)
-- ============================================================
DROP POLICY IF EXISTS "study_ai_goals_insert_own" ON study_ai_goals;
DROP POLICY IF EXISTS "study_ai_goals_update_own" ON study_ai_goals;
DROP POLICY IF EXISTS "study_ai_goals_delete_own" ON study_ai_goals;
DROP POLICY IF EXISTS "Users can manage own ai goals" ON study_ai_goals;

CREATE POLICY "study_ai_goals_insert_own"
  ON study_ai_goals FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "study_ai_goals_update_own"
  ON study_ai_goals FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "study_ai_goals_delete_own"
  ON study_ai_goals FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 11. STUDY_UPLOADS (ownership column: user_id)
-- ============================================================
DROP POLICY IF EXISTS "study_uploads_insert_own" ON study_uploads;
DROP POLICY IF EXISTS "study_uploads_update_own" ON study_uploads;
DROP POLICY IF EXISTS "study_uploads_delete_own" ON study_uploads;
DROP POLICY IF EXISTS "Users can manage own uploads" ON study_uploads;

CREATE POLICY "study_uploads_insert_own"
  ON study_uploads FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "study_uploads_update_own"
  ON study_uploads FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "study_uploads_delete_own"
  ON study_uploads FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 12. AI_GENERATIONS (ownership column: user_id)
-- ============================================================
DROP POLICY IF EXISTS "ai_generations_insert_own" ON ai_generations;
DROP POLICY IF EXISTS "ai_generations_update_own" ON ai_generations;
DROP POLICY IF EXISTS "ai_generations_delete_own" ON ai_generations;
DROP POLICY IF EXISTS "Users can manage own generations" ON ai_generations;

CREATE POLICY "ai_generations_insert_own"
  ON ai_generations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ai_generations_update_own"
  ON ai_generations FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ai_generations_delete_own"
  ON ai_generations FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 13. REVISION_ITEMS (ownership column: user_id)
-- ============================================================
DROP POLICY IF EXISTS "revision_items_insert_own" ON revision_items;
DROP POLICY IF EXISTS "revision_items_update_own" ON revision_items;
DROP POLICY IF EXISTS "revision_items_delete_own" ON revision_items;
DROP POLICY IF EXISTS "Users can manage own revisions" ON revision_items;

CREATE POLICY "revision_items_insert_own"
  ON revision_items FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "revision_items_update_own"
  ON revision_items FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "revision_items_delete_own"
  ON revision_items FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 14. BLURT_SESSIONS (ownership column: user_id)
-- ============================================================
DROP POLICY IF EXISTS "blurt_sessions_insert_own" ON blurt_sessions;
DROP POLICY IF EXISTS "blurt_sessions_update_own" ON blurt_sessions;
DROP POLICY IF EXISTS "blurt_sessions_delete_own" ON blurt_sessions;
DROP POLICY IF EXISTS "Users can manage own blurt sessions" ON blurt_sessions;

CREATE POLICY "blurt_sessions_insert_own"
  ON blurt_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "blurt_sessions_update_own"
  ON blurt_sessions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "blurt_sessions_delete_own"
  ON blurt_sessions FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 15. STUDY_AI_NOTIFICATIONS (ownership column: user_id)
-- ============================================================
DROP POLICY IF EXISTS "study_ai_notifications_insert_own" ON study_ai_notifications;
DROP POLICY IF EXISTS "study_ai_notifications_update_own" ON study_ai_notifications;
DROP POLICY IF EXISTS "study_ai_notifications_delete_own" ON study_ai_notifications;
DROP POLICY IF EXISTS "Users can manage own ai notifications" ON study_ai_notifications;

CREATE POLICY "study_ai_notifications_insert_own"
  ON study_ai_notifications FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "study_ai_notifications_update_own"
  ON study_ai_notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "study_ai_notifications_delete_own"
  ON study_ai_notifications FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 16. ROOM_NOTIFICATIONS (ownership column: user_id)
-- ============================================================
DROP POLICY IF EXISTS "room_notifications_insert_own" ON room_notifications;
DROP POLICY IF EXISTS "room_notifications_update_own" ON room_notifications;
DROP POLICY IF EXISTS "room_notifications_delete_own" ON room_notifications;
DROP POLICY IF EXISTS "Users can manage own room notifications" ON room_notifications;

CREATE POLICY "room_notifications_insert_own"
  ON room_notifications FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "room_notifications_update_own"
  ON room_notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "room_notifications_delete_own"
  ON room_notifications FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 17. MESSAGES (ownership column: user_id)
-- Users can only send/edit/delete their own messages
-- ============================================================
DROP POLICY IF EXISTS "messages_insert_own" ON messages;
DROP POLICY IF EXISTS "messages_update_own" ON messages;
DROP POLICY IF EXISTS "messages_delete_own" ON messages;
DROP POLICY IF EXISTS "Users can manage own messages" ON messages;

CREATE POLICY "messages_insert_own"
  ON messages FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "messages_update_own"
  ON messages FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "messages_delete_own"
  ON messages FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 18. USER_ROOM_SUBSCRIPTIONS (ownership column: user_id)
-- Users can only manage their own room subscriptions
-- ============================================================
DROP POLICY IF EXISTS "user_room_subscriptions_insert_own" ON user_room_subscriptions;
DROP POLICY IF EXISTS "user_room_subscriptions_update_own" ON user_room_subscriptions;
DROP POLICY IF EXISTS "user_room_subscriptions_delete_own" ON user_room_subscriptions;
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON user_room_subscriptions;

CREATE POLICY "user_room_subscriptions_insert_own"
  ON user_room_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_room_subscriptions_update_own"
  ON user_room_subscriptions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_room_subscriptions_delete_own"
  ON user_room_subscriptions FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 19. ROOM_PRESENCE (ownership column: user_id)
-- Users can only manage their own presence
-- ============================================================
DROP POLICY IF EXISTS "room_presence_insert_own" ON room_presence;
DROP POLICY IF EXISTS "room_presence_update_own" ON room_presence;
DROP POLICY IF EXISTS "room_presence_delete_own" ON room_presence;
DROP POLICY IF EXISTS "Users can manage own presence" ON room_presence;

CREATE POLICY "room_presence_insert_own"
  ON room_presence FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "room_presence_update_own"
  ON room_presence FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "room_presence_delete_own"
  ON room_presence FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 20. TABLE_MEMBERS (ownership column: user_id)
-- Users can only join/leave tables as themselves
-- ============================================================
DROP POLICY IF EXISTS "table_members_insert_own" ON table_members;
DROP POLICY IF EXISTS "table_members_update_own" ON table_members;
DROP POLICY IF EXISTS "table_members_delete_own" ON table_members;
DROP POLICY IF EXISTS "Users can manage own table membership" ON table_members;

CREATE POLICY "table_members_insert_own"
  ON table_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "table_members_update_own"
  ON table_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "table_members_delete_own"
  ON table_members FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 21. STUDY_TABLES (ownership column: created_by)
-- Only creator can update/delete their table
-- Any authenticated user can create a table
-- ============================================================
DROP POLICY IF EXISTS "study_tables_insert_own" ON study_tables;
DROP POLICY IF EXISTS "study_tables_update_own" ON study_tables;
DROP POLICY IF EXISTS "study_tables_delete_own" ON study_tables;
DROP POLICY IF EXISTS "Users can manage own tables" ON study_tables;

CREATE POLICY "study_tables_insert_own"
  ON study_tables FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "study_tables_update_own"
  ON study_tables FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "study_tables_delete_own"
  ON study_tables FOR DELETE
  USING (created_by = auth.uid());

-- ============================================================
-- 22. ROOMS (ownership column: owner_id)
-- Only owner can update/delete their room
-- Any authenticated user can create a room
-- ============================================================
DROP POLICY IF EXISTS "rooms_insert_own" ON rooms;
DROP POLICY IF EXISTS "rooms_update_own" ON rooms;
DROP POLICY IF EXISTS "rooms_delete_own" ON rooms;
DROP POLICY IF EXISTS "Users can manage own rooms" ON rooms;

CREATE POLICY "rooms_insert_own"
  ON rooms FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "rooms_update_own"
  ON rooms FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "rooms_delete_own"
  ON rooms FOR DELETE
  USING (owner_id = auth.uid());

-- ============================================================
-- ADMIN-ONLY TABLES: tests, questions, exam_categories,
-- achievements, profile_frames, room_categories, test_sections
-- No write policies for regular users (RLS denies by default)
-- Admin operations use service_role key via API routes
-- ============================================================

-- Done! All write operations now require ownership verification.
-- SELECT policies remain unchanged — cross-user reads still work.
