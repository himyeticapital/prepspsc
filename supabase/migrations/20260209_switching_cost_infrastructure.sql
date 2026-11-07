-- Migration: Switching Cost Infrastructure
-- Date: 2026-02-09
-- Features:
--   1. api_user_progress — track per-question answer history per API consumer
--   2. api_user_bookmarks — let API consumers bookmark questions
--   3. api_leaderboard — aggregate stats + leaderboard views
--   4. api_developer_signups — self-service developer registration for key portal
--   5. Performance analytics functions

-- ============================================
-- 1. API USER PROGRESS (per-question answer tracking)
-- ============================================
-- API consumers send answer data back; their users' progress is tied to our question IDs.
-- This is the #1 switching cost: once an app tracks thousands of answers here, migrating away
-- means losing all that learning data.

CREATE TABLE IF NOT EXISTS api_user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES external_api_keys(id) ON DELETE CASCADE,
  external_user_id TEXT NOT NULL,              -- App's own user identifier (opaque to us)
  question_id UUID NOT NULL REFERENCES pyq_questions(id) ON DELETE CASCADE,
  selected_option TEXT NOT NULL,               -- a, b, c, d
  is_correct BOOLEAN NOT NULL,
  time_spent_seconds INTEGER,                  -- How long user took (optional)
  attempt_number INTEGER NOT NULL DEFAULT 1,   -- Track repeat attempts
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Composite indexes for common queries
CREATE INDEX idx_api_progress_key_user ON api_user_progress(api_key_id, external_user_id);
CREATE INDEX idx_api_progress_question ON api_user_progress(question_id);
CREATE INDEX idx_api_progress_created ON api_user_progress(created_at);
-- Unique constraint: one answer per user per question per attempt
CREATE UNIQUE INDEX idx_api_progress_unique_attempt
  ON api_user_progress(api_key_id, external_user_id, question_id, attempt_number);

ALTER TABLE api_user_progress ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE api_user_progress IS 'Tracks answer history for external API consumers - the primary switching cost';
COMMENT ON COLUMN api_user_progress.external_user_id IS 'The consuming app user ID (opaque string, not a Supabase user)';

-- ============================================
-- 2. API USER BOOKMARKS
-- ============================================
-- Let API consumers bookmark/save questions for their users. Another data tie-in.

CREATE TABLE IF NOT EXISTS api_user_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES external_api_keys(id) ON DELETE CASCADE,
  external_user_id TEXT NOT NULL,
  question_id UUID NOT NULL REFERENCES pyq_questions(id) ON DELETE CASCADE,
  note TEXT,                                    -- Optional user note
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(api_key_id, external_user_id, question_id)
);

CREATE INDEX idx_api_bookmarks_key_user ON api_user_bookmarks(api_key_id, external_user_id);

ALTER TABLE api_user_bookmarks ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE api_user_bookmarks IS 'Bookmarked/saved questions for external API consumers';

-- ============================================
-- 3. API DEVELOPER SIGNUPS (Self-service portal)
-- ============================================
-- Developers sign up through the portal, get a free API key instantly.
-- Links to external_api_keys once approved/created.

CREATE TABLE IF NOT EXISTS api_developer_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  app_name TEXT NOT NULL,                       -- Name of the app they're building
  app_description TEXT,                         -- What they plan to build
  website_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  api_key_id UUID REFERENCES external_api_keys(id),  -- NULL until key is created
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT
);

CREATE INDEX idx_dev_signups_status ON api_developer_signups(status);
CREATE INDEX idx_dev_signups_email ON api_developer_signups(email);

ALTER TABLE api_developer_signups ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE api_developer_signups IS 'Self-service developer registration for the PYQ API portal';

-- ============================================
-- 4. ANALYTICS FUNCTIONS
-- ============================================

