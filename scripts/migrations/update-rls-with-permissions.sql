-- Migration: Update RLS policies to use granular permissions
-- Run this AFTER running add-user-permissions.sql
-- Run this in Supabase SQL Editor

-- ============================================
-- ROOMS TABLE - Use permission-based access
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can insert rooms" ON rooms;
DROP POLICY IF EXISTS "Admins can update rooms" ON rooms;
DROP POLICY IF EXISTS "Admins can delete rooms" ON rooms;

-- Policy: Users with CREATE_ROOMS permission can create rooms
CREATE POLICY "Users with permission can insert rooms"
  ON rooms FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admins always have access
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR
    -- Teachers with CREATE_ROOMS permission
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'create_rooms'
    )
  );

-- Policy: Users with EDIT_ROOMS permission can update rooms
CREATE POLICY "Users with permission can update rooms"
  ON rooms FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'edit_rooms'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'edit_rooms'
    )
  );

-- Policy: Users with DELETE_ROOMS permission can delete rooms
CREATE POLICY "Users with permission can delete rooms"
  ON rooms FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'delete_rooms'
    )
  );

-- ============================================
-- ROOM MESSAGES TABLE - Use permission-based access for moderation
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_messages') THEN
    -- Drop existing delete policy if exists
    DROP POLICY IF EXISTS "Admins and teachers can delete messages" ON room_messages;
    DROP POLICY IF EXISTS "Users with permission can delete messages" ON room_messages;

    -- Policy: Users with DELETE_MESSAGES permission can delete any message
    EXECUTE 'CREATE POLICY "Users with permission can delete messages"
      ON room_messages FOR DELETE
      TO authenticated
      USING (
        -- Users can delete their own messages
        user_id = auth.uid()
        OR
        -- Admins can delete any message
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = ''admin''
        )
        OR
        -- Users with DELETE_MESSAGES permission can delete any message
        EXISTS (
          SELECT 1 FROM user_permissions
          WHERE user_permissions.user_id = auth.uid()
          AND user_permissions.permission = ''delete_messages''
        )
      )';
  END IF;
END $$;

-- ============================================
-- TESTS/QUESTIONS TABLE POLICIES (if they exist)
-- ============================================

-- Check if tests table exists and update policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tests') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Admins can manage tests" ON tests;
    DROP POLICY IF EXISTS "Users with permission can insert tests" ON tests;
    DROP POLICY IF EXISTS "Users with permission can update tests" ON tests;
    DROP POLICY IF EXISTS "Users with permission can delete tests" ON tests;

    -- Create new permission-based policies
    EXECUTE 'CREATE POLICY "Users with permission can insert tests"
      ON tests FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = ''admin''
        )
        OR
        EXISTS (
          SELECT 1 FROM user_permissions
          WHERE user_permissions.user_id = auth.uid()
          AND user_permissions.permission = ''create_tests''
        )
      )';

    EXECUTE 'CREATE POLICY "Users with permission can update tests"
      ON tests FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = ''admin''
        )
        OR
        EXISTS (
          SELECT 1 FROM user_permissions
          WHERE user_permissions.user_id = auth.uid()
          AND user_permissions.permission = ''edit_tests''
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = ''admin''
        )
        OR
        EXISTS (
          SELECT 1 FROM user_permissions
          WHERE user_permissions.user_id = auth.uid()
          AND user_permissions.permission = ''edit_tests''
        )
      )';

    EXECUTE 'CREATE POLICY "Users with permission can delete tests"
      ON tests FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = ''admin''
        )
        OR
        EXISTS (
          SELECT 1 FROM user_permissions
          WHERE user_permissions.user_id = auth.uid()
          AND user_permissions.permission = ''delete_tests''
        )
      )';
  END IF;
END $$;

-- Check if questions table exists and update policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'questions') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Admins can manage questions" ON questions;
    DROP POLICY IF EXISTS "Users with permission can insert questions" ON questions;
    DROP POLICY IF EXISTS "Users with permission can update questions" ON questions;
    DROP POLICY IF EXISTS "Users with permission can delete questions" ON questions;

    -- Create new permission-based policies
    EXECUTE 'CREATE POLICY "Users with permission can insert questions"
      ON questions FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = ''admin''
        )
        OR
        EXISTS (
          SELECT 1 FROM user_permissions
          WHERE user_permissions.user_id = auth.uid()
          AND user_permissions.permission = ''upload_questions''
        )
      )';

    EXECUTE 'CREATE POLICY "Users with permission can update questions"
      ON questions FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = ''admin''
        )
        OR
        EXISTS (
          SELECT 1 FROM user_permissions
          WHERE user_permissions.user_id = auth.uid()
          AND user_permissions.permission = ''edit_questions''
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = ''admin''
        )
        OR
        EXISTS (
          SELECT 1 FROM user_permissions
          WHERE user_permissions.user_id = auth.uid()
          AND user_permissions.permission = ''edit_questions''
        )
      )';

    EXECUTE 'CREATE POLICY "Users with permission can delete questions"
      ON questions FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = ''admin''
        )
        OR
        EXISTS (
          SELECT 1 FROM user_permissions
          WHERE user_permissions.user_id = auth.uid()
          AND user_permissions.permission = ''delete_questions''
        )
      )';
  END IF;
END $$;

-- ============================================
-- Verify policies
-- ============================================
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('rooms', 'room_messages', 'tests', 'questions', 'user_permissions')
ORDER BY tablename, policyname;
