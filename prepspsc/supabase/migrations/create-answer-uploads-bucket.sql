-- Create the answer-uploads storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'answer-uploads',
  'answer-uploads',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload their own answer files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own answer files" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for answer uploads" ON storage.objects;

-- Create policy to allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload their own answer files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'answer-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy to allow users to update their own files
CREATE POLICY "Users can update their own answer files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'answer-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'answer-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy to allow public read access (since bucket is public)
CREATE POLICY "Public read access for answer uploads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'answer-uploads');
