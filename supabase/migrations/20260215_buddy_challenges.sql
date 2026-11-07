-- Buddy Challenges: allows matched buddies to challenge each other to take the same test
CREATE TABLE public.buddy_challenges (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES public.buddy_matches(id) ON DELETE CASCADE,
  challenger_id UUID NOT NULL REFERENCES public.profiles(id),
  challenged_id UUID NOT NULL REFERENCES public.profiles(id),
  test_id BIGINT NOT NULL REFERENCES public.tests(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'declined', 'expired')),
  challenger_attempt_id BIGINT REFERENCES public.test_attempts(id),
  challenged_attempt_id BIGINT REFERENCES public.test_attempts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for looking up challenges by match
CREATE INDEX idx_buddy_challenges_match ON public.buddy_challenges(match_id);
CREATE INDEX idx_buddy_challenges_status ON public.buddy_challenges(status) WHERE status IN ('pending', 'accepted');

-- RLS
ALTER TABLE public.buddy_challenges ENABLE ROW LEVEL SECURITY;

-- Users can view challenges in matches they belong to
CREATE POLICY "Users can view their match challenges"
  ON public.buddy_challenges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.buddy_matches bm
      WHERE bm.id = buddy_challenges.match_id
      AND (bm.user_a_id = auth.uid() OR bm.user_b_id = auth.uid())
    )
  );

-- Users can create challenges in their matches
CREATE POLICY "Users can create challenges"
  ON public.buddy_challenges FOR INSERT
  WITH CHECK (
    challenger_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.buddy_matches bm
      WHERE bm.id = buddy_challenges.match_id
      AND bm.status = 'active'
      AND (bm.user_a_id = auth.uid() OR bm.user_b_id = auth.uid())
    )
  );

-- Users can update challenges they're part of (accept/decline/complete)
CREATE POLICY "Users can update their challenges"
  ON public.buddy_challenges FOR UPDATE
  USING (
    challenger_id = auth.uid() OR challenged_id = auth.uid()
  );

-- Enable Realtime for challenges
ALTER PUBLICATION supabase_realtime ADD TABLE public.buddy_challenges;
