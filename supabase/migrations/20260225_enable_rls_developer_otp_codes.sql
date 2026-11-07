-- Enable RLS on developer_otp_codes
-- All access is via service role key from API routes (which bypasses RLS),
-- so no policies are needed — this just closes the public exposure.
ALTER TABLE public.developer_otp_codes ENABLE ROW LEVEL SECURITY;
