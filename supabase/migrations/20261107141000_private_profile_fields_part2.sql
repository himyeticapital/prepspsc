-- Private profile fields, part 2 of 2 (2026-11-07)
-- Run only after the app version that reads/writes `profile_private` is live.

-- Catch anything the previous app version wrote to `profiles` after part 1 ran.
INSERT INTO public.profile_private (id, phone_number, signup_ip, ip_location, is_vpn)
SELECT id, phone_number, signup_ip, ip_location, coalesce(is_vpn, false)
FROM public.profiles
ON CONFLICT (id) DO UPDATE SET
  phone_number = coalesce(public.profile_private.phone_number, EXCLUDED.phone_number),
  signup_ip    = coalesce(public.profile_private.signup_ip, EXCLUDED.signup_ip),
  ip_location  = coalesce(public.profile_private.ip_location, EXCLUDED.ip_location),
  is_vpn       = public.profile_private.is_vpn OR EXCLUDED.is_vpn;

-- Sign-up no longer writes the phone number to the public table.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, username, is_pro_member, pro_expires_at, trial_ends_at, phone_verified)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    split_part(new.email, '@', 1),
    true,
    (now() + interval '7 days'),
    (now() + interval '7 days'),
    COALESCE((new.raw_user_meta_data->>'phone_verified')::boolean, false)
  );
  INSERT INTO public.profile_private (id, phone_number)
  VALUES (new.id, new.raw_user_meta_data->>'phone_number')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;

-- The profile guard no longer needs to watch columns that are leaving `profiles`.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'user' OR coalesce(cardinality(NEW.permissions), 0) > 0 THEN
      RAISE EXCEPTION 'Protected profile fields can only be set by the server' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.role IS DISTINCT FROM OLD.role OR NEW.permissions IS DISTINCT FROM OLD.permissions THEN
    RAISE EXCEPTION 'Protected profile fields can only be changed by an admin' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS phone_number,
  DROP COLUMN IF EXISTS signup_ip,
  DROP COLUMN IF EXISTS ip_location,
  DROP COLUMN IF EXISTS is_vpn;
