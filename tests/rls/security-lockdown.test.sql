-- Security lockdown test.
-- Run the whole file in one go (e.g. Supabase SQL editor or psql as postgres).
-- It ALWAYS ends with an exception, so every change it makes is rolled back.
-- The exception message is the report: "0 failure(s)" means the lockdown holds.

DO $test$
DECLARE
  failures text[] := '{}';
  f regprocedure;
  me uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  some_room bigint;
  state text;
  server_only regprocedure[] := ARRAY[
    'public.award_xp(uuid,integer,text,text)',
    'public.check_api_quota(uuid)',
    'public.check_buddy_match()',
    'public.cleanup_expired_bot_registrations()',
    'public.create_api_key_for_developer(uuid,text,text)',
    'public.get_api_leaderboard(uuid,integer,text)',
    'public.get_api_user_analytics(uuid,text)',
    'public.get_room_online_count(bigint)',
    'public.get_table_member_count(bigint)',
    'public.get_unread_notification_count(uuid)',
    'public.get_user_table(uuid,bigint)',
    'public.grant_permission(uuid,text,uuid)',
    'public.handle_new_user()',
    'public.has_permission(uuid,text)',
    'public.increment_api_usage(uuid)',
    'public.is_user_banned(uuid,bigint)',
    'public.kick_from_table(uuid,uuid)',
    'public.leave_room_presence(uuid,bigint)',
    'public.mark_room_notifications_read(uuid,bigint)',
    'public.reset_broken_streaks()',
    'public.reset_monthly_streak_shields()',
    'public.revoke_permission(uuid,text,uuid)',
    'public.search_pyq_by_topic(text,text[],text[],integer)',
    'public.search_pyq_semantic(extensions.vector,text,text[],double precision,integer,uuid[],integer)',
    'public.search_rooms(text,uuid)',
    'public.sync_preparing_for_from_study_plan()',
    'public.trigger_plan_generation(uuid)',
    'public.update_room_presence(uuid,bigint,text)',
    'public.use_streak_shield(uuid)'
  ]::regprocedure[];
  user_facing regprocedure[] := ARRAY[
    'public.ban_user_from_room(uuid,uuid,bigint,text,integer)',
    'public.calculate_streak(uuid)',
    'public.create_study_table(bigint,text,uuid)',
    'public.get_active_status_notes(uuid[])',
    'public.get_buddy_candidates(uuid,integer)',
    'public.get_buddy_candidates(uuid,integer,text)',
    'public.increment_study_time(uuid,integer)',
    'public.join_table(uuid,bigint)',
    'public.leave_table(uuid)',
    'public.log_study_time(uuid,integer)',
    'public.unban_user_from_room(uuid,uuid,bigint)'
  ]::regprocedure[];
