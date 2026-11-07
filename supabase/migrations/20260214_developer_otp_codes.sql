-- OTP verification codes for developer portal
CREATE TABLE IF NOT EXISTS public.developer_otp_codes (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  phone TEXT,
  code_hash TEXT NOT NULL,
  otp_type TEXT NOT NULL CHECK (otp_type IN ('email', 'phone')),
  attempts INT DEFAULT 0,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_otp_email ON public.developer_otp_codes (email, otp_type, expires_at);
CREATE INDEX IF NOT EXISTS idx_dev_otp_phone ON public.developer_otp_codes (phone, otp_type, expires_at);

-- Add phone_number column to developer signups
ALTER TABLE public.api_developer_signups
  ADD COLUMN IF NOT EXISTS phone_number TEXT;
