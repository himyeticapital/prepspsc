-- Add mode column to buddy_challenges: 'sync' (take together now) or 'async' (take at own pace)
ALTER TABLE public.buddy_challenges ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'async' CHECK (mode IN ('sync', 'async'));
