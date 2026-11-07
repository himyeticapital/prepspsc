-- Fix RLS policies for rooms table
-- Run this ENTIRE script in your Supabase SQL Editor

-- ============================================
-- STEP 1: Check your current user's profile
-- ============================================
-- Run this first to see your user info:
SELECT
  auth.uid() as your_user_id,
  p.id as profile_id,
  p.role as your_role,
  p.username,
  p.full_name
FROM profiles p
WHERE p.id = auth.uid();

-- ============================================
-- STEP 2: If your role is NOT 'admin', run this to make yourself admin:
-- ============================================
UPDATE profiles
SET role = 'admin'
WHERE id = auth.uid();

-- ============================================
-- STEP 3: Drop ALL existing room policies
-- ============================================
DROP POLICY IF EXISTS "Admins can manage rooms" ON rooms;
DROP POLICY IF EXISTS "Users can read active rooms" ON rooms;
DROP POLICY IF EXISTS "Anyone can read rooms" ON rooms;
DROP POLICY IF EXISTS "Admins can insert rooms" ON rooms;
DROP POLICY IF EXISTS "Admins can update rooms" ON rooms;
DROP POLICY IF EXISTS "Admins can delete rooms" ON rooms;
DROP POLICY IF EXISTS "Enable read access for all users" ON rooms;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON rooms;
DROP POLICY IF EXISTS "Enable update for users based on role" ON rooms;
DROP POLICY IF EXISTS "Enable delete for users based on role" ON rooms;

-- ============================================
-- STEP 4: Create new policies
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- Policy 1: Anyone authenticated can read rooms
CREATE POLICY "Anyone can read rooms"
  ON rooms FOR SELECT
  TO authenticated
  USING (true);

-- Policy 2: Admins and teachers can insert rooms
CREATE POLICY "Admins can insert rooms"
  ON rooms FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'teacher')
    )
  );

-- Policy 3: Admins and teachers can update rooms
CREATE POLICY "Admins can update rooms"
  ON rooms FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'teacher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'teacher')
    )
  );

-- Policy 4: Admins and teachers can delete rooms
CREATE POLICY "Admins can delete rooms"
  ON rooms FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'teacher')
    )
  );

-- ============================================
-- STEP 5: Verify policies were created
-- ============================================
SELECT
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE tablename = 'rooms';

-- ============================================
-- STEP 6: Verify your role is admin
-- ============================================
SELECT id, username, role FROM profiles WHERE id = auth.uid();
