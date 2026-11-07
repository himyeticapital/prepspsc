-- Migration: External API Key System
-- Purpose: Creates tables and functions for managing external API keys,
--          usage logging, and monthly quota tracking for the PrepSPSC
--          public API. Only service_role has access (no public RLS policies).

-- =============================================================================
-- Table 1: external_api_keys
-- Stores hashed API keys with tier-based rate limits and quotas.
-- =============================================================================
CREATE TABLE IF NOT EXISTS external_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'paid', 'enterprise')),
  rate_limit_rpm INTEGER NOT NULL DEFAULT 10,
  monthly_quota INTEGER NOT NULL DEFAULT 1000,
  total_requests BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE external_api_keys IS 'Stores external API keys with tier-based rate limits and quotas';
COMMENT ON COLUMN external_api_keys.key_hash IS 'SHA-256 hash of the API key';
COMMENT ON COLUMN external_api_keys.key_prefix IS 'sk_live_<first 8 chars> for identification';
COMMENT ON COLUMN external_api_keys.tier IS 'free: 10 RPM / 1000 monthly, paid: 60 RPM / 50000 monthly, enterprise: 500 RPM / unlimited';
COMMENT ON COLUMN external_api_keys.monthly_quota IS 'Monthly request quota. 0 = unlimited (enterprise)';

-- =============================================================================
-- Table 2: api_usage_log
-- Per-request usage log for analytics and debugging.
-- =============================================================================
CREATE TABLE IF NOT EXISTS api_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES external_api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  query TEXT,
  results_count INTEGER DEFAULT 0,
  response_time_ms INTEGER,
  ip_address TEXT,
  status_code INTEGER NOT NULL DEFAULT 200,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_usage_log_key_id ON api_usage_log(api_key_id);
CREATE INDEX idx_api_usage_log_created_at ON api_usage_log(created_at);

COMMENT ON TABLE api_usage_log IS 'Per-request usage log for external API calls';

-- =============================================================================
-- Table 3: api_key_quotas
-- Monthly aggregated request counts for quota enforcement.
-- =============================================================================
CREATE TABLE IF NOT EXISTS api_key_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES external_api_keys(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(api_key_id, month)
);

COMMENT ON TABLE api_key_quotas IS 'Monthly aggregated request counts per API key';
COMMENT ON COLUMN api_key_quotas.month IS 'Format: YYYY-MM';

-- =============================================================================
-- RLS: Enable on all tables, no public policies (service_role only)
-- =============================================================================
ALTER TABLE external_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_quotas ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Function: increment_api_usage
-- Atomically increments total_requests, updates last_used_at, and upserts
-- the monthly quota row.
-- =============================================================================
CREATE OR REPLACE FUNCTION increment_api_usage(p_key_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Update key stats
  UPDATE external_api_keys
  SET total_requests = total_requests + 1,
      last_used_at = now(),
      updated_at = now()
  WHERE id = p_key_id;

  -- Upsert monthly quota
  INSERT INTO api_key_quotas (api_key_id, month, request_count)
  VALUES (p_key_id, to_char(now(), 'YYYY-MM'), 1)
  ON CONFLICT (api_key_id, month)
  DO UPDATE SET request_count = api_key_quotas.request_count + 1, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION increment_api_usage(UUID) IS 'Atomically increments API usage counters and upserts monthly quota';

-- =============================================================================
-- Function: check_api_quota
-- Returns the current month request count for quota enforcement.
-- =============================================================================
CREATE OR REPLACE FUNCTION check_api_quota(p_key_id UUID)
RETURNS INTEGER AS $$
DECLARE
  current_count INTEGER;
BEGIN
  SELECT COALESCE(request_count, 0) INTO current_count
  FROM api_key_quotas
  WHERE api_key_id = p_key_id
    AND month = to_char(now(), 'YYYY-MM');

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  RETURN current_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_api_quota(UUID) IS 'Returns current month request count for the given API key';

-- =============================================================================
-- Grants: Only service_role can execute these functions
-- =============================================================================
REVOKE EXECUTE ON FUNCTION increment_api_usage(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_api_usage(UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION check_api_quota(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_api_quota(UUID) TO service_role;
