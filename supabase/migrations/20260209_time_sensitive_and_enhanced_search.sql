-- Migration: Time-sensitive question tagging + enhanced search with year filtering
-- Date: 2026-02-09
-- Features:
--   1. Add is_time_sensitive column to pyq_questions
--   2. Auto-tag existing current affairs questions as time-sensitive
--   3. Update search_pyq_semantic() to support year_min filtering and return topics/cognitive_level
--   4. Add search_pyq_enhanced() with full metadata for external API consumers

-- ============================================
-- 1. ADD is_time_sensitive COLUMN
-- ============================================

ALTER TABLE pyq_questions ADD COLUMN IF NOT EXISTS is_time_sensitive BOOLEAN DEFAULT false;

-- ============================================
-- 2. AUTO-TAG EXISTING CURRENT AFFAIRS QUESTIONS
-- ============================================
-- Questions with subject "General Knowledge" or "Current Affairs" or topics containing
-- current-affairs-related keywords are marked as time-sensitive

UPDATE pyq_questions
SET is_time_sensitive = true
WHERE
  LOWER(subject) IN ('general knowledge', 'current affairs', 'gk', 'current affairs & gk')
  OR EXISTS (
    SELECT 1 FROM unnest(topics) AS t
    WHERE LOWER(t) LIKE '%current%'
       OR LOWER(t) LIKE '%award%'
       OR LOWER(t) LIKE '%winner%'
       OR LOWER(t) LIKE '%scheme%'
       OR LOWER(t) LIKE '%appointment%'
       OR LOWER(t) LIKE '%census%'
       OR LOWER(t) LIKE '%budget%'
       OR LOWER(t) LIKE '%summit%'
       OR LOWER(t) LIKE '%rank%'
       OR LOWER(t) LIKE '%index%'
  );

-- ============================================
-- 3. UPDATE search_pyq_semantic() — add year_min + return topics/cognitive_level
-- ============================================
-- Backwards compatible: p_year_min defaults to NULL (no filtering)
-- When p_year_min is set, time-sensitive questions older than that year are excluded

-- Drop the old 6-param version to avoid overload ambiguity
DROP FUNCTION IF EXISTS search_pyq_semantic(vector(768), TEXT, TEXT[], FLOAT, INTEGER, UUID[]);

CREATE OR REPLACE FUNCTION search_pyq_semantic(
  query_embedding vector(768),
  p_subject TEXT,
  p_exam_names TEXT[],
  p_match_threshold FLOAT DEFAULT 0.3,
  p_limit INTEGER DEFAULT 8,
  p_exclude_ids UUID[] DEFAULT '{}',
  p_year_min INTEGER DEFAULT NULL
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
  subtopic TEXT,
  topics TEXT[],
  cognitive_level TEXT,
  is_time_sensitive BOOLEAN,
  similarity FLOAT
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
    pq.subtopic,
    pq.topics,
    pq.cognitive_level,
    pq.is_time_sensitive,
    1 - (pq.embedding <=> query_embedding) AS similarity
  FROM pyq_questions pq
  WHERE
    pq.embedding IS NOT NULL
    AND LOWER(pq.subject) = LOWER(p_subject)
    AND pq.exam_name = ANY(p_exam_names)
    AND pq.is_verified = true
    AND pq.id != ALL(p_exclude_ids)
    AND 1 - (pq.embedding <=> query_embedding) > p_match_threshold
    -- Year filtering: exclude old time-sensitive questions
    AND (
      p_year_min IS NULL
      OR pq.is_time_sensitive = false
      OR pq.exam_year >= p_year_min
    )
  ORDER BY
    similarity DESC,
    pq.high_yield DESC,
    pq.exam_year DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION search_pyq_semantic(vector(768), TEXT, TEXT[], FLOAT, INTEGER, UUID[], INTEGER) TO service_role;
