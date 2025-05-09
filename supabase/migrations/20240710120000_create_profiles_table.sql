
-- Create the 'profiles' table
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments to the table and columns for clarity
COMMENT ON TABLE public.profiles IS 'Stores public profile information for users.';
COMMENT ON COLUMN public.profiles.id IS 'References the internal Supabase auth user id.';
COMMENT ON COLUMN public.profiles.name IS 'User''s full name or display name.';
COMMENT ON COLUMN public.profiles.email IS 'User''s email, denormalized for easy access and should be unique.';
COMMENT ON COLUMN public.profiles.avatar_url IS 'URL to the user''s avatar image.';

-- Enable Row Level Security (RLS) for the 'profiles' table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow public read access to all profiles
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING (true);

-- RLS Policy: Allow users to insert their own profile
-- This uses auth.uid() to ensure the user ID matches the authenticated user.
CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policy: Allow users to update their own profile
CREATE POLICY "Users can update their own profile."
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- (Optional: Users can delete their own profile - uncomment if needed)
-- CREATE POLICY "Users can delete their own profile."
--   ON public.profiles FOR DELETE
--   USING (auth.uid() = id);


-- Create a trigger function to automatically update the 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply the trigger to the 'profiles' table for UPDATE operations
CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- Create a trigger function to automatically create a profile entry when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name', -- Assumes 'name' is in user_metadata from signUp options
    NEW.email,                      -- Email from the auth.users table
    NEW.raw_user_meta_data->>'avatar_url' -- Assumes 'avatar_url' might be in user_metadata
  )
  ON CONFLICT (id) DO NOTHING; -- If client-side already inserted profile, do nothing
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply the trigger to the 'auth.users' table for INSERT operations (new user sign-ups)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Note: The `handle_new_user` trigger relies on `name` (and optionally `avatar_url`)
-- being present in `raw_user_meta_data` during `supabase.auth.signUp`.
-- The `src/lib/auth.ts` `register` function includes `name` in `options.data`.
-- This server-side trigger ensures profile creation even if client-side logic is bypassed or fails.
-- It's a robust way to link `auth.users` with `public.profiles`.
