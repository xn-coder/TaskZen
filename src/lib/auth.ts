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

  if (profileError && profileError.code !== 'PGRST116') { // PGRST116: single row not found
    console.error('Error fetching profile:', profileError);
    // Decide if you want to return user without profile or null
    // For now, return authUser with null profile to indicate issue
    return { ...authUser, profile: null };
  }
  
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
  
  return userWithProfile;
};

export const register = async (name: string, email: string, password: string): Promise<AppUser> => {
  const credentials: SignUpWithPasswordCredentials = {
    email,
    password,
    options: {
      data: {
        name: name, // Store name in user_metadata, will be used to create profile
      }
    }
  };
  
  const { data: authData, error: signUpError } = await supabase.auth.signUp(credentials);

  if (signUpError) throw signUpError;
  if (!authData.user) throw new Error("Registration failed, no user data returned.");

  // Create a profile entry. This could also be done via a Supabase Function trigger.
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ 
      id: authData.user.id, 
      name: name, 
      email: authData.user.email,
      // avatar_url: `https://picsum.photos/seed/${encodeURIComponent(authData.user.email || authData.user.id)}/40/40` // Example
    });

  if (profileError) {
    // If profile creation fails, we might want to clean up the auth user or handle this state
    console.error("User registered but profile creation failed:", profileError);
    // For now, proceed but this is a potential inconsistency
    // throw new Error(`User registered but profile creation failed: ${profileError.message}`);
  }
  
  const userWithProfile = await fetchUserWithProfile(authData.user);
   if (!userWithProfile) throw new Error("Registration successful but failed to fetch profile post-creation.");

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
