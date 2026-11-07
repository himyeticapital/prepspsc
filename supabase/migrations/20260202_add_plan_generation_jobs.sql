-- Plan generation jobs table for async study plan generation
-- This allows long-running Gemini API calls without Vercel timeout issues

CREATE TABLE plan_generation_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Job status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  -- Input parameters (stored so Edge Function can use them)
  input_params JSONB NOT NULL,
  -- Format: {
  --   examType: string,
  --   customSyllabus?: string,
  --   durationWeeks: number,
  --   hoursPerDay: number,
  --   studySlots?: number,
  --   focusAreas?: string[]
  -- }

  -- Result (populated on completion)
  result_plan_id UUID REFERENCES study_plans(id) ON DELETE SET NULL,

  -- Error info (populated on failure)
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Index for user's jobs lookup
CREATE INDEX idx_plan_generation_jobs_user_id ON plan_generation_jobs(user_id);

-- Index for pending jobs (for worker to pick up)
CREATE INDEX idx_plan_generation_jobs_status ON plan_generation_jobs(status) WHERE status = 'pending';

-- RLS policies
ALTER TABLE plan_generation_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own jobs
CREATE POLICY "Users can view own plan generation jobs"
  ON plan_generation_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create jobs for themselves
CREATE POLICY "Users can create own plan generation jobs"
  ON plan_generation_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can update jobs (for Edge Function)
-- Note: Edge Functions use service role key, so they bypass RLS

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_plan_job_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plan_generation_jobs_updated_at
  BEFORE UPDATE ON plan_generation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_plan_job_updated_at();

-- Cleanup old jobs (optional - run periodically)
-- DELETE FROM plan_generation_jobs WHERE created_at < NOW() - INTERVAL '7 days';
