-- Guided Learning Sessions and Messages Tables
-- Implements Google's Guided Learning (Socratic tutoring) with session persistence

-- Session tracking table
CREATE TABLE IF NOT EXISTS guided_learning_sessions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Context: Either goal_id OR planner context (subject/topics)
  goal_id INTEGER REFERENCES study_ai_goals(id) ON DELETE SET NULL,
  planner_plan_id TEXT,  -- For planner topic slots
  subject TEXT,
  topics TEXT[],
  exam_type TEXT,

  -- Session state
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  current_concept TEXT,  -- The concept currently being explored
  concepts_mastered TEXT[] DEFAULT '{}',  -- List of concepts user has understood
  concepts_struggling TEXT[] DEFAULT '{}',  -- List of concepts needing review

  -- Progress tracking
  total_exchanges INTEGER DEFAULT 0,
  checkpoints_passed INTEGER DEFAULT 0,
  checkpoints_total INTEGER DEFAULT 0,
  understanding_score INTEGER,  -- 0-100, updated after each checkpoint

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Message history table
CREATE TABLE IF NOT EXISTS guided_learning_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES guided_learning_sessions(id) ON DELETE CASCADE,

  role TEXT NOT NULL CHECK (role IN ('tutor', 'student')),
  content TEXT NOT NULL,

  -- Message metadata
  message_type TEXT DEFAULT 'message' CHECK (message_type IN (
    'message',           -- Regular conversational message
    'probing_question',  -- Socratic question to probe understanding
    'checkpoint',        -- Quiz/verification question
    'hint',              -- Hint provided after struggle
    'concept_summary',   -- Summary after mastering a concept
    'encouragement'      -- Motivational message
  )),

  -- For checkpoint messages
  checkpoint_data JSONB,  -- { question, options, correct_answer, explanation }
  student_checkpoint_response TEXT,
  checkpoint_correct BOOLEAN,

  -- Media suggestions from tutor
  media_data JSONB,  -- { videos: [{title, searchQuery, reason}], diagrams: [{title, searchQuery, type}] }

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_guided_sessions_user ON guided_learning_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_guided_sessions_goal ON guided_learning_sessions(goal_id);
CREATE INDEX IF NOT EXISTS idx_guided_sessions_active ON guided_learning_sessions(user_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_guided_sessions_planner ON guided_learning_sessions(user_id, planner_plan_id, subject) WHERE planner_plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guided_messages_session ON guided_learning_messages(session_id, created_at);

-- RLS Policies
ALTER TABLE guided_learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guided_learning_messages ENABLE ROW LEVEL SECURITY;

-- Sessions: Users can only access their own sessions
CREATE POLICY "Users can view own guided learning sessions"
  ON guided_learning_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own guided learning sessions"
  ON guided_learning_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own guided learning sessions"
  ON guided_learning_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Messages: Users can access messages for their sessions
CREATE POLICY "Users can view messages for own sessions"
  ON guided_learning_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM guided_learning_sessions
      WHERE id = guided_learning_messages.session_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages for own sessions"
  ON guided_learning_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM guided_learning_sessions
      WHERE id = guided_learning_messages.session_id
      AND user_id = auth.uid()
    )
  );

-- Add tracking columns to profiles for rate limiting
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS guided_sessions_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS guided_sessions_last_date DATE;

-- Function to update session's updated_at timestamp
CREATE OR REPLACE FUNCTION update_guided_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS guided_session_updated_at ON guided_learning_sessions;
CREATE TRIGGER guided_session_updated_at
  BEFORE UPDATE ON guided_learning_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_guided_session_timestamp();
