-- Migration: Add admin and teacher user management capabilities
-- Run this in Supabase SQL Editor to allow admins and teachers to manage user roles

-- Drop existing policies if they conflict
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can update non-admin profiles" ON public.profiles;

-- Create policy for admins to update any user's profile (including role)
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Create policy for teachers to update non-admin profiles
-- Teachers can change users to 'user' or 'teacher' roles, but not to 'admin'
-- Teachers cannot modify admin accounts
CREATE POLICY "Teachers can update non-admin profiles" ON public.profiles
  FOR UPDATE USING (
    -- Current user must be a teacher
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
    -- Target user must NOT be an admin
    AND role != 'admin'
  )
  WITH CHECK (
    -- Teachers can only set role to 'user' or 'teacher', not 'admin'
    role IN ('user', 'teacher')
  );

-- Verify the policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles';