-- 4a. Get performance analytics for an API consumer's user
CREATE OR REPLACE FUNCTION get_api_user_analytics(
  p_api_key_id UUID,
  p_external_user_id TEXT
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_questions_attempted', COUNT(*),
    'correct_answers', COUNT(*) FILTER (WHERE is_correct = true),
    'incorrect_answers', COUNT(*) FILTER (WHERE is_correct = false),
    'accuracy_percent', ROUND(
      COUNT(*) FILTER (WHERE is_correct = true)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1
    ),
    'avg_time_seconds', ROUND(AVG(time_spent_seconds)::NUMERIC, 1),
    'subjects', (
      SELECT json_agg(json_build_object(
        'subject', sub.subject,
        'attempted', sub.attempted,
        'correct', sub.correct,
        'accuracy_percent', ROUND(sub.correct::NUMERIC / NULLIF(sub.attempted, 0) * 100, 1)
      ))
      FROM (
        SELECT
          pq.subject,
          COUNT(*) as attempted,
          COUNT(*) FILTER (WHERE p.is_correct = true) as correct
        FROM api_user_progress p
        JOIN pyq_questions pq ON pq.id = p.question_id
        WHERE p.api_key_id = p_api_key_id
          AND p.external_user_id = p_external_user_id
        GROUP BY pq.subject
        ORDER BY COUNT(*) DESC
      ) sub
    ),
    'difficulty_breakdown', (
      SELECT json_agg(json_build_object(
        'difficulty', diff.difficulty,
        'attempted', diff.attempted,
        'correct', diff.correct,
        'accuracy_percent', ROUND(diff.correct::NUMERIC / NULLIF(diff.attempted, 0) * 100, 1)
      ))
      FROM (
        SELECT
          pq.difficulty,
          COUNT(*) as attempted,
          COUNT(*) FILTER (WHERE p.is_correct = true) as correct
        FROM api_user_progress p
        JOIN pyq_questions pq ON pq.id = p.question_id
        WHERE p.api_key_id = p_api_key_id
          AND p.external_user_id = p_external_user_id
        GROUP BY pq.difficulty
      ) diff
    ),
    'recent_activity', (
      SELECT json_agg(json_build_object(
        'date', activity.day,
        'questions_attempted', activity.attempted,
        'correct', activity.correct
      ))
      FROM (
        SELECT
          DATE(p.created_at) as day,
          COUNT(*) as attempted,
          COUNT(*) FILTER (WHERE p.is_correct = true) as correct
        FROM api_user_progress p
        WHERE p.api_key_id = p_api_key_id
          AND p.external_user_id = p_external_user_id
          AND p.created_at >= now() - interval '30 days'
        GROUP BY DATE(p.created_at)
        ORDER BY day DESC
      ) activity
    )
  ) INTO result
  FROM api_user_progress p
  WHERE p.api_key_id = p_api_key_id
    AND p.external_user_id = p_external_user_id;

  RETURN COALESCE(result, '{}'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION get_api_user_analytics(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_api_user_analytics(UUID, TEXT) TO service_role;

-- 4b. Get leaderboard for an API key's user base
CREATE OR REPLACE FUNCTION get_api_leaderboard(
  p_api_key_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_time_range TEXT DEFAULT 'all_time'  -- 'week', 'month', 'all_time'
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  time_filter TIMESTAMPTZ;
BEGIN
  -- Determine time filter
  time_filter := CASE p_time_range
    WHEN 'week' THEN now() - interval '7 days'
    WHEN 'month' THEN now() - interval '30 days'
    ELSE '1970-01-01'::TIMESTAMPTZ
  END;

  SELECT json_build_object(
    'time_range', p_time_range,
    'total_participants', (
      SELECT COUNT(DISTINCT external_user_id)
      FROM api_user_progress
      WHERE api_key_id = p_api_key_id
        AND created_at >= time_filter
    ),
    'leaderboard', (
      SELECT json_agg(json_build_object(
        'rank', lb.rank,
        'external_user_id', lb.external_user_id,
        'total_attempted', lb.attempted,
        'total_correct', lb.correct,
        'accuracy_percent', ROUND(lb.correct::NUMERIC / NULLIF(lb.attempted, 0) * 100, 1),
        'score', lb.score
      ))
      FROM (
        SELECT
          ROW_NUMBER() OVER (ORDER BY
            COUNT(*) FILTER (WHERE is_correct = true) DESC,
            ROUND(COUNT(*) FILTER (WHERE is_correct = true)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) DESC
          ) as rank,
          external_user_id,
          COUNT(*) as attempted,
          COUNT(*) FILTER (WHERE is_correct = true) as correct,
          -- Score: correct answers * accuracy bonus
          ROUND(
            COUNT(*) FILTER (WHERE is_correct = true) *
            (1 + COUNT(*) FILTER (WHERE is_correct = true)::NUMERIC / NULLIF(COUNT(*), 0))
          , 0) as score
        FROM api_user_progress
        WHERE api_key_id = p_api_key_id
          AND created_at >= time_filter
        GROUP BY external_user_id
        HAVING COUNT(*) >= 5  -- Minimum 5 questions to appear on leaderboard
        ORDER BY correct DESC, ROUND(COUNT(*) FILTER (WHERE is_correct = true)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) DESC
        LIMIT p_limit
      ) lb
    )
  ) INTO result;

  RETURN COALESCE(result, '{}'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION get_api_leaderboard(UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_api_leaderboard(UUID, INTEGER, TEXT) TO service_role;

-- ============================================
-- 5. AUTO-CREATE API KEY FUNCTION (for self-service portal)
-- ============================================
-- Called by the edge function when a developer signs up. Creates key + links to signup.

CREATE OR REPLACE FUNCTION create_api_key_for_developer(
  p_signup_id UUID,
  p_key_hash TEXT,
  p_key_prefix TEXT
)
RETURNS UUID AS $$
DECLARE
  new_key_id UUID;
  signup_record RECORD;
BEGIN
  -- Get the signup record
  SELECT * INTO signup_record FROM api_developer_signups WHERE id = p_signup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Signup not found: %', p_signup_id;
  END IF;

  -- Create the API key (free tier)
  INSERT INTO external_api_keys (
    key_hash, key_prefix, name, owner_email,
    tier, rate_limit_rpm, monthly_quota, status
  ) VALUES (
    p_key_hash, p_key_prefix, signup_record.app_name, signup_record.email,
    'free', 10, 1000, 'active'
  )
  RETURNING id INTO new_key_id;

  -- Update the signup record
  UPDATE api_developer_signups
  SET status = 'approved',
      api_key_id = new_key_id,
      approved_at = now()
  WHERE id = p_signup_id;

  RETURN new_key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION create_api_key_for_developer(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_api_key_for_developer(UUID, TEXT, TEXT) TO service_role;
