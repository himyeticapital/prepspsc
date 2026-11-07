-- PYQ API rate limit test (per-key requests per minute, kept in Postgres instead of Redis).
-- Run the whole file in one go as postgres. It ALWAYS ends with an exception, so every change it
-- makes is rolled back. The exception message is the report: "0 failure(s)" means it passes.

DO $test$
DECLARE
  failures text[] := '{}';
  k1 uuid;
  k2 uuid;
  r jsonb;
  i integer;
BEGIN
  INSERT INTO public.external_api_keys (key_hash, key_prefix, name, owner_email, rate_limit_rpm)
  VALUES ('test_hash_1_' || gen_random_uuid(), 'sk_test', 'rl test 1', 'rl1@prepspsc-test.local', 3)
  RETURNING id INTO k1;
  INSERT INTO public.external_api_keys (key_hash, key_prefix, name, owner_email, rate_limit_rpm)
  VALUES ('test_hash_2_' || gen_random_uuid(), 'sk_test', 'rl test 2', 'rl2@prepspsc-test.local', 3)
  RETURNING id INTO k2;

  -- 1. A key gets exactly its per-minute allowance, then is refused with a retry time
  BEGIN
    FOR i IN 1..3 LOOP
      r := public.api_rate_limit_hit(k1, 3);
      IF (r->>'allowed')::boolean IS NOT TRUE THEN failures := failures || ('request ' || i || ' was refused: ' || r::text); END IF;
    END LOOP;
    r := public.api_rate_limit_hit(k1, 3);
    IF (r->>'allowed')::boolean IS NOT FALSE THEN failures := failures || ('4th request was allowed: ' || r::text); END IF;
    IF coalesce((r->>'retry_after')::int, 0) NOT BETWEEN 1 AND 61 THEN
      failures := failures || ('retry_after out of range: ' || r::text);
    END IF;
  EXCEPTION WHEN OTHERS THEN failures := failures || ('allowance: ' || SQLERRM); END;

  -- 2. One key's traffic doesn't use up another key's allowance
  BEGIN
    r := public.api_rate_limit_hit(k2, 3);
    IF (r->>'allowed')::boolean IS NOT TRUE THEN failures := failures || ('another key was blocked: ' || r::text); END IF;
  EXCEPTION WHEN OTHERS THEN failures := failures || ('other key: ' || SQLERRM); END;

  -- 3. Old minutes are cleaned up
  BEGIN
    INSERT INTO public.api_rate_limit_windows (key_id, window_start, hits)
    VALUES (k1, date_trunc('minute', now()) - interval '30 minutes', 99);
    PERFORM public.api_rate_limit_hit(k1, 3);
    IF EXISTS (SELECT 1 FROM public.api_rate_limit_windows WHERE key_id = k1 AND window_start < now() - interval '10 minutes') THEN
      failures := failures || 'old windows were not cleaned up'::text;
    END IF;
  EXCEPTION WHEN OTHERS THEN failures := failures || ('cleanup: ' || SQLERRM); END;

  -- 4. Bad input is rejected
  BEGIN
    r := public.api_rate_limit_hit(k1, 0);
    failures := failures || 'accepted a zero limit'::text;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 5. Signed-in users and visitors can't call it or read the counters
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', gen_random_uuid())::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    r := public.api_rate_limit_hit(k1, 1000);
    failures := failures || 'a signed-in user can call api_rate_limit_hit'::text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '42501' THEN failures := failures || ('user call: ' || SQLSTATE || ' ' || SQLERRM); END IF;
  END;
  BEGIN
    PERFORM count(*) FROM public.api_rate_limit_windows;
    failures := failures || 'a signed-in user can read rate limit counters'::text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '42501' THEN failures := failures || ('user read: ' || SQLSTATE || ' ' || SQLERRM); END IF;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN
    r := public.api_rate_limit_hit(k1, 1000);
    failures := failures || 'a visitor can call api_rate_limit_hit'::text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '42501' THEN failures := failures || ('anon call: ' || SQLSTATE || ' ' || SQLERRM); END IF;
  END;
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION 'API RATE LIMIT TEST (rolled back): % failure(s)%', coalesce(array_length(failures, 1), 0),
    CASE WHEN coalesce(array_length(failures, 1), 0) = 0 THEN '' ELSE E'\n- ' || array_to_string(failures, E'\n- ') END;
END
$test$;
