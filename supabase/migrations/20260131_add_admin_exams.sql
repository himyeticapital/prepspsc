-- Admin Exam Management Tables
-- Allows admins to create/manage exam types with uploaded syllabi and PYQs

-- Table for admin-defined exams
CREATE TABLE IF NOT EXISTS admin_exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  syllabus_content TEXT,
  microthemes JSONB DEFAULT '[]'::jsonb,
  pyq_years TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Table for tracking file uploads (syllabus and PYQs)
CREATE TABLE IF NOT EXISTS admin_exam_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES admin_exams(id) ON DELETE CASCADE,
  upload_type TEXT NOT NULL CHECK (upload_type IN ('syllabus', 'pyq')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  parsed_content TEXT,
  year TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_exams_active ON admin_exams(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_exams_slug ON admin_exams(slug);
CREATE INDEX IF NOT EXISTS idx_exam_uploads_exam ON admin_exam_uploads(exam_id);

-- Enable RLS
ALTER TABLE admin_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_exam_uploads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_exams

-- Admins can do everything
CREATE POLICY "Admins can manage exams" ON admin_exams
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- All authenticated users can read active exams
CREATE POLICY "Users can read active exams" ON admin_exams
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- RLS Policies for admin_exam_uploads

-- Admins can manage uploads
CREATE POLICY "Admins can manage exam uploads" ON admin_exam_uploads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- All authenticated users can read uploads for active exams
CREATE POLICY "Users can read uploads for active exams" ON admin_exam_uploads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_exams
      WHERE admin_exams.id = admin_exam_uploads.exam_id
      AND admin_exams.is_active = true
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_admin_exam_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trigger_admin_exam_updated_at ON admin_exams;
CREATE TRIGGER trigger_admin_exam_updated_at
  BEFORE UPDATE ON admin_exams
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_exam_updated_at();
