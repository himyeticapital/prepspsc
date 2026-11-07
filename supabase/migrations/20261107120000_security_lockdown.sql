-- Security lockdown (2026-11-07)
--
-- Fixes found by the Supabase security advisor and a manual review:
--   1. 40 elevated (SECURITY DEFINER) functions could be called by anyone holding the public
--      anon key, and none of them checked who was calling.
--        a. Server-only functions: now callable by the service role only.
--        b. Functions the app calls as the signed-in user: no anonymous access, plus a caller
--           check so a user can only act as themselves. Study minutes must be 0-1440.
--   2. Signed-in users could edit protected columns on their own profile (e.g. role = 'admin').
--   3. Anyone could insert room notifications for any user.
--
-- Test: tests/rls/security-lockdown.test.sql (always rolls back; "0 failure(s)" = pass).

-- 1a. Server-only functions (service role, cron routes, triggers, or unused) ------------------
REVOKE EXECUTE ON FUNCTION
  public.award_xp(uuid, integer, text, text),
  public.check_api_quota(uuid),
  public.check_buddy_match(),
  public.cleanup_expired_bot_registrations(),
  public.create_api_key_for_developer(uuid, text, text),
  public.get_api_leaderboard(uuid, integer, text),
  public.get_api_user_analytics(uuid, text),
  public.get_room_online_count(bigint),
  public.get_table_member_count(bigint),
  public.get_unread_notification_count(uuid),
  public.get_user_table(uuid, bigint),
  public.grant_permission(uuid, text, uuid),
  public.handle_new_user(),
  public.has_permission(uuid, text),
  public.increment_api_usage(uuid),
  public.is_user_banned(uuid, bigint),
  public.kick_from_table(uuid, uuid),
  public.leave_room_presence(uuid, bigint),
  public.mark_room_notifications_read(uuid, bigint),
  public.reset_broken_streaks(),
  public.reset_monthly_streak_shields(),
  public.revoke_permission(uuid, text, uuid),
  public.search_pyq_by_topic(text, text[], text[], integer),
  public.search_pyq_semantic(extensions.vector, text, text[], double precision, integer, uuid[], integer),
  public.search_rooms(text, uuid),
  public.sync_preparing_for_from_study_plan(),
  public.trigger_plan_generation(uuid),
  public.update_room_presence(uuid, bigint, text),
  public.use_streak_shield(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.award_xp(uuid, integer, text, text),
  public.check_api_quota(uuid),
  public.check_buddy_match(),
  public.cleanup_expired_bot_registrations(),
  public.create_api_key_for_developer(uuid, text, text),
  public.get_api_leaderboard(uuid, integer, text),
  public.get_api_user_analytics(uuid, text),
  public.get_room_online_count(bigint),
  public.get_table_member_count(bigint),
  public.get_unread_notification_count(uuid),
  public.get_user_table(uuid, bigint),
  public.grant_permission(uuid, text, uuid),
  public.handle_new_user(),
  public.has_permission(uuid, text),
  public.increment_api_usage(uuid),
  public.is_user_banned(uuid, bigint),
  public.kick_from_table(uuid, uuid),
  public.leave_room_presence(uuid, bigint),
  public.mark_room_notifications_read(uuid, bigint),
  public.reset_broken_streaks(),
  public.reset_monthly_streak_shields(),
  public.revoke_permission(uuid, text, uuid),
  public.search_pyq_by_topic(text, text[], text[], integer),
  public.search_pyq_semantic(extensions.vector, text, text[], double precision, integer, uuid[], integer),
  public.search_rooms(text, uuid),
  public.sync_preparing_for_from_study_plan(),
  public.trigger_plan_generation(uuid),
  public.update_room_presence(uuid, bigint, text),
  public.use_streak_shield(uuid)
TO service_role;

-- 1b. Functions the app calls as the signed-in user -------------------------------------------
REVOKE EXECUTE ON FUNCTION
  public.ban_user_from_room(uuid, uuid, bigint, text, integer),
  public.calculate_streak(uuid),
  public.create_study_table(bigint, text, uuid),
  public.get_active_status_notes(uuid[]),
  public.get_buddy_candidates(uuid, integer),
  public.get_buddy_candidates(uuid, integer, text),
  public.increment_study_time(uuid, integer),
  public.join_table(uuid, bigint),
  public.leave_table(uuid),
  public.log_study_time(uuid, integer),
  public.unban_user_from_room(uuid, uuid, bigint)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.ban_user_from_room(uuid, uuid, bigint, text, integer),
  public.calculate_streak(uuid),
  public.create_study_table(bigint, text, uuid),
  public.get_active_status_notes(uuid[]),
  public.get_buddy_candidates(uuid, integer),
  public.get_buddy_candidates(uuid, integer, text),
  public.increment_study_time(uuid, integer),
  public.join_table(uuid, bigint),
  public.leave_table(uuid),
  public.log_study_time(uuid, integer),
  public.unban_user_from_room(uuid, uuid, bigint)
TO authenticated, service_role;

-- 1c. Caller check: the user (or admin) id argument must be the signed-in user. ----------------
-- Inserted right after each function's BEGIN, so the rest of the body is untouched.
-- Requests made with the service role key, cron routes and direct database access are trusted.
DO $guard$
DECLARE
  spec record;
  def text;
  new_def text;
  guard text;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('public.increment_study_time(uuid,integer)'::regprocedure, 1, 2),
      ('public.log_study_time(uuid,integer)'::regprocedure, 1, 2),
      ('public.calculate_streak(uuid)'::regprocedure, 1, NULL::integer),
      ('public.get_buddy_candidates(uuid,integer)'::regprocedure, 1, NULL),
      ('public.get_buddy_candidates(uuid,integer,text)'::regprocedure, 1, NULL),
      ('public.create_study_table(bigint,text,uuid)'::regprocedure, 3, NULL),
      ('public.join_table(uuid,bigint)'::regprocedure, 1, NULL),
      ('public.leave_table(uuid)'::regprocedure, 1, NULL),
      ('public.ban_user_from_room(uuid,uuid,bigint,text,integer)'::regprocedure, 1, NULL),
      ('public.unban_user_from_room(uuid,uuid,bigint)'::regprocedure, 1, NULL)
    ) AS t(fn, user_arg, minutes_arg)
  LOOP
    def := pg_get_functiondef(spec.fn);
    CONTINUE WHEN def LIKE '%caller_guard%';  -- already applied

    IF regexp_instr(def, '\mbegin\M', 1, 1, 0, 'i') < strpos(def, '$function$') THEN
      RAISE EXCEPTION 'Unexpected function layout for %', spec.fn;
    END IF;

    guard := format($g$
  -- caller_guard: signed-in users may only act as themselves
  IF coalesce(auth.jwt() ->> 'role', '') IN ('anon', 'authenticated') AND $%1$s IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
$g$, spec.user_arg);

    IF spec.minutes_arg IS NOT NULL THEN
      guard := guard || format($g$  IF coalesce(auth.jwt() ->> 'role', '') IN ('anon', 'authenticated') AND ($%1$s IS NULL OR $%1$s < 0 OR $%1$s > 1440) THEN
    RAISE EXCEPTION 'Study minutes must be between 0 and 1440' USING ERRCODE = '22023';
  END IF;
$g$, spec.minutes_arg);
    END IF;

    new_def := regexp_replace(def, '\m(begin)\M', '\1' || guard, 'i');
    IF new_def = def OR strpos(new_def, 'caller_guard') = 0 THEN
      RAISE EXCEPTION 'Could not add caller check to %', spec.fn;
    END IF;
    EXECUTE new_def;
  END LOOP;
