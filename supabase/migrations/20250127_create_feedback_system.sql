-- =====================================================
-- FEEDBACK SYSTEM MIGRATION
-- Creates tables for bug reports, admin replies, and notifications
-- =====================================================

-- =====================================================
-- 1. FEEDBACK REPORTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.feedback_reports (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Report content
  description TEXT NOT NULL,
  page_feature TEXT,
  steps_to_reproduce TEXT,
  when_started TEXT CHECK (when_started IN ('just_now', 'after_update', 'sometimes', 'always')),

  -- Device info (auto-detected)
  device_info JSONB DEFAULT '{}'::jsonb,

  -- Screenshot
  screenshot_url TEXT,

  -- Admin tracking
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
  is_verified_bug BOOLEAN DEFAULT false,
  admin_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. FEEDBACK REPLIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.feedback_replies (
  id SERIAL PRIMARY KEY,
  feedback_id INTEGER NOT NULL REFERENCES public.feedback_reports(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  message TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. USER NOTIFICATIONS TABLE (General purpose)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('feedback_reply', 'feedback_status', 'system')),
  title TEXT NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_feedback_reports_user_id ON public.feedback_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_status ON public.feedback_reports(status);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_created_at ON public.feedback_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_verified ON public.feedback_reports(user_id, is_verified_bug) WHERE is_verified_bug = true;

CREATE INDEX IF NOT EXISTS idx_feedback_replies_feedback_id ON public.feedback_replies(feedback_id);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON public.user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON public.user_notifications(user_id, is_read) WHERE NOT is_read;

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5.1 FEEDBACK REPORTS POLICIES
-- =====================================================

-- Users can create their own feedback
CREATE POLICY "Users can create feedback" ON public.feedback_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback" ON public.feedback_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback" ON public.feedback_reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can update feedback (status, is_verified_bug, admin_notes)
CREATE POLICY "Admins can update feedback" ON public.feedback_reports
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =====================================================
-- 5.2 FEEDBACK REPLIES POLICIES
-- =====================================================

-- Users can view non-internal replies to their feedback
CREATE POLICY "Users can view own feedback replies" ON public.feedback_replies
  FOR SELECT TO authenticated
  USING (
    NOT is_internal AND
    EXISTS (SELECT 1 FROM public.feedback_reports WHERE id = feedback_id AND user_id = auth.uid())
  );

-- Admins can view all replies (including internal)
CREATE POLICY "Admins can view all replies" ON public.feedback_replies
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can create replies
CREATE POLICY "Admins can create replies" ON public.feedback_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =====================================================
-- 5.3 USER NOTIFICATIONS POLICIES
-- =====================================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON public.user_notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON public.user_notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can insert notifications for any user
CREATE POLICY "Admins can create notifications" ON public.user_notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =====================================================
-- 6. UPDATED_AT TRIGGER FOR FEEDBACK_REPORTS
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feedback_reports_updated_at
  BEFORE UPDATE ON public.feedback_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_feedback_updated_at();
