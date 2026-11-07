-- Add missing media_data column to guided_learning_messages
-- This column stores video suggestions and diagram references from the tutor

ALTER TABLE guided_learning_messages
ADD COLUMN IF NOT EXISTS media_data JSONB;

-- Add a comment explaining the structure
COMMENT ON COLUMN guided_learning_messages.media_data IS 'Stores media suggestions: { videos: [{title, searchQuery, reason}], diagrams: [{title, searchQuery, type}] }';
