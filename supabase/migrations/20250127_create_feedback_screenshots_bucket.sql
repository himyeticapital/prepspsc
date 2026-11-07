-- =====================================================
-- FEEDBACK SCREENSHOTS STORAGE BUCKET
-- =====================================================

-- Create the feedback-screenshots storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-screenshots',
  'feedback-screenshots',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STORAGE POLICIES
-- =====================================================

-- Users can upload screenshots to their own folder
CREATE POLICY "Users can upload feedback screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'feedback-screenshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own screenshots
CREATE POLICY "Users can update own feedback screenshots"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'feedback-screenshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'feedback-screenshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Public read access for screenshots (since bucket is public)
CREATE POLICY "Public read access for feedback screenshots"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'feedback-screenshots');

-- Admins can delete any screenshots
CREATE POLICY "Admins can delete feedback screenshots"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'feedback-screenshots' AND
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Users can delete their own screenshots
CREATE POLICY "Users can delete own feedback screenshots"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'feedback-screenshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
