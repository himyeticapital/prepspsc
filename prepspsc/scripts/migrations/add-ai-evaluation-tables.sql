-- =====================================================
-- Migration: Add AI Evaluation & Analytics Tables
-- Run this in the Supabase SQL Editor
-- =====================================================

-- 1. Add test_type to tests table
ALTER TABLE tests
ADD COLUMN IF NOT EXISTS test_type TEXT DEFAULT 'mcq'
CHECK (test_type IN ('mcq', 'conventional', 'mixed'));

-- 2. Add new columns to questions table
ALTER TABLE questions
ADD COLUMN IF NOT EXISTS word_limit INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS model_answer TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS evaluation_criteria JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS section_id INTEGER DEFAULT NULL;

-- 3. Add new columns to user_answers table
ALTER TABLE user_answers
ADD COLUMN IF NOT EXISTS answer_file_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_feedback JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS grading_status TEXT DEFAULT 'pending';

-- 4. Add attempt_number to test_attempts table
ALTER TABLE test_attempts
ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;

-- 5. Create test_sections table
CREATE TABLE IF NOT EXISTS test_sections (
  id SERIAL PRIMARY KEY,
  test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create test_analytics table
CREATE TABLE IF NOT EXISTS test_analytics (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
  total_attempts INTEGER DEFAULT 0,
  best_score NUMERIC DEFAULT 0,
  average_score NUMERIC DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  strengths JSONB DEFAULT '[]',
  weaknesses JSONB DEFAULT '[]',
  improvement_trend JSONB DEFAULT '[]',
  section_performance JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, test_id)
);

-- 7. Add foreign key for section_id in questions
ALTER TABLE questions
DROP CONSTRAINT IF EXISTS questions_section_id_fkey;

ALTER TABLE questions
ADD CONSTRAINT questions_section_id_fkey
FOREIGN KEY (section_id) REFERENCES test_sections(id) ON DELETE SET NULL;

-- 8. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_test_sections_test_id ON test_sections(test_id);
CREATE INDEX IF NOT EXISTS idx_test_analytics_user_id ON test_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_test_analytics_test_id ON test_analytics(test_id);
CREATE INDEX IF NOT EXISTS idx_user_answers_grading_status ON user_answers(grading_status);

-- 9. Enable RLS on new tables
ALTER TABLE test_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_analytics ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies for test_sections (public read, admin write)
DROP POLICY IF EXISTS "Anyone can view test sections" ON test_sections;
CREATE POLICY "Anyone can view test sections" ON test_sections
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage test sections" ON test_sections;
CREATE POLICY "Admins can manage test sections" ON test_sections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 11. RLS Policies for test_analytics (users can view/update their own)
DROP POLICY IF EXISTS "Users can view their own analytics" ON test_analytics;
CREATE POLICY "Users can view their own analytics" ON test_analytics
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own analytics" ON test_analytics;
CREATE POLICY "Users can insert their own analytics" ON test_analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own analytics" ON test_analytics;
CREATE POLICY "Users can update their own analytics" ON test_analytics
  FOR UPDATE USING (auth.uid() = user_id);

-- 12. Service role can manage all analytics (for API routes)
DROP POLICY IF EXISTS "Service role can manage all analytics" ON test_analytics;
CREATE POLICY "Service role can manage all analytics" ON test_analytics
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- 13. Create storage bucket for answer uploads (run separately in Storage settings)
-- Go to Storage > Create new bucket > Name: "answer-uploads" > Public: Yes

-- =====================================================
-- Verify the migration
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created/modified:';
  RAISE NOTICE '  - tests: added test_type column';
  RAISE NOTICE '  - questions: added word_limit, model_answer, evaluation_criteria, section_id';
  RAISE NOTICE '  - user_answers: added answer_file_url, ai_feedback, grading_status';
  RAISE NOTICE '  - test_attempts: added attempt_number';
  RAISE NOTICE '  - test_sections: NEW table';
  RAISE NOTICE '  - test_analytics: NEW table';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Create "answer-uploads" storage bucket (Storage > New bucket)';
  RAISE NOTICE '  2. Set bucket to public';
  RAISE NOTICE '  3. Add GOOGLE_GEMINI_API_KEY to your .env.local';
  RAISE NOTICE '  4. Run seed-mixed-test.sql to create a demo test';
  RAISE NOTICE '========================================';
END $$;
