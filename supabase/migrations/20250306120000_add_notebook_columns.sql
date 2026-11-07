-- Add Open Notebook ID tracking to study goals
ALTER TABLE study_ai_goals
  ADD COLUMN IF NOT EXISTS open_notebook_id text,
  ADD COLUMN IF NOT EXISTS notebook_created_at timestamptz;

-- Notebook IDs for study planner topics (not associated with a goal)
CREATE TABLE IF NOT EXISTS topic_notebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES study_plans(id) ON DELETE CASCADE,
  subject text NOT NULL,
  week_number int,
  day_number int,
  open_notebook_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, plan_id, subject, week_number, day_number)
);

ALTER TABLE topic_notebooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own topic notebooks"
  ON topic_notebooks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
