-- Migration: Add Bot Integration + Study Notes
-- Date: 2026-02-04
-- Feature C: WhatsApp & Telegram Bot

-- ============================================
-- STUDY NOTES (NEW FEATURE)
-- ============================================
-- PrepSPSC currently has no notes feature (only local task widget)
-- This enables syncing notes between web app and bot

CREATE TABLE IF NOT EXISTS study_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'web',  -- 'web' | 'telegram' | 'whatsapp' | 'voice'
  tags TEXT[] DEFAULT '{}',            -- ['polity', 'article-21', 'fundamental-rights']
  topic_id UUID,                       -- Optional link to study topic
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for study_notes
CREATE INDEX IF NOT EXISTS idx_study_notes_user ON study_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_study_notes_tags ON study_notes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_study_notes_created ON study_notes(user_id, created_at DESC);

-- RLS for study_notes
ALTER TABLE study_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes"
  ON study_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own notes"
  ON study_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON study_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON study_notes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- BOT CONNECTIONS
-- ============================================
-- Links PrepSPSC accounts to Telegram/WhatsApp

CREATE TABLE IF NOT EXISTS bot_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,              -- 'telegram' | 'whatsapp'
  platform_user_id TEXT NOT NULL,      -- Telegram chat_id or WhatsApp phone
  username TEXT,                       -- Telegram username (optional)
  connected_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  notification_preferences JSONB DEFAULT '{
    "morning_reminder": true,
    "morning_time": "08:00",
    "evening_nudge": true,
    "streak_alerts": true,
    "daily_summary": true
  }'::jsonb,
  last_interaction_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(platform, platform_user_id)
);

-- Indexes for bot_connections
CREATE INDEX IF NOT EXISTS idx_bot_connections_user ON bot_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_connections_lookup ON bot_connections(platform, platform_user_id);
CREATE INDEX IF NOT EXISTS idx_bot_connections_active ON bot_connections(is_active) WHERE is_active = true;

-- RLS for bot_connections
ALTER TABLE bot_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connections"
  ON bot_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own connections"
  ON bot_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections"
  ON bot_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own connections"
  ON bot_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can manage all connections (for webhook/cron)
CREATE POLICY "Service role full access"
  ON bot_connections FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- BOT MESSAGES (History for context)
-- ============================================

CREATE TABLE IF NOT EXISTS bot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES bot_connections(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,             -- 'incoming' | 'outgoing'
  message_type TEXT NOT NULL,          -- 'text' | 'voice' | 'photo' | 'callback'
  content TEXT,
  metadata JSONB DEFAULT '{}',         -- Platform-specific data
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for bot_messages
CREATE INDEX IF NOT EXISTS idx_bot_messages_connection ON bot_messages(connection_id);
CREATE INDEX IF NOT EXISTS idx_bot_messages_created ON bot_messages(connection_id, created_at DESC);

-- RLS for bot_messages (service role only - users don't directly access)
ALTER TABLE bot_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on messages"
  ON bot_messages FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- BOT PENDING REGISTRATIONS
-- ============================================
-- For users signing up entirely through bot chat

CREATE TABLE IF NOT EXISTS bot_pending_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  platform_user_id TEXT NOT NULL,
  registration_step TEXT DEFAULT 'name', -- 'name' | 'exam' | 'state' | 'avatar' | 'complete'
  collected_data JSONB DEFAULT '{}',     -- { name, exam_type, exam_state, avatar }
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '1 hour'),
  UNIQUE(platform, platform_user_id)
);

-- Index for pending registrations
CREATE INDEX IF NOT EXISTS idx_bot_pending_lookup ON bot_pending_registrations(platform, platform_user_id);

-- RLS for pending registrations (service role only)
ALTER TABLE bot_pending_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on pending"
  ON bot_pending_registrations FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp for study_notes
CREATE OR REPLACE FUNCTION update_study_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER study_notes_updated_at
  BEFORE UPDATE ON study_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_study_notes_updated_at();

-- Function to clean up expired pending registrations (called by cron)
CREATE OR REPLACE FUNCTION cleanup_expired_bot_registrations()
RETURNS void AS $$
BEGIN
  DELETE FROM bot_pending_registrations
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant service role full access for webhook operations
GRANT ALL ON study_notes TO service_role;
GRANT ALL ON bot_connections TO service_role;
GRANT ALL ON bot_messages TO service_role;
GRANT ALL ON bot_pending_registrations TO service_role;
