-- Migration: Add microtheme extraction tracking to profiles
-- Tracks usage for free user limits (3 extractions/month, unlimited for Pro)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS microtheme_extractions_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS microtheme_extractions_reset_at TIMESTAMPTZ DEFAULT now();

-- Comment for documentation
COMMENT ON COLUMN profiles.microtheme_extractions_used IS 'Number of microtheme extractions used this month (free users limited to 3)';
COMMENT ON COLUMN profiles.microtheme_extractions_reset_at IS 'Timestamp when extraction count was last reset (monthly)';
