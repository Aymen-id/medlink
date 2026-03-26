-- Migration: Add Postgres trigger to atomically create doctor_profiles on auth signup
-- This eliminates the race condition where a user could be created without a profile.

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  unique_slug TEXT;
  display TEXT;
BEGIN
  -- Extract display_name from raw_user_meta_data, fallback to email prefix
  display := COALESCE(
    NEW.raw_user_meta_data ->> 'display_name',
    split_part(NEW.email, '@', 1)
  );

  -- Generate a URL-safe slug from the display name
  base_slug := lower(regexp_replace(display, '[^a-z0-9]+', '-', 'gi'));
  base_slug := trim(both '-' from base_slug);

  -- Append random suffix for uniqueness
  unique_slug := base_slug || '-' || floor(random() * 10000)::text;

  -- Insert the doctor profile, ignoring conflicts (idempotent)
  INSERT INTO public.doctor_profiles (id, user_id, slug, display_name)
  VALUES (NEW.id, NEW.id, unique_slug, display)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
