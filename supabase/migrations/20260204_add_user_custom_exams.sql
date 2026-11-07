-- Migration: Add user custom exams feature
-- Allows users to create their own exams with syllabus uploads and microtheme extraction

-- Create user_custom_exams table
CREATE TABLE IF NOT EXISTS user_custom_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('university', 'school', 'professional', 'other')),
  syllabus_content TEXT,
  microthemes JSONB,
  exam_scheme JSONB,
  pyq_years TEXT[] DEFAULT '{}',
  microthemes_source TEXT CHECK (microthemes_source IN ('pyq_analysis', 'syllabus_estimation', 'manual', 'unknown')),
  extraction_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, slug)
);

-- Create user_custom_exam_uploads table
CREATE TABLE IF NOT EXISTS user_custom_exam_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES user_custom_exams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  upload_type TEXT NOT NULL CHECK (upload_type IN ('syllabus', 'pyq')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  parsed_content TEXT,
  year TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_custom_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_custom_exam_uploads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_custom_exams
CREATE POLICY "Users can view own exams"
  ON user_custom_exams FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own exams"
  ON user_custom_exams FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exams"
  ON user_custom_exams FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own exams"
  ON user_custom_exams FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for user_custom_exam_uploads
CREATE POLICY "Users can view own uploads"
  ON user_custom_exam_uploads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own uploads"
  ON user_custom_exam_uploads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own uploads"
  ON user_custom_exam_uploads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own uploads"
  ON user_custom_exam_uploads FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_user_custom_exams_user_id ON user_custom_exams(user_id);
CREATE INDEX idx_user_custom_exams_is_active ON user_custom_exams(is_active);
CREATE INDEX idx_user_custom_exam_uploads_exam_id ON user_custom_exam_uploads(exam_id);
CREATE INDEX idx_user_custom_exam_uploads_user_id ON user_custom_exam_uploads(user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_custom_exams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER user_custom_exams_updated_at
  BEFORE UPDATE ON user_custom_exams
  FOR EACH ROW
  EXECUTE FUNCTION update_user_custom_exams_updated_at();

-- Create storage bucket for user exam uploads (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-exam-uploads', 'user-exam-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for user exam uploads bucket
CREATE POLICY "Users can upload to their own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-exam-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own uploads"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'user-exam-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own uploads"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'user-exam-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
