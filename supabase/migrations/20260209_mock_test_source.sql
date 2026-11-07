-- Add source column to distinguish human vs AI-generated tests
ALTER TABLE tests ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'human'
  CHECK (source IN ('human', 'ai_mock'));

-- Add mock test metadata (exam pattern, negative marking, sections, etc.)
ALTER TABLE tests ADD COLUMN IF NOT EXISTS mock_meta JSONB DEFAULT NULL;

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS idx_tests_source ON tests(source);
