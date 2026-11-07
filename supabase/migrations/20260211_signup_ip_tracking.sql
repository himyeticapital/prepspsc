-- Add IP tracking columns to profiles for signup fraud detection
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signup_ip TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_vpn BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ip_location TEXT;
