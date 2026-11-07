-- Add is_active column to tests table for soft delete functionality
-- Run this in your Supabase SQL Editor

ALTER TABLE tests
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;

-- Create an index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_tests_is_active ON tests(is_active);

-- Update any existing tests to be active
UPDATE tests SET is_active = true WHERE is_active IS NULL;
