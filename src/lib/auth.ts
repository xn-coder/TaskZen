
import { supabase } from './supabaseClient';
import type { Profile } from './types';
import type { User as SupabaseAuthUser, AuthError, SignUpWithPasswordCredentials } from '@supabase/supabase-js';

export interface AppUser extends SupabaseAuthUser {
  profile: Profile | null;
}

// Fetches both Supabase auth user and their public profile
async function fetchUserWithProfile(authUser: SupabaseAuthUser | null): Promise<AppUser | null> {
  if (!authUser) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (profileError && profileError.code !== 'PGRST116') { // PGRST116: single row not found (e.g. profile doesn't exist)
    const userIdForLog = authUser.id || 'unknown user';
    if (profileError.code === '42P01') { // Specific code for "undefined_table" or "relation does not exist"
      console.error(`Error fetching profile for user ${userIdForLog}: The 'profiles' table does not exist. Code: ${profileError.code}, Message: ${profileError.message}. Please ensure the 'profiles' table is created in your database. Check migrations or Supabase SQL Editor. Full error:`, profileError);
    } else if (typeof profileError === 'object' && profileError !== null && Object.keys(profileError).length === 0) {
      // Log a more generic message for an empty error object, but mention it might be RLS/table/network
      console.error(`Error fetching profile for user ${userIdForLog}: Received an empty error object {}. This could indicate a problem with RLS policies on the 'profiles' table, the table might not exist, or a network issue. Supabase error code: ${profileError.code || 'N/A'}, Message: ${profileError.message || 'N/A'}`);
    } else if (typeof profileError === 'object' && profileError !== null) {
      console.error(`Error fetching profile for user ${userIdForLog}: Code: ${profileError.code || 'N/A'}, Message: ${profileError.message || 'N/A'}. Full error:`, profileError);
    } else {
      // Handle cases where profileError might not be a standard Supabase error object
      console.error(`Error fetching profile for user ${userIdForLog}: Non-object error:`, profileError);
    }
    // On any significant error fetching profile, return user with profile as null for graceful degradation.
    return { ...authUser, profile: null };
  }
  
  // If profileError is null, or if it's PGRST116 (profile not found),
  // then `profile` from `data` will be the profile object or null respectively.
  // Supabase's .single() method with PGRST116 means `data` (profile) will be null.
  return { ...authUser, profile: profile as Profile | null };
}


export const getCurrentUser = async (): Promise<AppUser | null> => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error('Error getting session:', sessionError);
    return null;
  }
  if (!session?.user) return null;
  return fetchUserWithProfile(session.user);
};

export const login = async (email: string, password: string): Promise<AppUser> => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error("Login failed, no user data returned.");
  
  const userWithProfile = await fetchUserWithProfile(data.user);
  if (!userWithProfile) throw new Error("Login successful but failed to fetch profile.");
  // It's possible userWithProfile.profile is null if fetchUserWithProfile encountered an issue or profile doesn't exist.
  // The caller should handle cases where userWithProfile.profile might be null.
  return userWithProfile;
};

export const register = async (name: string, email: string, password: string): Promise<AppUser> => {
  const credentials: SignUpWithPasswordCredentials = {
    email,
    password,
    options: {
      data: {
        name: name, // Store name in user_metadata, will be used to create profile by server-side trigger
      }
    }
  };
  
  const { data: authData, error: signUpError } = await supabase.auth.signUp(credentials);

  if (signUpError) throw signUpError;
  if (!authData.user) throw new Error("Registration failed, no user data returned.");

  // Client-side profile insertion is now primarily handled by the server-side trigger 'on_auth_user_created'.
  // The trigger uses 'name' and 'avatar_url' (if provided) from authData.user.raw_user_meta_data.
  // We still fetch the userWithProfile to return it, which will reflect the profile created by the trigger.
  
  const userWithProfile = await fetchUserWithProfile(authData.user);
   if (!userWithProfile) throw new Error("Registration successful but failed to fetch profile post-creation attempt.");
  // As with login, userWithProfile.profile could be null if the trigger failed or there's a replication delay.
  return userWithProfile;
};

export const logout = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// Listen to auth state changes
export const onAuthStateChange = (callback: (user: AppUser | null) => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      const userWithProfile = await fetchUserWithProfile(session.user);
      callback(userWithProfile);
    } else {
      callback(null);
    }
  });
  return () => subscription?.unsubscribe();
};

