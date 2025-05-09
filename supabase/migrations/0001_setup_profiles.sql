
-- 1. Create the 'profiles' table
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT,
  email TEXT UNIQUE, -- Denormalized from auth.users for convenience and uniqueness if needed
  avatar_url TEXT   -- URL to the user's avatar image
);

COMMENT ON TABLE public.profiles IS 'Stores public profile information for each user.';
COMMENT ON COLUMN public.profiles.id IS 'References the internal Supabase auth user ID.';
COMMENT ON COLUMN public.profiles.email IS 'User''s email, denormalized from auth.users.';

-- 2. Enable Row Level Security (RLS) for the 'profiles' table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies for 'profiles'
-- Policy: Public profiles are viewable by everyone.
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING (true);

-- Policy: Users can insert their own profile.
-- Note: This is mainly a fallback; the trigger 'on_auth_user_created' handles initial profile creation.
CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy: Users can update their own profile.
CREATE POLICY "Users can update their own profile."
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Users can delete their own profile (optional, uncomment if needed).
-- CREATE POLICY "Users can delete their own profile."
--   ON public.profiles FOR DELETE
--   USING (auth.uid() = id);

-- 4. Create a function to handle new user sign-ups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public -- Important for security definer functions
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name', -- Assumes 'name' is passed in options.data during supabase.auth.signUp
    NEW.email,                       -- Directly from auth.users
    NEW.raw_user_meta_data->>'avatar_url' -- Assumes 'avatar_url' might be passed in options.data
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 'Creates a profile entry when a new user signs up in auth.users.';

-- 5. Create a trigger to execute the function on new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'When a new user is created in auth.users, automatically create a corresponding profile in public.profiles.';

-- Grant usage on the public schema to authenticated users to allow trigger function to work
-- This is typically default, but explicitly stating for clarity if needed.
-- GRANT USAGE ON SCHEMA public TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
-- The RLS policies above will govern what authenticated users can actually do.