BEGIN
  -- 1. Logged-out visitors can't call any elevated (SECURITY DEFINER) function
  FOR f IN
    SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    failures := failures || ('anon can run ' || f::text);
  END LOOP;

  -- 2. Server-only functions: signed-in users can't call them, the service role can
  FOREACH f IN ARRAY server_only LOOP
    IF has_function_privilege('authenticated', f, 'EXECUTE') THEN
      failures := failures || ('signed-in users can run ' || f::text);
    END IF;
    IF NOT has_function_privilege('service_role', f, 'EXECUTE') THEN
      failures := failures || ('service role cannot run ' || f::text);
    END IF;
  END LOOP;

  -- 3. Functions the app calls as the signed-in user still work for signed-in users
  FOREACH f IN ARRAY user_facing LOOP
    IF NOT has_function_privilege('authenticated', f, 'EXECUTE') THEN
      failures := failures || ('signed-in users lost ' || f::text);
    END IF;
  END LOOP;

  -- A real (throwaway) user, created the way sign-up does it
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  VALUES (me, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'lockdown-' || me || '@prepspsc-test.local', '{}'::jsonb, now(), now());
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = me) THEN
    failures := failures || 'test setup: sign-up did not create a profile'::text;
  END IF;

  -- Act as that signed-in user for the rest of the test
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', me)::text, true);

  -- 4. A signed-in user can't act as someone else
  BEGIN PERFORM public.increment_study_time(other, 5); failures := failures || 'increment_study_time: acted as another user'::text;
  EXCEPTION WHEN OTHERS THEN IF SQLSTATE <> '42501' THEN failures := failures || ('increment_study_time other: ' || SQLSTATE || ' ' || SQLERRM); END IF; END;
  BEGIN PERFORM public.log_study_time(other, 5); failures := failures || 'log_study_time: acted as another user'::text;
  EXCEPTION WHEN OTHERS THEN IF SQLSTATE <> '42501' THEN failures := failures || ('log_study_time other: ' || SQLSTATE || ' ' || SQLERRM); END IF; END;
  BEGIN PERFORM public.calculate_streak(other); failures := failures || 'calculate_streak: acted as another user'::text;
  EXCEPTION WHEN OTHERS THEN IF SQLSTATE <> '42501' THEN failures := failures || ('calculate_streak other: ' || SQLSTATE || ' ' || SQLERRM); END IF; END;
  BEGIN PERFORM public.get_buddy_candidates(other, 5, NULL); failures := failures || 'get_buddy_candidates/3: acted as another user'::text;
  EXCEPTION WHEN OTHERS THEN IF SQLSTATE <> '42501' THEN failures := failures || ('get_buddy_candidates/3 other: ' || SQLSTATE || ' ' || SQLERRM); END IF; END;
  BEGIN PERFORM public.join_table(other, 0); failures := failures || 'join_table: acted as another user'::text;
  EXCEPTION WHEN OTHERS THEN IF SQLSTATE <> '42501' THEN failures := failures || ('join_table other: ' || SQLSTATE || ' ' || SQLERRM); END IF; END;
  BEGIN PERFORM public.leave_table(other); failures := failures || 'leave_table: acted as another user'::text;
  EXCEPTION WHEN OTHERS THEN IF SQLSTATE <> '42501' THEN failures := failures || ('leave_table other: ' || SQLSTATE || ' ' || SQLERRM); END IF; END;
  BEGIN PERFORM public.create_study_table(0, 'x', other); failures := failures || 'create_study_table: acted as another user'::text;
  EXCEPTION WHEN OTHERS THEN IF SQLSTATE <> '42501' THEN failures := failures || ('create_study_table other: ' || SQLSTATE || ' ' || SQLERRM); END IF; END;
  BEGIN PERFORM public.ban_user_from_room(other, me, 0, 'x', 1); failures := failures || 'ban_user_from_room: posed as another admin'::text;
  EXCEPTION WHEN OTHERS THEN IF SQLSTATE <> '42501' THEN failures := failures || ('ban_user_from_room other: ' || SQLSTATE || ' ' || SQLERRM); END IF; END;
  BEGIN PERFORM public.unban_user_from_room(other, me, 0); failures := failures || 'unban_user_from_room: posed as another admin'::text;
  EXCEPTION WHEN OTHERS THEN IF SQLSTATE <> '42501' THEN failures := failures || ('unban_user_from_room other: ' || SQLSTATE || ' ' || SQLERRM); END IF; END;

  -- 5. ...but can still act as themselves
  BEGIN PERFORM public.increment_study_time(me, 5); EXCEPTION WHEN OTHERS THEN failures := failures || ('own increment_study_time failed: ' || SQLERRM); END;
  BEGIN PERFORM public.log_study_time(me, 5); EXCEPTION WHEN OTHERS THEN failures := failures || ('own log_study_time failed: ' || SQLERRM); END;
  BEGIN PERFORM public.calculate_streak(me); EXCEPTION WHEN OTHERS THEN failures := failures || ('own calculate_streak failed: ' || SQLERRM); END;
  BEGIN PERFORM public.leave_table(me); EXCEPTION WHEN OTHERS THEN failures := failures || ('own leave_table failed: ' || SQLERRM); END;
  BEGIN PERFORM public.get_buddy_candidates(me, 5, NULL); EXCEPTION WHEN OTHERS THEN failures := failures || ('own get_buddy_candidates failed: ' || SQLERRM); END;

  -- 6. Implausible study minutes are rejected
  BEGIN PERFORM public.increment_study_time(me, 100000); failures := failures || 'increment_study_time accepted 100000 minutes'::text;
  EXCEPTION WHEN OTHERS THEN IF SQLSTATE <> '22023' THEN failures := failures || ('big minutes: ' || SQLSTATE || ' ' || SQLERRM); END IF; END;
  BEGIN PERFORM public.log_study_time(me, -30); failures := failures || 'log_study_time accepted negative minutes'::text;
  EXCEPTION WHEN OTHERS THEN IF SQLSTATE <> '22023' THEN failures := failures || ('negative minutes: ' || SQLSTATE || ' ' || SQLERRM); END IF; END;

  -- 7. A signed-in user can't promote themselves or touch protected profile fields
  BEGIN UPDATE public.profiles SET role = 'admin' WHERE id = me; failures := failures || 'user made themselves admin'::text;
  EXCEPTION WHEN OTHERS THEN IF SQLSTATE <> '42501' THEN failures := failures || ('self-admin: ' || SQLSTATE || ' ' || SQLERRM); END IF; END;
  BEGIN UPDATE public.profiles SET permissions = ARRAY['manage_users'] WHERE id = me; failures := failures || 'user granted themselves permissions'::text;
  EXCEPTION WHEN OTHERS THEN IF SQLSTATE <> '42501' THEN failures := failures || ('self-permissions: ' || SQLSTATE || ' ' || SQLERRM); END IF; END;
  -- onboarding marks the phone verified on the user's own profile (see hotfix migration)
  BEGIN UPDATE public.profiles SET phone_verified = true WHERE id = me; EXCEPTION WHEN OTHERS THEN failures := failures || ('onboarding phone_verified blocked: ' || SQLERRM); END;
  -- signup IP data now lives in profile_private (see tests/rls/private-profile.test.sql)
  -- ordinary profile edits still work
  BEGIN UPDATE public.profiles SET full_name = 'Lockdown Test' WHERE id = me; EXCEPTION WHEN OTHERS THEN failures := failures || ('normal profile edit failed: ' || SQLERRM); END;

  -- 8. Notifications: a user can't notify others about a room they don't own
  SELECT id INTO some_room FROM public.rooms WHERE owner_id IS DISTINCT FROM me AND created_by IS DISTINCT FROM me LIMIT 1;
  IF some_room IS NOT NULL THEN
    BEGIN
      EXECUTE 'SET LOCAL ROLE authenticated';
      INSERT INTO public.room_notifications (user_id, room_id, type, title, message)
      VALUES (other, some_room, 'room_update', 'test', 'test');
      EXECUTE 'RESET ROLE';
      failures := failures || 'user sent a notification for a room they do not own'::text;
    EXCEPTION WHEN OTHERS THEN
      state := SQLSTATE;
      EXECUTE 'RESET ROLE';
      IF state <> '42501' THEN failures := failures || ('notification insert: ' || state || ' ' || SQLERRM); END IF;
    END;
  END IF;

  -- 9. The service role (server code, cron) is not affected by the caller checks
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  BEGIN PERFORM public.increment_study_time(other, 5); EXCEPTION WHEN OTHERS THEN failures := failures || ('service role blocked: ' || SQLERRM); END;
  BEGIN UPDATE public.profiles SET role = 'user' WHERE id = me; EXCEPTION WHEN OTHERS THEN failures := failures || ('service role profile edit blocked: ' || SQLERRM); END;

  RAISE EXCEPTION 'LOCKDOWN TEST (rolled back): % failure(s)%', coalesce(array_length(failures, 1), 0),
    CASE WHEN coalesce(array_length(failures, 1), 0) = 0 THEN '' ELSE E'\n- ' || array_to_string(failures, E'\n- ') END;
END
$test$;
