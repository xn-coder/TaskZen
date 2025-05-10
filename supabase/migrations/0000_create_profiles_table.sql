-- Create the profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile."
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Function to automatically update `updated_at` timestamp
CREATE OR REPLACE FUNCTION public.handle_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update `updated_at` on profile update
CREATE TRIGGER on_profile_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_profile_updated_at();

-- Function to copy auth.users data to public.profiles on new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call handle_new_user on new user signup in auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- Allow authenticated users to read their own user data from auth.users (optional, if needed directly)
-- THIS IS USUALLY HANDLED BY SUPABASE HELPERS, BUT GOOD TO BE AWARE OF
-- CREATE POLICY "Authenticated users can read their own auth.users entry."
--   ON auth.users FOR SELECT
--   USING (auth.uid() = id);

-- Create a function to get a user's profile
CREATE OR REPLACE FUNCTION get_user_profile(user_id UUID)
RETURNS SETOF public.profiles AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.profiles WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
