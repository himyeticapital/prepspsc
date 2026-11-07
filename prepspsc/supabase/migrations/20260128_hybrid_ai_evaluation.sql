-- =============================================================================
-- Hybrid AI Evaluation System - Database Migration
--
-- This migration adds:
-- 1. ai_explanation column to questions table for pregenerated MCQ explanations
-- 2. ai_evaluation_tasks table for background processing of conventional questions
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PART 1: Add ai_explanation column to questions table
-- -----------------------------------------------------------------------------

-- Add the column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'ai_explanation'
  ) THEN
    ALTER TABLE questions ADD COLUMN ai_explanation JSONB;

    COMMENT ON COLUMN questions.ai_explanation IS
      'Pregenerated AI explanation for MCQ questions. Structure: {explanation: string, incorrectOptionsExplanation: {optionId: explanation}, generatedAt: ISO timestamp}';
  END IF;
END $$;

-- Create index for finding questions needing migration (MCQs without explanations)
CREATE INDEX IF NOT EXISTS idx_questions_no_ai_explanation
  ON questions(id)
  WHERE type = 'mcq' AND ai_explanation IS NULL;

-- -----------------------------------------------------------------------------
-- PART 2: Create ai_evaluation_tasks table for conventional question queue
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_evaluation_tasks (
  id SERIAL PRIMARY KEY,
  attempt_id INTEGER NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_id INTEGER NOT NULL REFERENCES user_answers(id) ON DELETE CASCADE,
  task_type VARCHAR(20) NOT NULL DEFAULT 'conventional',
  status VARCHAR(20) DEFAULT 'pending',
  priority INTEGER DEFAULT 5,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  -- Ensure each answer only has one task
  CONSTRAINT unique_answer_task UNIQUE(answer_id)
);

-- Add check constraints
ALTER TABLE ai_evaluation_tasks
  ADD CONSTRAINT check_task_type
  CHECK (task_type IN ('conventional', 'mcq_migration'));

ALTER TABLE ai_evaluation_tasks
  ADD CONSTRAINT check_status
  CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

-- Create index for queue processing (pending tasks, ordered by priority and creation time)
CREATE INDEX IF NOT EXISTS idx_ai_tasks_pending
  ON ai_evaluation_tasks(status, priority, created_at)
  WHERE status = 'pending';

-- Create index for checking tasks by attempt
CREATE INDEX IF NOT EXISTS idx_ai_tasks_attempt
  ON ai_evaluation_tasks(attempt_id);

-- -----------------------------------------------------------------------------
-- PART 3: Enable Row Level Security
-- -----------------------------------------------------------------------------

ALTER TABLE ai_evaluation_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own tasks
CREATE POLICY "Users can view their own tasks"
  ON ai_evaluation_tasks
  FOR SELECT
  USING (
    attempt_id IN (SELECT id FROM test_attempts WHERE user_id = auth.uid())
  );

-- Policy: Service role can do everything (for cron jobs)
CREATE POLICY "Service role full access"
  ON ai_evaluation_tasks
  FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
  );

-- -----------------------------------------------------------------------------
-- PART 4: Add grading_status to user_answers if not exists
-- -----------------------------------------------------------------------------

-- Ensure grading_status column exists (it should already from previous migrations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_answers' AND column_name = 'grading_status'
  ) THEN
    ALTER TABLE user_answers ADD COLUMN grading_status VARCHAR(20) DEFAULT 'pending';
  END IF;
END $$;

-- Add 'queued' as a valid status if check constraint exists
-- First drop existing constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'check_grading_status'
    AND table_name = 'user_answers'
  ) THEN
    ALTER TABLE user_answers DROP CONSTRAINT check_grading_status;
  END IF;
END $$;

-- Add updated constraint with 'queued' status
ALTER TABLE user_answers
  ADD CONSTRAINT check_grading_status
  CHECK (grading_status IN ('pending', 'pending_review', 'queued', 'completed', 'failed'));

-- -----------------------------------------------------------------------------
-- PART 5: Create function to update updated_at timestamp
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_ai_evaluation_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_ai_evaluation_tasks_timestamp ON ai_evaluation_tasks;
CREATE TRIGGER update_ai_evaluation_tasks_timestamp
  BEFORE UPDATE ON ai_evaluation_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_evaluation_tasks_updated_at();

-- =============================================================================
-- VERIFICATION QUERIES (run these to verify migration success)
-- =============================================================================

-- Verify ai_explanation column exists:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'questions' AND column_name = 'ai_explanation';

-- Verify ai_evaluation_tasks table exists:
-- SELECT * FROM information_schema.tables WHERE table_name = 'ai_evaluation_tasks';

-- Check how many MCQs need migration:
-- SELECT COUNT(*) as total_mcq,
--        COUNT(ai_explanation) as with_explanation,
--        COUNT(*) - COUNT(ai_explanation) as needs_migration
-- FROM questions WHERE type = 'mcq';
