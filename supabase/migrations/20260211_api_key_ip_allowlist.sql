-- Migration: Add IP allowlisting to external API keys
-- Purpose: Allow admins to restrict API key usage to specific IP addresses/CIDR ranges.
-- If allowed_ips is empty/null, all IPs are permitted (backwards compatible).

ALTER TABLE external_api_keys
  ADD COLUMN IF NOT EXISTS allowed_ips TEXT[] DEFAULT '{}';

COMMENT ON COLUMN external_api_keys.allowed_ips IS 'Array of allowed IP addresses or CIDR ranges. Empty = allow all.';
