-- Fix Google OAuth avatar not being captured
-- Google stores profile picture in 'picture' field, not 'avatar_url'

-- Update the handle_new_user function to check both fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, username)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    -- Check both 'avatar_url' (Supabase default) and 'picture' (Google OAuth)
    COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    split_part(new.email, '@', 1)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: This only affects NEW users. Existing users who signed up with Google
-- and have NULL avatar_url will need to complete onboarding to select an avatar.
