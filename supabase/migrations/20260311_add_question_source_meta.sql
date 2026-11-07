ALTER TABLE questions
ADD COLUMN IF NOT EXISTS question_source TEXT
  CHECK (question_source IN ('human_curated', 'pyq_reused', 'ai_generated_from_pyq'));

ALTER TABLE questions
ADD COLUMN IF NOT EXISTS question_meta JSONB DEFAULT '{}'::jsonb;

UPDATE questions q
SET
  question_source = CASE
    WHEN t.source = 'ai_mock' THEN 'pyq_reused'
    ELSE 'human_curated'
  END,
  question_meta = COALESCE(q.question_meta, '{}'::jsonb)
FROM tests t
WHERE q.test_id = t.id
  AND q.question_source IS NULL;

ALTER TABLE questions
ALTER COLUMN question_source SET DEFAULT 'human_curated';

ALTER TABLE questions
ALTER COLUMN question_source SET NOT NULL;

ALTER TABLE questions
ALTER COLUMN question_meta SET DEFAULT '{}'::jsonb;

ALTER TABLE questions
ALTER COLUMN question_meta SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_question_source ON questions(question_source);
