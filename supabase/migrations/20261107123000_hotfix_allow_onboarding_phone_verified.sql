-- Hotfix: onboarding marks phone_verified on the user's own profile after the in-browser phone
-- check, so protecting that column blocked new users from finishing onboarding.
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
       OR NEW.is_vpn IS TRUE
       OR NEW.signup_ip IS NOT NULL
       OR NEW.ip_location IS NOT NULL THEN
      RAISE EXCEPTION 'Protected profile fields can only be set by the server' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.permissions IS DISTINCT FROM OLD.permissions
     OR NEW.is_vpn IS DISTINCT FROM OLD.is_vpn
     OR NEW.signup_ip IS DISTINCT FROM OLD.signup_ip
     OR NEW.ip_location IS DISTINCT FROM OLD.ip_location THEN
    RAISE EXCEPTION 'Protected profile fields can only be changed by an admin' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;
