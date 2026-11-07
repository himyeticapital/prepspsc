-- Migration: PYQ Vector Search with pgvector
-- Date: 2026-02-08
-- Feature: Semantic similarity search for PYQ questions using embeddings

-- ============================================
-- ENABLE PGVECTOR EXTENSION
-- ============================================

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ============================================
-- ADD EMBEDDING COLUMN
-- ============================================

ALTER TABLE pyq_questions ADD COLUMN IF NOT EXISTS embedding vector(768);

-- ============================================
-- HNSW INDEX FOR FAST COSINE SIMILARITY
-- ============================================

CREATE INDEX IF NOT EXISTS idx_pyq_embedding_hnsw
  ON pyq_questions
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================
-- SEMANTIC SEARCH FUNCTION
-- ============================================
-- Used by Edge Function to find semantically similar PYQ questions
-- Returns questions ranked by cosine similarity to query embedding

CREATE OR REPLACE FUNCTION search_pyq_semantic(
  query_embedding vector(768),
  p_subject TEXT,
  p_exam_names TEXT[],
  p_match_threshold FLOAT DEFAULT 0.3,
  p_limit INTEGER DEFAULT 8,
  p_exclude_ids UUID[] DEFAULT '{}'
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
    1 - (pq.embedding <=> query_embedding) AS similarity
  FROM pyq_questions pq
  WHERE
    -- Must have embedding
    pq.embedding IS NOT NULL
    -- Match subject (case-insensitive)
    AND LOWER(pq.subject) = LOWER(p_subject)
    -- Filter by allowed exam names
    AND pq.exam_name = ANY(p_exam_names)
    -- Only verified questions
    AND pq.is_verified = true
    -- Exclude already-seen questions
    AND pq.id != ALL(p_exclude_ids)
    -- Minimum similarity threshold
    AND 1 - (pq.embedding <=> query_embedding) > p_match_threshold
  ORDER BY
    similarity DESC,
    pq.high_yield DESC,
    pq.exam_year DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION search_pyq_semantic TO service_role;
