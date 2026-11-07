-- Private profile fields test (phone number, signup IP, IP location, VPN flag).
-- Run the whole file in one go as postgres. It ALWAYS ends with an exception, so every change it
-- makes is rolled back. The exception message is the report: "0 failure(s)" means it passes.

DO $test$
DECLARE
  failures text[] := '{}';
  alice uuid := gen_random_uuid();
  bob uuid := gen_random_uuid();
  admin_user uuid := gen_random_uuid();
  n integer;
  state text;
  leaked text;
BEGIN
  -- 1. The public profile table no longer carries private fields
  SELECT string_agg(column_name, ', ') INTO leaked
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles'
    AND column_name IN ('phone_number', 'signup_ip', 'ip_location', 'is_vpn');
  IF leaked IS NOT NULL THEN
    failures := failures || ('profiles still has: ' || leaked);
  END IF;

  -- Three users, created the way sign-up does it (Bob signs up with a phone number)
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) VALUES
    (alice, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pp-a-' || alice || '@prepspsc-test.local', '{}'::jsonb, now(), now()),
    (bob, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pp-b-' || bob || '@prepspsc-test.local', '{"phone_number": "+919800000001"}'::jsonb, now(), now()),
    (admin_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pp-c-' || admin_user || '@prepspsc-test.local', '{}'::jsonb, now(), now());
  UPDATE public.profiles SET role = 'admin' WHERE id = admin_user;

  -- 2. Sign-up stores the phone number in the private table
  BEGIN
    SELECT count(*) INTO n FROM public.profile_private WHERE id = bob AND phone_number = '+919800000001';
    IF n <> 1 THEN failures := failures || 'sign-up did not store the phone privately'::text; END IF;
  EXCEPTION WHEN OTHERS THEN failures := failures || ('private table check: ' || SQLERRM); END;
  UPDATE public.profile_private SET signup_ip = '203.0.113.7', ip_location = 'Gangtok' WHERE id = bob;  -- as the server would

  -- Act as Alice (signed in) for the next checks
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', alice)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- 3. Alice can't see Bob's private fields
  BEGIN
    SELECT count(*) INTO n FROM public.profile_private WHERE id = bob;
    IF n <> 0 THEN failures := failures || 'a user can read another user''s phone/IP'::text; END IF;
  EXCEPTION WHEN OTHERS THEN failures := failures || ('read other: ' || SQLERRM); END;

  -- 4. Alice can read and set her own phone number
  BEGIN
    SELECT count(*) INTO n FROM public.profile_private WHERE id = alice;
    IF n <> 1 THEN failures := failures || 'a user cannot see their own private row'::text; END IF;
    UPDATE public.profile_private SET phone_number = '+919800000002' WHERE id = alice;
    SELECT count(*) INTO n FROM public.profile_private WHERE id = alice AND phone_number = '+919800000002';
    IF n <> 1 THEN failures := failures || 'a user cannot set their own phone'::text; END IF;
  EXCEPTION WHEN OTHERS THEN failures := failures || ('own phone: ' || SQLERRM); END;

  -- 5. ...but can't change their own IP data, or touch Bob's row
  BEGIN
    UPDATE public.profile_private SET signup_ip = '1.2.3.4' WHERE id = alice;
    failures := failures || 'a user rewrote their own signup IP'::text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '42501' THEN failures := failures || ('own ip: ' || SQLSTATE || ' ' || SQLERRM); END IF;
  END;
  BEGIN
    UPDATE public.profile_private SET phone_number = '+910000000000' WHERE id = bob;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN failures := failures || 'a user changed another user''s phone'::text; END IF;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '42501' THEN failures := failures || ('other phone: ' || SQLSTATE || ' ' || SQLERRM); END IF;
  END;

  EXECUTE 'RESET ROLE';

  -- 6. Admins can read everyone's private fields
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', admin_user)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    SELECT count(*) INTO n FROM public.profile_private WHERE id = bob AND signup_ip = '203.0.113.7';
    IF n <> 1 THEN failures := failures || 'an admin cannot read private fields'::text; END IF;
  EXCEPTION WHEN OTHERS THEN failures := failures || ('admin read: ' || SQLERRM); END;
  EXECUTE 'RESET ROLE';

  -- 7. Logged-out visitors can't read anything
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN
    SELECT count(*) INTO n FROM public.profile_private;
    IF n <> 0 THEN failures := failures || 'logged-out visitors can read private fields'::text; END IF;
  EXCEPTION WHEN OTHERS THEN
    state := SQLSTATE;
    IF state <> '42501' THEN failures := failures || ('anon read: ' || state || ' ' || SQLERRM); END IF;
  END;
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION 'PRIVATE PROFILE TEST (rolled back): % failure(s)%', coalesce(array_length(failures, 1), 0),
    CASE WHEN coalesce(array_length(failures, 1), 0) = 0 THEN '' ELSE E'\n- ' || array_to_string(failures, E'\n- ') END;
END
$test$;
