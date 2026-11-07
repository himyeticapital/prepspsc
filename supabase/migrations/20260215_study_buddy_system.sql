-- ============================================================
-- STUDY BUDDY SWIPE & MATCHING SYSTEM
-- ============================================================

-- Table 1: buddy_swipes - Records each swipe action
CREATE TABLE public.buddy_swipes (
  id BIGSERIAL PRIMARY KEY,
  swiper_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  swiped_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('like', 'pass')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(swiper_id, swiped_id)
);

CREATE INDEX idx_buddy_swipes_swiper ON public.buddy_swipes(swiper_id);
CREATE INDEX idx_buddy_swipes_swiped ON public.buddy_swipes(swiped_id);

-- Table 2: buddy_matches - Created when two users mutually like
CREATE TABLE public.buddy_matches (
  id BIGSERIAL PRIMARY KEY,
  user_a_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unmatched', 'blocked')),
  CHECK (user_a_id < user_b_id),
  UNIQUE(user_a_id, user_b_id)
);

CREATE INDEX idx_buddy_matches_user_a ON public.buddy_matches(user_a_id) WHERE status = 'active';
CREATE INDEX idx_buddy_matches_user_b ON public.buddy_matches(user_b_id) WHERE status = 'active';

-- Table 3: buddy_messages - 1:1 DM between matched buddies
CREATE TABLE public.buddy_messages (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES public.buddy_matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_buddy_messages_match ON public.buddy_messages(match_id, created_at DESC);
CREATE INDEX idx_buddy_messages_unread ON public.buddy_messages(match_id, is_read) WHERE is_read = FALSE;

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE public.buddy_swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buddy_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buddy_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own swipes" ON public.buddy_swipes
  FOR INSERT WITH CHECK (auth.uid() = swiper_id);
CREATE POLICY "Users can view own swipes" ON public.buddy_swipes
  FOR SELECT USING (auth.uid() = swiper_id);

CREATE POLICY "Users can view own matches" ON public.buddy_matches
  FOR SELECT USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);
CREATE POLICY "Users can update own matches" ON public.buddy_matches
  FOR UPDATE USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE POLICY "Users can view messages in own matches" ON public.buddy_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.buddy_matches
      WHERE id = buddy_messages.match_id
        AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
        AND status = 'active'
    )
  );
CREATE POLICY "Users can send messages in own matches" ON public.buddy_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.buddy_matches
      WHERE id = buddy_messages.match_id
        AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
        AND status = 'active'
    )
  );
CREATE POLICY "Users can mark messages as read" ON public.buddy_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.buddy_matches
      WHERE id = buddy_messages.match_id
        AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
    )
  );

-- ============================================================
-- TRIGGER: Auto-create match on mutual like
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_buddy_match()
RETURNS TRIGGER AS $$
DECLARE
  v_reverse_exists BOOLEAN;
  v_user_a UUID;
  v_user_b UUID;
BEGIN
  IF NEW.direction != 'like' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.buddy_swipes
    WHERE swiper_id = NEW.swiped_id
      AND swiped_id = NEW.swiper_id
      AND direction = 'like'
  ) INTO v_reverse_exists;

  IF v_reverse_exists THEN
    IF NEW.swiper_id < NEW.swiped_id THEN
      v_user_a := NEW.swiper_id;
      v_user_b := NEW.swiped_id;
    ELSE
      v_user_a := NEW.swiped_id;
      v_user_b := NEW.swiper_id;
    END IF;

    INSERT INTO public.buddy_matches (user_a_id, user_b_id)
    VALUES (v_user_a, v_user_b)
    ON CONFLICT (user_a_id, user_b_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_check_buddy_match
  AFTER INSERT ON public.buddy_swipes
  FOR EACH ROW
  EXECUTE FUNCTION public.check_buddy_match();

-- ============================================================
-- RPC: Get buddy candidates with compatibility scoring
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_buddy_candidates(
  p_user_id UUID,
  p_limit INT DEFAULT 20
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
  compatibility_score FLOAT
) AS $$
DECLARE
  v_user_exam TEXT;
  v_user_focus TEXT[];
  v_user_level INT;
BEGIN
  SELECT sp.exam_type, sp.focus_areas
  INTO v_user_exam, v_user_focus
  FROM public.study_plans sp
  WHERE sp.user_id = p_user_id
  ORDER BY sp.created_at DESC
  LIMIT 1;

  SELECT p.xp_level INTO v_user_level
  FROM public.profiles p WHERE p.id = p_user_id;

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
    sp.exam_type,
    sp.focus_areas,
    (
      CASE WHEN sp.exam_type IS NOT NULL AND sp.exam_type = v_user_exam THEN 40.0 ELSE 0.0 END
      + LEAST(
          COALESCE(array_length(
            ARRAY(SELECT unnest(sp.focus_areas) INTERSECT SELECT unnest(v_user_focus)), 1
          ), 0) * 15.0,
          30.0
        )
      + GREATEST(0, 20.0 - ABS(COALESCE(p.xp_level, 1) - COALESCE(v_user_level, 1)) * 2.0)
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
  ORDER BY compatibility_score DESC, p.xp_level DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
