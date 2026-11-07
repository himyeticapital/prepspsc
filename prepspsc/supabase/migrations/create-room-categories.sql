-- Create room_categories table
CREATE TABLE IF NOT EXISTS room_categories (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  icon VARCHAR(50) DEFAULT 'Users',
  color VARCHAR(50) DEFAULT 'teal',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories
INSERT INTO room_categories (slug, label, icon, color, sort_order) VALUES
  ('general', 'General', 'Users', 'teal', 0),
  ('prelims', 'Prelims', 'BookOpen', 'blue', 1),
  ('history', 'History', 'Landmark', 'amber', 2),
  ('current-affairs', 'Current Affairs', 'Newspaper', 'cyan', 3),
  ('block-officer', 'Block Officer', 'Briefcase', 'rose', 4)
ON CONFLICT (slug) DO NOTHING;

-- Add category_id column to rooms table (foreign key)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS category_id INT REFERENCES room_categories(id);

-- Migrate existing category data (text to foreign key)
UPDATE rooms r
SET category_id = rc.id
FROM room_categories rc
WHERE r.category = rc.slug AND r.category_id IS NULL;

-- Enable RLS
ALTER TABLE room_categories ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read categories
CREATE POLICY "Anyone can read room categories"
  ON room_categories
  FOR SELECT
  USING (true);

-- Policy: Only admins can modify categories
CREATE POLICY "Only admins can modify room categories"
  ON room_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'teacher')
    )
  );
