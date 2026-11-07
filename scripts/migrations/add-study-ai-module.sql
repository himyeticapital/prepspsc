-- Study with AI Module Migration
-- Run this migration to add Study AI tables for goals, uploads, generations, revision, and blurting

-- ============================================
-- 1. Extend profiles table with Study AI tracking fields
-- ============================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS study_ai_generations_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS study_ai_last_generation_date DATE;

-- ============================================
-- 2. Create study_ai_goals table (different from timer study_goals)
-- ============================================
CREATE TABLE IF NOT EXISTS study_ai_goals (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  goal_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  next_revision_at TIMESTAMP WITH TIME ZONE,
  revision_count INTEGER DEFAULT 0,
  last_revised_at TIMESTAMP WITH TIME ZONE,
  leitner_box INTEGER DEFAULT 1 CHECK (leitner_box >= 1 AND leitner_box <= 5),
  is_archived BOOLEAN DEFAULT false
);

-- Create indexes for study_ai_goals
CREATE INDEX IF NOT EXISTS idx_study_ai_goals_user_id ON study_ai_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_study_ai_goals_next_revision ON study_ai_goals(next_revision_at);
CREATE INDEX IF NOT EXISTS idx_study_ai_goals_archived ON study_ai_goals(is_archived);

-- ============================================
-- 3. Create study_uploads table
-- ============================================
CREATE TABLE IF NOT EXISTS study_uploads (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  goal_id INTEGER REFERENCES study_ai_goals(id) ON DELETE CASCADE,
  upload_type TEXT NOT NULL CHECK (upload_type IN ('pdf', 'image', 'youtube', 'anki')),
  file_url TEXT,
  file_name TEXT,
  extracted_text TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for study_uploads
CREATE INDEX IF NOT EXISTS idx_study_uploads_user_id ON study_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_study_uploads_goal_id ON study_uploads(goal_id);

-- ============================================
-- 4. Create ai_generations table
-- ============================================
CREATE TABLE IF NOT EXISTS ai_generations (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  goal_id INTEGER REFERENCES study_ai_goals(id) ON DELETE CASCADE,
  generation_type TEXT NOT NULL CHECK (generation_type IN ('mindmap', 'summary', 'flashcards', 'quiz', 'infographic')),
  output_data JSONB NOT NULL,
  title TEXT,
  is_saved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for ai_generations
CREATE INDEX IF NOT EXISTS idx_ai_generations_user_id ON ai_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_generations_goal_id ON ai_generations(goal_id);
CREATE INDEX IF NOT EXISTS idx_ai_generations_type ON ai_generations(generation_type);
CREATE INDEX IF NOT EXISTS idx_ai_generations_saved ON ai_generations(is_saved);

-- ============================================
-- 5. Create revision_items table (for individual flashcards/quiz questions SRS)
-- ============================================
CREATE TABLE IF NOT EXISTS revision_items (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  generation_id INTEGER REFERENCES ai_generations(id) ON DELETE CASCADE,
  item_index INTEGER NOT NULL,
  leitner_box INTEGER DEFAULT 1 CHECK (leitner_box >= 1 AND leitner_box <= 5),
  next_review_at TIMESTAMP WITH TIME ZONE,
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  review_count INTEGER DEFAULT 0,
  item_type TEXT NOT NULL CHECK (item_type IN ('flashcard', 'quiz_question')),
  front_content TEXT,
  back_content TEXT,
  is_active BOOLEAN DEFAULT true
);

-- Create indexes for revision_items
CREATE INDEX IF NOT EXISTS idx_revision_items_user_id ON revision_items(user_id);
CREATE INDEX IF NOT EXISTS idx_revision_items_generation_id ON revision_items(generation_id);
CREATE INDEX IF NOT EXISTS idx_revision_items_next_review ON revision_items(next_review_at);
CREATE INDEX IF NOT EXISTS idx_revision_items_active ON revision_items(is_active);

-- ============================================
-- 6. Create blurt_sessions table
-- ============================================
CREATE TABLE IF NOT EXISTS blurt_sessions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  goal_id INTEGER REFERENCES study_ai_goals(id) ON DELETE CASCADE,
  topic TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('digital', 'paper')),
  user_input TEXT,
  paper_image_url TEXT,
  ai_analysis JSONB,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  xp_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for blurt_sessions
CREATE INDEX IF NOT EXISTS idx_blurt_sessions_user_id ON blurt_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_blurt_sessions_goal_id ON blurt_sessions(goal_id);
CREATE INDEX IF NOT EXISTS idx_blurt_sessions_created_at ON blurt_sessions(created_at DESC);

-- ============================================
-- 7. Create study_ai_notifications table
-- ============================================
CREATE TABLE IF NOT EXISTS study_ai_notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  goal_id INTEGER REFERENCES study_ai_goals(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('revision_due')),
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for study_ai_notifications
CREATE INDEX IF NOT EXISTS idx_study_ai_notifications_user_id ON study_ai_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_study_ai_notifications_read ON study_ai_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_study_ai_notifications_created_at ON study_ai_notifications(created_at DESC);

-- ============================================
-- 8. Enable RLS on all tables
-- ============================================
ALTER TABLE study_ai_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE revision_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE blurt_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_ai_notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 9. Create RLS policies
-- ============================================

-- Study AI Goals: Users can only manage their own
CREATE POLICY "Users can manage their own study AI goals" ON study_ai_goals
  FOR ALL USING (auth.uid() = user_id);

-- Study Uploads: Users can only manage their own
CREATE POLICY "Users can manage their own study uploads" ON study_uploads
  FOR ALL USING (auth.uid() = user_id);

-- AI Generations: Users can only manage their own
CREATE POLICY "Users can manage their own AI generations" ON ai_generations
  FOR ALL USING (auth.uid() = user_id);

-- Revision Items: Users can only manage their own
CREATE POLICY "Users can manage their own revision items" ON revision_items
  FOR ALL USING (auth.uid() = user_id);

-- Blurt Sessions: Users can only manage their own
CREATE POLICY "Users can manage their own blurt sessions" ON blurt_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Study AI Notifications: Users can only manage their own
CREATE POLICY "Users can manage their own study AI notifications" ON study_ai_notifications
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 10. Create helper functions
-- ============================================

-- Function to calculate next revision date based on Leitner box
CREATE OR REPLACE FUNCTION calculate_next_revision(p_leitner_box INTEGER)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
  RETURN NOW() + CASE p_leitner_box
    WHEN 1 THEN INTERVAL '1 day'
    WHEN 2 THEN INTERVAL '3 days'
    WHEN 3 THEN INTERVAL '7 days'
    WHEN 4 THEN INTERVAL '14 days'
    WHEN 5 THEN INTERVAL '30 days'
    ELSE INTERVAL '1 day'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update study goal revision after marking as revised
CREATE OR REPLACE FUNCTION update_goal_revision(
  p_goal_id INTEGER,
  p_rating TEXT -- 'easy', 'hard', 'again'
)
RETURNS void AS $$
DECLARE
  v_current_box INTEGER;
  v_new_box INTEGER;
BEGIN
  -- Get current Leitner box
  SELECT leitner_box INTO v_current_box
  FROM study_ai_goals WHERE id = p_goal_id;

  -- Calculate new box based on rating
  v_new_box := CASE p_rating
    WHEN 'easy' THEN LEAST(v_current_box + 1, 5)
    WHEN 'hard' THEN v_current_box
    WHEN 'again' THEN 1
    ELSE v_current_box
  END;

  -- Update goal
  UPDATE study_ai_goals
  SET
    leitner_box = v_new_box,
    revision_count = revision_count + 1,
    last_revised_at = NOW(),
    next_revision_at = calculate_next_revision(v_new_box)
  WHERE id = p_goal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and reset daily generation count
CREATE OR REPLACE FUNCTION check_daily_generation_limit(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_is_pro BOOLEAN;
  v_generations_today INTEGER;
  v_last_date DATE;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Get user profile data
  SELECT
    is_pro_member,
    study_ai_generations_today,
    study_ai_last_generation_date
  INTO v_is_pro, v_generations_today, v_last_date
  FROM profiles WHERE id = p_user_id;

  -- Reset count if new day
  IF v_last_date IS NULL OR v_last_date < v_today THEN
    v_generations_today := 0;
    UPDATE profiles
    SET study_ai_generations_today = 0,
        study_ai_last_generation_date = v_today
    WHERE id = p_user_id;
  END IF;

  -- Pro users have unlimited
  IF v_is_pro THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', -1, -- -1 means unlimited
      'is_pro', true
    );
  END IF;

  -- Free users: 1 per day
  IF v_generations_today >= 1 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'is_pro', false
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', 1 - v_generations_today,
    'is_pro', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment generation count after successful generation
CREATE OR REPLACE FUNCTION increment_generation_count(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET
    study_ai_generations_today = study_ai_generations_today + 1,
    study_ai_last_generation_date = CURRENT_DATE
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create revision notification
CREATE OR REPLACE FUNCTION create_revision_notification(p_goal_id INTEGER)
RETURNS void AS $$
DECLARE
  v_user_id UUID;
  v_goal_text TEXT;
BEGIN
  -- Get goal details
  SELECT user_id, goal_text INTO v_user_id, v_goal_text
  FROM study_ai_goals WHERE id = p_goal_id;

  -- Create notification
  INSERT INTO study_ai_notifications (user_id, goal_id, type, title, message)
  VALUES (
    v_user_id,
    p_goal_id,
    'revision_due',
    'Time to revise: ' || v_goal_text,
    'Your study goal is due for revision. Review your materials to strengthen your memory!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION calculate_next_revision TO authenticated;
GRANT EXECUTE ON FUNCTION update_goal_revision TO authenticated;
GRANT EXECUTE ON FUNCTION check_daily_generation_limit TO authenticated;
GRANT EXECUTE ON FUNCTION increment_generation_count TO authenticated;
GRANT EXECUTE ON FUNCTION create_revision_notification TO authenticated;

-- ============================================
-- 11. Create storage bucket for Study AI uploads
-- ============================================
-- Note: Run this in Supabase dashboard or via CLI:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('study-ai-uploads', 'study-ai-uploads', false);

-- Storage RLS policies (run in Supabase dashboard):
-- CREATE POLICY "Users can upload their own study materials"
-- ON storage.objects FOR INSERT
-- WITH CHECK (bucket_id = 'study-ai-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can view their own study materials"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'study-ai-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can delete their own study materials"
-- ON storage.objects FOR DELETE
-- USING (bucket_id = 'study-ai-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
