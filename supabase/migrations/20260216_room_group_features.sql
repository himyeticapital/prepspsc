-- =============================================================
-- Room Group Features: Invites, Group Challenges, Participants
-- =============================================================

-- 1. Room Invites
CREATE TABLE public.room_invites (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_room_invites_unique_pending
  ON public.room_invites(room_id, invitee_id) WHERE status = 'pending';
CREATE INDEX idx_room_invites_invitee ON public.room_invites(invitee_id) WHERE status = 'pending';
CREATE INDEX idx_room_invites_room ON public.room_invites(room_id);

ALTER TABLE public.room_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can create invites" ON public.room_invites
  FOR INSERT WITH CHECK (
    inviter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_room_subscriptions urs
      WHERE urs.room_id = room_invites.room_id AND urs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own invites" ON public.room_invites
  FOR SELECT USING (invitee_id = auth.uid() OR inviter_id = auth.uid());

CREATE POLICY "Invitees can update own invites" ON public.room_invites
  FOR UPDATE USING (invitee_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.room_invites;

-- 2. Room Challenges (group challenges scoped to a room)
CREATE TABLE public.room_challenges (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.profiles(id),
  test_id BIGINT NOT NULL REFERENCES public.tests(id),
  mode TEXT NOT NULL DEFAULT 'async' CHECK (mode IN ('sync', 'async')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_room_challenges_room ON public.room_challenges(room_id);
CREATE INDEX idx_room_challenges_active ON public.room_challenges(room_id, status) WHERE status IN ('pending', 'active');

ALTER TABLE public.room_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room members can view challenges" ON public.room_challenges
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_room_subscriptions urs
            WHERE urs.room_id = room_challenges.room_id AND urs.user_id = auth.uid())
  );

CREATE POLICY "Room members can create challenges" ON public.room_challenges
  FOR INSERT WITH CHECK (
    creator_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.user_room_subscriptions urs
                WHERE urs.room_id = room_challenges.room_id AND urs.user_id = auth.uid())
  );

CREATE POLICY "Members can update challenges" ON public.room_challenges
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_room_subscriptions urs
            WHERE urs.room_id = room_challenges.room_id AND urs.user_id = auth.uid())
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.room_challenges;

-- 3. Room Challenge Participants (join table)
CREATE TABLE public.room_challenge_participants (
  id BIGSERIAL PRIMARY KEY,
  challenge_id BIGINT NOT NULL REFERENCES public.room_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed')),
  attempt_id BIGINT REFERENCES public.test_attempts(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(challenge_id, user_id)
);

CREATE INDEX idx_rcp_challenge ON public.room_challenge_participants(challenge_id);
CREATE INDEX idx_rcp_user ON public.room_challenge_participants(user_id);

ALTER TABLE public.room_challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room members can view participants" ON public.room_challenge_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.room_challenges rc
      JOIN public.user_room_subscriptions urs ON urs.room_id = rc.room_id
      WHERE rc.id = room_challenge_participants.challenge_id AND urs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own participation" ON public.room_challenge_participants
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Challenge creator can insert participants" ON public.room_challenge_participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.room_challenges rc
      WHERE rc.id = room_challenge_participants.challenge_id AND rc.creator_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.room_challenge_participants;
