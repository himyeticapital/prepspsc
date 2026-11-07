-- Add difficulty level column to tests table
-- Difficulty levels: 'easy', 'moderate', 'hard', 'none' (none = no difficulty shown to user)

ALTER TABLE public.tests
ADD COLUMN difficulty text DEFAULT 'none' CHECK (difficulty IN ('easy', 'moderate', 'hard', 'none'));

-- Add comment to explain the column
COMMENT ON COLUMN public.tests.difficulty IS 'Difficulty level of the test. Use "none" to hide difficulty from users.';
