-- Private profile fields, part 1 of 2 (2026-11-07)
--
-- Phone numbers and signup IP data lived on `profiles`, which every signed-in user can read.
-- They move to `profile_private`: a user can read their own row and set their own phone number;
-- admins can read every row; IP data is written only by the server (service role).
--
-- Part 1 is additive and safe with the currently deployed app. Part 2 (after the app update is
-- live) copies anything written in between and drops the old columns from `profiles`.
-- Test: tests/rls/private-profile.test.sql

CREATE TABLE IF NOT EXISTS public.profile_private (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone_number text,
  signup_ip text,
  ip_location text,
  is_vpn boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own private profile" ON public.profile_private;
CREATE POLICY "Users read own private profile" ON public.profile_private
  FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "Admins read private profiles" ON public.profile_private;
CREATE POLICY "Admins read private profiles" ON public.profile_private
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Users add own private profile" ON public.profile_private;
CREATE POLICY "Users add own private profile" ON public.profile_private
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users update own private profile" ON public.profile_private;
CREATE POLICY "Users update own private profile" ON public.profile_private
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Users may only ever write their phone number; IP data is server-only.
REVOKE ALL ON public.profile_private FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profile_private TO authenticated;
GRANT INSERT (id, phone_number), UPDATE (phone_number) ON public.profile_private TO authenticated;
GRANT ALL ON public.profile_private TO service_role;

-- Copy existing data
INSERT INTO public.profile_private (id, phone_number, signup_ip, ip_location, is_vpn)
SELECT id, phone_number, signup_ip, ip_location, coalesce(is_vpn, false)
FROM public.profiles
ON CONFLICT (id) DO NOTHING;

-- New sign-ups: create the private row too (profiles.phone_number is still written until part 2,
-- so the currently deployed app keeps working).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, username, is_pro_member, pro_expires_at, trial_ends_at, phone_number, phone_verified)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    split_part(new.email, '@', 1),
    true,
    (now() + interval '7 days'),
    (now() + interval '7 days'),
    new.raw_user_meta_data->>'phone_number',
    COALESCE((new.raw_user_meta_data->>'phone_verified')::boolean, false)
  );
  INSERT INTO public.profile_private (id, phone_number)
  VALUES (new.id, new.raw_user_meta_data->>'phone_number')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;
