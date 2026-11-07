-- PrepSPSC RLS Policy Fixes
-- Run these in the Supabase SQL Editor to tighten security

-- ============================================================
-- 1. PROFILES: Restrict to authenticated users only
-- ============================================================

-- Remove overly permissive public read policy
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Users can view their own full profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Authenticated users can view basic profile info of others (for leaderboard, rooms, etc.)
CREATE POLICY "Authenticated users can view profiles" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 2. MESSAGES: Restrict to authenticated users
-- ============================================================

-- Remove overly permissive message visibility
DROP POLICY IF EXISTS "Messages are viewable by everyone" ON public.messages;
DROP POLICY IF EXISTS "Messages viewable based on scope" ON public.messages;

-- Only authenticated users can read messages
CREATE POLICY "Authenticated users can view messages" ON public.messages
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 3. PAYMENTS: Remove user-facing UPDATE policy
-- ============================================================

-- Users should NOT be able to update their own payment status
-- Only the server (via service_role) should update payment records
DROP POLICY IF EXISTS "Users can update own payments" ON public.payments;

-- Keep read-only access for users to view their payment history
-- (The "Users can view own payments" SELECT policy should remain)
