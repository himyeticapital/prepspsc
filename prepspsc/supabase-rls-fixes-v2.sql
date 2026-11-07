-- PrepSPSC RLS Policy Fixes v2
-- Additional tightening: require authentication for all tables
-- Run in Supabase SQL Editor after supabase-rls-fixes.sql

-- ============================================================
-- 1. STUDY TABLES: Require authentication
-- ============================================================

DROP POLICY IF EXISTS "Tables are viewable by everyone" ON public.study_tables;

CREATE POLICY "Authenticated users can view tables" ON public.study_tables
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 2. TABLE MEMBERS: Require authentication
-- ============================================================

DROP POLICY IF EXISTS "Table members are viewable by everyone" ON public.table_members;

CREATE POLICY "Authenticated users can view table members" ON public.table_members
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 3. ROOM PRESENCE: Require authentication
-- ============================================================

DROP POLICY IF EXISTS "Anyone can view presence" ON public.room_presence;

CREATE POLICY "Authenticated users can view presence" ON public.room_presence
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 4. ROOMS: Require authentication
-- ============================================================

DROP POLICY IF EXISTS "Rooms are viewable by everyone" ON public.rooms;

CREATE POLICY "Authenticated users can view rooms" ON public.rooms
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 5. USER ACHIEVEMENTS: Require authentication
-- ============================================================

DROP POLICY IF EXISTS "Anyone can view user achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "User achievements are viewable by everyone" ON public.user_achievements;

CREATE POLICY "Authenticated users can view achievements" ON public.user_achievements
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 6. ROOM CATEGORIES: Require authentication
-- ============================================================

DROP POLICY IF EXISTS "Anyone can view room categories" ON public.room_categories;
DROP POLICY IF EXISTS "Room categories are viewable by everyone" ON public.room_categories;

CREATE POLICY "Authenticated users can view room categories" ON public.room_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 7. TESTS & QUESTIONS: Require authentication
-- ============================================================

DROP POLICY IF EXISTS "Tests are viewable by everyone" ON public.tests;
DROP POLICY IF EXISTS "Questions are viewable by everyone" ON public.questions;

CREATE POLICY "Authenticated users can view tests" ON public.tests
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view questions" ON public.questions
  FOR SELECT USING (auth.uid() IS NOT NULL);
