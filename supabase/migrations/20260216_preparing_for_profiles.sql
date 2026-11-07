-- =============================================================
-- Add preparing_for to profiles for exam-based buddy matching
-- =============================================================

-- 1. Add column + GIN index
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preparing_for TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_profiles_preparing_for
  ON public.profiles USING GIN (preparing_for);

-- 2. Backfill from existing study_plans
UPDATE public.profiles p
SET preparing_for = sub.exams
FROM (
  SELECT sp.user_id, ARRAY_AGG(DISTINCT sp.exam_type) AS exams
  FROM public.study_plans sp
  WHERE sp.exam_type IS NOT NULL AND sp.exam_type != ''
  GROUP BY sp.user_id
) sub
WHERE p.id = sub.user_id
  AND p.preparing_for = '{}';

-- 3. Auto-sync trigger: when a study plan is created, add its exam_type to profiles.preparing_for
CREATE OR REPLACE FUNCTION public.sync_preparing_for_from_study_plan()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.exam_type IS NOT NULL AND NEW.exam_type != '' THEN
    UPDATE public.profiles
    SET preparing_for = array_append(preparing_for, NEW.exam_type)
    WHERE id = NEW.user_id
      AND NOT (NEW.exam_type = ANY(preparing_for));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_preparing_for ON public.study_plans;
CREATE TRIGGER trigger_sync_preparing_for
  AFTER INSERT ON public.study_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_preparing_for_from_study_plan();

-- 4. Replace get_buddy_candidates RPC with preparing_for support + exam filter
CREATE OR REPLACE FUNCTION public.get_buddy_candidates(
  p_user_id UUID,
  p_limit INT DEFAULT 20,
  p_exam_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  xp_points INT,
  xp_level INT,
  current_streak INT,
  total_minutes_all_time INT,
  profile_frame TEXT,
  exam_type TEXT,
  focus_areas TEXT[],
  preparing_for TEXT[],
  compatibility_score FLOAT
) AS $$
DECLARE
  v_user_exams TEXT[];
  v_user_focus TEXT[];
  v_user_level INT;
BEGIN
  -- Get current user's exam preferences from profiles
  SELECT p.preparing_for, p.xp_level
  INTO v_user_exams, v_user_level
  FROM public.profiles p WHERE p.id = p_user_id;

  -- Still get focus_areas from latest study plan
  SELECT sp.focus_areas
  INTO v_user_focus
  FROM public.study_plans sp
  WHERE sp.user_id = p_user_id
  ORDER BY sp.created_at DESC
  LIMIT 1;

  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.full_name,
    p.avatar_url,
    p.bio,
    p.xp_points,
    p.xp_level,
    p.current_streak,
    p.total_minutes_all_time,
    p.profile_frame,
    -- backward compat: first exam from preparing_for, fallback to study plan
    COALESCE(
      CASE WHEN array_length(p.preparing_for, 1) > 0 THEN p.preparing_for[1] ELSE NULL END,
      sp.exam_type
    )::TEXT AS exam_type,
    sp.focus_areas,
    p.preparing_for,
    (
      -- Exam match: up to 40pts based on overlap of preparing_for arrays
      CASE WHEN v_user_exams IS NOT NULL
           AND array_length(v_user_exams, 1) > 0
           AND p.preparing_for && v_user_exams
        THEN LEAST(
          COALESCE(array_length(
            ARRAY(SELECT unnest(p.preparing_for) INTERSECT SELECT unnest(v_user_exams)), 1
          ), 0) * 20.0,
          40.0
        )
        ELSE 0.0
      END
      -- Focus area match: up to 30pts (still from study_plans)
      + LEAST(
          COALESCE(array_length(
            ARRAY(SELECT unnest(sp.focus_areas) INTERSECT SELECT unnest(v_user_focus)), 1
          ), 0) * 15.0,
          30.0
        )
      -- XP level proximity: up to 20pts
      + GREATEST(0, 20.0 - ABS(COALESCE(p.xp_level, 1) - COALESCE(v_user_level, 1)) * 2.0)
      -- Streak bonus: up to 10pts
      + LEAST(COALESCE(p.current_streak, 0) * 1.0, 10.0)
    )::FLOAT AS compatibility_score
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT sp2.exam_type, sp2.focus_areas
    FROM public.study_plans sp2
    WHERE sp2.user_id = p.id
    ORDER BY sp2.created_at DESC
    LIMIT 1
  ) sp ON TRUE
  WHERE p.id != p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.buddy_swipes bs
      WHERE bs.swiper_id = p_user_id AND bs.swiped_id = p.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.buddy_matches bm
      WHERE (bm.user_a_id = p_user_id AND bm.user_b_id = p.id)
         OR (bm.user_a_id = p.id AND bm.user_b_id = p_user_id)
    )
    AND p.username IS NOT NULL
    -- Optional exam filter
    AND (p_exam_filter IS NULL OR p_exam_filter = ANY(p.preparing_for))
  ORDER BY compatibility_score DESC, p.xp_level DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