END
$guard$;

-- 2. Protected profile columns ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  -- Only API users (anon / signed-in) are restricted. Sign-up (auth system), server code using
  -- the service role key, and admins can still set these columns.
  IF coalesce(auth.jwt() ->> 'role', '') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'user'
       OR coalesce(cardinality(NEW.permissions), 0) > 0
       OR NEW.phone_verified IS TRUE
       OR NEW.is_vpn IS TRUE
       OR NEW.signup_ip IS NOT NULL
       OR NEW.ip_location IS NOT NULL THEN
      RAISE EXCEPTION 'Protected profile fields can only be set by the server' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.permissions IS DISTINCT FROM OLD.permissions
     OR NEW.phone_verified IS DISTINCT FROM OLD.phone_verified
     OR NEW.is_vpn IS DISTINCT FROM OLD.is_vpn
     OR NEW.signup_ip IS DISTINCT FROM OLD.signup_ip
     OR NEW.ip_location IS DISTINCT FROM OLD.ip_location THEN
    RAISE EXCEPTION 'Protected profile fields can only be changed by an admin' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER protect_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- 3. Room notifications: only the room's owner/creator or an admin can notify other users --------
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.room_notifications;
DROP POLICY IF EXISTS "Room owners and admins can notify members" ON public.room_notifications;
CREATE POLICY "Room owners and admins can notify members" ON public.room_notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.rooms r
            WHERE r.id = room_notifications.room_id
              AND (r.owner_id = auth.uid() OR r.created_by = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
