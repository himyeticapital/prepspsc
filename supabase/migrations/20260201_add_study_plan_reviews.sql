-- Migration: Add study_plan_topic_reviews table for spaced repetition
-- This tracks review schedules for completed study planner topics using the Leitner box system

CREATE TABLE IF NOT EXISTS study_plan_topic_reviews (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES study_plans(id) ON DELETE CASCADE NOT NULL,
  week_number INTEGER NOT NULL,
  day_number INTEGER NOT NULL,
  subject TEXT NOT NULL,
  topics TEXT[] NOT NULL,
  -- Leitner SRS fields (same as study_ai_goals)
  leitner_box INTEGER DEFAULT 1 CHECK (leitner_box >= 1 AND leitner_box <= 5),
  next_review_at TIMESTAMP WITH TIME ZONE,
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  review_count INTEGER DEFAULT 0,
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint: one review entry per topic per plan
  UNIQUE(plan_id, week_number, day_number)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_topic_reviews_user_id ON study_plan_topic_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_reviews_next_review ON study_plan_topic_reviews(next_review_at);
CREATE INDEX IF NOT EXISTS idx_topic_reviews_active_due ON study_plan_topic_reviews(user_id, is_active, next_review_at);
CREATE INDEX IF NOT EXISTS idx_topic_reviews_plan ON study_plan_topic_reviews(plan_id);

-- Enable RLS
ALTER TABLE study_plan_topic_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own review entries
CREATE POLICY "Users can view own topic reviews"
  ON study_plan_topic_reviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own topic reviews"
  ON study_plan_topic_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own topic reviews"
  ON study_plan_topic_reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own topic reviews"
  ON study_plan_topic_reviews FOR DELETE
  USING (auth.uid() = user_id);
