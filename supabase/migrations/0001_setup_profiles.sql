
-- Create the profiles table
create table public.profiles (
  id uuid not null references auth.users on delete cascade primary key,
  updated_at timestamp with time zone,
  name text,
  email text,
  avatar_url text
  -- constraint username_length check (char_length(username) >= 3) -- Example constraint
);

-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/auth/row-level-security for RLS examples
alter table public.profiles
  enable row level security;

create policy "Public profiles are viewable by everyone." on public.profiles
  for select using (true);

create policy "Users can insert their own profile." on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on public.profiles
  for update using (auth.uid() = id);

-- This trigger automatically creates a profile entry when a new user signs up via Supabase Auth.
-- See https://supabase.com/docs/guides/auth/managing-user-data#using-triggers for more details.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'name',
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Set up Storage!
-- Though not directly part of profiles table, avatars often use storage.
-- This is a placeholder for setting up a public bucket named 'avatars' if you plan to store avatars.
-- Make sure to configure RLS policies for storage as well.
-- Example: insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
-- create policy "Avatar images are publicly accessible." on storage.objects for select using ( bucket_id = 'avatars' );
-- create policy "Anyone can upload an avatar." on storage.objects for insert with check ( bucket_id = 'avatars' );
-- create policy "Users can update their own avatars." on storage.objects for update using (auth.uid() = owner) with check (bucket_id = 'avatars');
-- create policy "Users can delete their own avatars." on storage.objects for delete using (auth.uid() = owner) and (bucket_id = 'avatars');
