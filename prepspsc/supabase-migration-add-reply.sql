-- Add reply_to functionality to messages table
-- Run this in Supabase SQL Editor

-- Add reply_to column if it doesn't exist
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to bigint REFERENCES public.messages(id) ON DELETE SET NULL;

-- Create index for reply queries
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages(reply_to) WHERE reply_to IS NOT NULL;

-- Create foreign key constraint name for the select query
-- Note: The foreign key is named automatically by Postgres, we'll reference it as messages_reply_to_fkey

COMMENT ON COLUMN public.messages.reply_to IS 'References the message being replied to';
