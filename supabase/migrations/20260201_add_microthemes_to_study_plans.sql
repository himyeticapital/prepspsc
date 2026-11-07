-- Add microthemes column to study_plans table
-- This stores the microthemes used when generating the plan

ALTER TABLE study_plans
ADD COLUMN IF NOT EXISTS microthemes JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN study_plans.microthemes IS 'Microthemes from admin_exams used to generate this plan';
