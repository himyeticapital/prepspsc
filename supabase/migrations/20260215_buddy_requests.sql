-- Buddy Requests: allows users to send buddy requests via username search
-- Invite links bypass this and create instant matches (consent implied)
CREATE TABLE public.buddy_requests (
  id BIGSERIAL PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id)
);

CREATE INDEX idx_buddy_requests_receiver ON public.buddy_requests(receiver_id) WHERE status = 'pending';
CREATE INDEX idx_buddy_requests_sender ON public.buddy_requests(sender_id);

-- RLS
ALTER TABLE public.buddy_requests ENABLE ROW LEVEL SECURITY;

-- Users can view requests they sent or received
CREATE POLICY "Users can view own requests" ON public.buddy_requests
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can create requests (as sender)
CREATE POLICY "Users can send requests" ON public.buddy_requests
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Users can update requests they received (accept/decline)
CREATE POLICY "Users can respond to received requests" ON public.buddy_requests
  FOR UPDATE USING (auth.uid() = receiver_id);

-- Enable Realtime for requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.buddy_requests;
