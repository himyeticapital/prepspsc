-- PYQ API per-key rate limit, kept in Postgres.
--
-- The pyq-api edge function used Upstash Redis for its requests-per-minute limit. That Redis
-- database was deleted, and the function lets requests through when Redis is unreachable, so the
-- public API had no rate limit. Counting per key per minute here needs no extra secret.
-- Only the service role (the edge function) can use it.

CREATE TABLE IF NOT EXISTS public.api_rate_limit_windows (
  key_id uuid NOT NULL REFERENCES public.external_api_keys(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key_id, window_start)
);

ALTER TABLE public.api_rate_limit_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_rate_limit_windows FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.api_rate_limit_windows TO service_role;

-- Count one request for this key in the current minute.
-- Returns {"allowed": true, "hits": n} or {"allowed": false, "retry_after": seconds}.
CREATE OR REPLACE FUNCTION public.api_rate_limit_hit(p_key_id uuid, p_limit integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_window timestamptz := date_trunc('minute', clock_timestamp());
  v_hits integer;
BEGIN
  IF p_key_id IS NULL OR p_limit IS NULL OR p_limit <= 0 THEN
    RAISE EXCEPTION 'invalid rate limit arguments' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.api_rate_limit_windows AS w (key_id, window_start, hits)
  VALUES (p_key_id, v_window, 1)
  ON CONFLICT (key_id, window_start) DO UPDATE SET hits = w.hits + 1
  RETURNING w.hits INTO v_hits;

  DELETE FROM public.api_rate_limit_windows
  WHERE key_id = p_key_id AND window_start < v_window - interval '5 minutes';

  IF v_hits > p_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'retry_after', greatest(1, ceil(extract(epoch FROM (v_window + interval '1 minute' - clock_timestamp())))::int)
    );
  END IF;
  RETURN jsonb_build_object('allowed', true, 'hits', v_hits);
END;
$$;

REVOKE ALL ON FUNCTION public.api_rate_limit_hit(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_rate_limit_hit(uuid, integer) TO service_role;
