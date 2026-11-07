-- Complete fix for guided learning feature
-- Run this to add all missing columns

-- 1. Add media_data column to messages table
ALTER TABLE guided_learning_messages
ADD COLUMN IF NOT EXISTS media_data JSONB;

-- 2. Add rate limiting columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS guided_sessions_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS guided_sessions_last_date DATE;

-- 3. Verify the tables exist (this will show an error if they don't exist)
-- If you get an error here, you need to run the full 20260201_add_guided_learning.sql migration first
SELECT COUNT(*) FROM guided_learning_sessions LIMIT 1;
SELECT COUNT(*) FROM guided_learning_messages LIMIT 1;
