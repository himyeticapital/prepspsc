-- Collaborative study plan sessions
-- Allows two matched buddies to generate a study plan together in real-time.
-- The host drives the form; the guest joins via a buddy DM deep-link.
-- Both users get their own copy of the plan saved independently.

CREATE TABLE public.collab_plan_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'active', 'generating', 'completed', 'cancelled')),
  -- Last known form state, persisted so guests joining late can hydrate immediately
  form_params   jsonb NOT NULL DEFAULT '{}',
  host_plan_id  uuid REFERENCES public.study_plans(id) ON DELETE SET NULL,
  guest_plan_id uuid REFERENCES public.study_plans(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '30 minutes')
);

ALTER TABLE public.collab_plan_sessions ENABLE ROW LEVEL SECURITY;

-- Both host and guest can read their own session
CREATE POLICY "collab_plan_sessions_select"
  ON public.collab_plan_sessions FOR SELECT
  USING (auth.uid() = host_id OR auth.uid() = guest_id);

-- Only the host can create a session
CREATE POLICY "collab_plan_sessions_insert"
  ON public.collab_plan_sessions FOR INSERT
  WITH CHECK (auth.uid() = host_id);

-- Both host and guest can update (status changes, plan IDs)
CREATE POLICY "collab_plan_sessions_update"
  ON public.collab_plan_sessions FOR UPDATE
  USING (auth.uid() = host_id OR auth.uid() = guest_id);

CREATE INDEX idx_collab_plan_sessions_guest  ON public.collab_plan_sessions(guest_id);
CREATE INDEX idx_collab_plan_sessions_host   ON public.collab_plan_sessions(host_id);
CREATE INDEX idx_collab_plan_sessions_status ON public.collab_plan_sessions(status)
  WHERE status IN ('pending', 'active', 'generating');
