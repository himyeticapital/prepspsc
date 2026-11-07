-- =====================================================
-- USER STATUS NOTES (Instagram Notes-like feature)
-- Short ephemeral status messages above user avatars
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_status_notes (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_type TEXT NOT NULL CHECK (note_type IN ('note', 'music')),
  content TEXT NOT NULL CHECK (char_length(content) <= 60),
  -- Music-specific fields (from Deezer API)
  music_artist TEXT CHECK (char_length(music_artist) <= 100),
  music_preview_url TEXT,
  music_album_art TEXT,
  music_deezer_id BIGINT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_music CHECK (
    note_type != 'music' OR (music_artist IS NOT NULL AND music_preview_url IS NOT NULL)
  )
);

-- Indexes for efficient lookups (no partial indexes — NOW() is not IMMUTABLE)
-- One-active-note-per-user enforced at application level (delete old before insert)
CREATE INDEX IF NOT EXISTS idx_status_notes_user_expires
  ON public.user_status_notes (user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_status_notes_expires
  ON public.user_status_notes (expires_at);

-- RLS
ALTER TABLE public.user_status_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_active" ON public.user_status_notes
  FOR SELECT TO authenticated USING (expires_at > NOW());
CREATE POLICY "insert_own" ON public.user_status_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON public.user_status_notes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "delete_own" ON public.user_status_notes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Batch fetch for leaderboard/presence
CREATE OR REPLACE FUNCTION get_active_status_notes(user_ids UUID[])
RETURNS TABLE (
  id INT, user_id UUID, note_type TEXT, content TEXT,
  music_artist TEXT, music_preview_url TEXT, music_album_art TEXT,
  music_deezer_id BIGINT, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ
) AS $$
  SELECT n.id, n.user_id, n.note_type, n.content,
         n.music_artist, n.music_preview_url, n.music_album_art,
         n.music_deezer_id, n.expires_at, n.created_at
  FROM public.user_status_notes n
  WHERE n.user_id = ANY(user_ids) AND n.expires_at > NOW()
  ORDER BY n.created_at DESC
$$ LANGUAGE sql SECURITY DEFINER;

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_status_notes;
