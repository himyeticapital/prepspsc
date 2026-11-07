-- Migration: Real PYQ Database
-- Date: 2026-02-04
-- Feature: Store actual past exam questions for 70% real PYQ coverage

-- ============================================
-- REAL PYQ QUESTIONS TABLE
-- ============================================
-- Stores verified questions from UPSC, SPSC, CDS, SSC exams
-- Users see "REAL" badge for these questions

CREATE TABLE IF NOT EXISTS pyq_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Question content
  question TEXT NOT NULL,
  options JSONB NOT NULL,  -- [{id: "a", text: "..."}, {id: "b", text: "..."}, ...]
  correct_option_id TEXT NOT NULL,
  explanation TEXT,

  -- Categorization (for topic-based search)
  subject TEXT NOT NULL,           -- "Indian Polity", "Geography", "Economics", "History"
  topics TEXT[] NOT NULL,          -- ["Fundamental Rights", "Article 21", "Right to Life"]
  subtopic TEXT,                   -- "Right to Life and Personal Liberty"
  tags TEXT[] DEFAULT '{}',        -- ["constitution", "supreme-court", "landmark-case"]

  -- Source & Authenticity (empowers users)
  exam_name TEXT NOT NULL,         -- "UPSC CSE", "SPSC", "CDS", "SSC CGL", "UPSC CAPF"
  exam_year INTEGER NOT NULL,      -- 2023, 2022, 2021, etc.
  exam_stage TEXT,                 -- "Prelims", "Mains", "Paper 1", "Paper 2"
  question_number INTEGER,         -- Original question number in paper (for reference)
  is_verified BOOLEAN DEFAULT false, -- Admin-verified for accuracy
  source_url TEXT,                 -- Link to official paper PDF if available

  -- Question Metadata
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  high_yield BOOLEAN DEFAULT false, -- Frequently asked topic
  question_type TEXT DEFAULT 'factual' CHECK (question_type IN ('factual', 'statement', 'assertion-reason', 'match', 'sequence')),
  cognitive_level TEXT DEFAULT 'remember' CHECK (cognitive_level IN ('remember', 'understand', 'apply', 'analyze')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES FOR FAST SEARCH
-- ============================================

-- Subject-based filtering
CREATE INDEX IF NOT EXISTS idx_pyq_subject ON pyq_questions(subject);

-- Topic-based search (GIN for array containment)
CREATE INDEX IF NOT EXISTS idx_pyq_topics ON pyq_questions USING GIN(topics);

-- Tag-based search
CREATE INDEX IF NOT EXISTS idx_pyq_tags ON pyq_questions USING GIN(tags);

-- Exam filtering (ordered by year for recent-first)
CREATE INDEX IF NOT EXISTS idx_pyq_exam ON pyq_questions(exam_name, exam_year DESC);

-- Full-text search on question content
CREATE INDEX IF NOT EXISTS idx_pyq_search ON pyq_questions USING GIN(to_tsvector('english', question));

-- High-yield questions first
CREATE INDEX IF NOT EXISTS idx_pyq_high_yield ON pyq_questions(high_yield DESC, exam_year DESC);

-- Verified questions only
CREATE INDEX IF NOT EXISTS idx_pyq_verified ON pyq_questions(is_verified) WHERE is_verified = true;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE pyq_questions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read PYQs
CREATE POLICY "Authenticated users can read PYQs"
  ON pyq_questions FOR SELECT
  USING (auth.role() = 'authenticated');

-- Service role has full access (for ingestion scripts)
CREATE POLICY "Service role full access on PYQs"
  ON pyq_questions FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- HELPER FUNCTION: Update timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_pyq_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pyq_questions_updated_at
  BEFORE UPDATE ON pyq_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_pyq_updated_at();

-- ============================================
-- HELPER FUNCTION: Search PYQs by topic
-- ============================================
-- Used by Edge Function to find relevant real questions

CREATE OR REPLACE FUNCTION search_pyq_by_topic(
  p_subject TEXT,
  p_topics TEXT[],
  p_exam_names TEXT[],
  p_limit INTEGER DEFAULT 6
)
RETURNS TABLE (
  id UUID,
  question TEXT,
  options JSONB,
  correct_option_id TEXT,
  explanation TEXT,
  exam_name TEXT,
  exam_year INTEGER,
  exam_stage TEXT,
  high_yield BOOLEAN,
  difficulty TEXT,
  question_type TEXT,
  subtopic TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pq.id,
    pq.question,
    pq.options,
    pq.correct_option_id,
    pq.explanation,
    pq.exam_name,
    pq.exam_year,
    pq.exam_stage,
    pq.high_yield,
    pq.difficulty,
    pq.question_type,
    pq.subtopic
  FROM pyq_questions pq
  WHERE
    -- Match subject (case-insensitive)
    LOWER(pq.subject) = LOWER(p_subject)
    -- Match any topic in the array
    AND pq.topics && p_topics
    -- Filter by allowed exam names
    AND pq.exam_name = ANY(p_exam_names)
    -- Only verified questions
    AND pq.is_verified = true
  ORDER BY
    pq.high_yield DESC,  -- High-yield first
    pq.exam_year DESC,   -- Recent exams first
    RANDOM()             -- Randomize within same priority
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT SELECT ON pyq_questions TO authenticated;
GRANT ALL ON pyq_questions TO service_role;
GRANT EXECUTE ON FUNCTION search_pyq_by_topic TO service_role;

-- ============================================
-- SAMPLE DATA (for testing)
-- ============================================
-- Uncomment to add test questions

/*
INSERT INTO pyq_questions (question, options, correct_option_id, explanation, subject, topics, exam_name, exam_year, exam_stage, high_yield, is_verified)
VALUES
(
  'Which of the following is NOT a Fundamental Right under the Indian Constitution?',
  '[{"id": "a", "text": "Right to Equality"}, {"id": "b", "text": "Right to Property"}, {"id": "c", "text": "Right to Freedom"}, {"id": "d", "text": "Right against Exploitation"}]'::jsonb,
  'b',
  'Right to Property was a Fundamental Right under Article 31 but was removed by the 44th Constitutional Amendment Act, 1978. It is now a legal right under Article 300A.',
  'Indian Polity',
  ARRAY['Fundamental Rights', 'Constitutional Amendments'],
  'UPSC CSE',
  2023,
  'Prelims',
  true,
  true
),
(
  'Consider the following statements about Article 21: 1. It guarantees protection of life and personal liberty. 2. It can be suspended during National Emergency. Which of the statements given above is/are correct?',
  '[{"id": "a", "text": "1 only"}, {"id": "b", "text": "2 only"}, {"id": "c", "text": "Both 1 and 2"}, {"id": "d", "text": "Neither 1 nor 2"}]'::jsonb,
  'a',
  'Article 21 guarantees protection of life and personal liberty. After the 44th Amendment, Article 21 cannot be suspended even during a National Emergency.',
  'Indian Polity',
  ARRAY['Fundamental Rights', 'Article 21', 'Right to Life'],
  'UPSC CSE',
  2022,
  'Prelims',
  true,
  true
);
*/
