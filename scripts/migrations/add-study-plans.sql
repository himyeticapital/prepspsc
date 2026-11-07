-- Study Plans Migration
-- Adds support for AI-generated personalized study plans

-- ============================================
-- 1. Create study_plans table
-- ============================================
CREATE TABLE IF NOT EXISTS study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  exam_type TEXT NOT NULL,
  duration_weeks INTEGER NOT NULL CHECK (duration_weeks > 0),
  hours_per_day INTEGER NOT NULL CHECK (hours_per_day > 0),
  focus_areas TEXT[] DEFAULT '{}',
  schedule JSONB NOT NULL,
  resources JSONB DEFAULT '[]',
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for study_plans
CREATE INDEX IF NOT EXISTS idx_study_plans_user_id ON study_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_exam_type ON study_plans(exam_type);
CREATE INDEX IF NOT EXISTS idx_study_plans_created_at ON study_plans(created_at DESC);

-- ============================================
-- 2. Enable RLS on study_plans
-- ============================================
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;

-- Users can only view their own plans
CREATE POLICY "Users can view own study plans"
  ON study_plans FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own plans
CREATE POLICY "Users can insert own study plans"
  ON study_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own plans
CREATE POLICY "Users can update own study plans"
  ON study_plans FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own plans
CREATE POLICY "Users can delete own study plans"
  ON study_plans FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 3. Create function to auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_study_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_study_plans_updated_at ON study_plans;
CREATE TRIGGER trigger_study_plans_updated_at
  BEFORE UPDATE ON study_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_study_plans_updated_at();

-- ============================================
-- 4. Grant permissions
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON study_plans TO authenticated;
