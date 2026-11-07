-- Add exam scheme configuration to admin_exams
-- Supports MCQ, conventional, or mixed exam formats

-- Add exam_scheme column to admin_exams
ALTER TABLE admin_exams
ADD COLUMN IF NOT EXISTS exam_scheme JSONB DEFAULT NULL;

-- The exam_scheme structure:
-- {
--   "papers": [
--     {
--       "name": "Paper I - General Studies",
--       "totalQuestions": 100,
--       "totalMarks": 200,
--       "duration": "2 hours",
--       "questionTypes": {
--         "mcq": { "count": 100, "marksEach": 2 },
--         "conventional": { "count": 0, "marksEach": 0 }
--       },
--       "negativeMarking": true,
--       "negativeMarkingRatio": 0.33
--     },
--     {
--       "name": "Paper II - Mains",
--       "totalQuestions": 10,
--       "totalMarks": 250,
--       "duration": "3 hours",
--       "questionTypes": {
--         "mcq": { "count": 0, "marksEach": 0 },
--         "conventional": { "count": 10, "marksEach": 25 }
--       },
--       "negativeMarking": false
--     }
--   ],
--   "totalPapers": 2,
--   "examFormat": "mixed" -- "mcq_only" | "conventional_only" | "mixed"
-- }

-- Add a flag to indicate if microthemes were generated from PYQs or estimated from syllabus
ALTER TABLE admin_exams
ADD COLUMN IF NOT EXISTS microthemes_source TEXT DEFAULT 'unknown'
CHECK (microthemes_source IN ('pyq_analysis', 'syllabus_estimation', 'manual', 'unknown'));

COMMENT ON COLUMN admin_exams.exam_scheme IS 'Exam format configuration: papers, question types (MCQ/conventional), marks, duration';
COMMENT ON COLUMN admin_exams.microthemes_source IS 'How microthemes were generated: from PYQ analysis, syllabus estimation, or manually';
