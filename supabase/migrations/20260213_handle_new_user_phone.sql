-- Update handle_new_user to carry phone_number and phone_verified from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
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
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
