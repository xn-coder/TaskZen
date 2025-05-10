
import { supabase } from './supabaseClient';
import type { Profile } from './types';
import type { User as SupabaseUser, AuthError, Session } from '@supabase/supabase-js';
import { APP_NAME } from './constants';

export interface AppUser extends SupabaseUser {
  profile: Profile | null;
}

// Fetches Supabase auth user and their profile from 'profiles' table
async function fetchUserWithProfile(authUser: SupabaseUser | null): Promise<AppUser | null> {
  if (!authUser) return null;

  try {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116: single row not found (profile might not exist yet)
      const userIdForLog = authUser.id || 'unknown user';
      if (profileError.code === '42P01') { // Specific code for "undefined_table" or "relation does not exist"
        console.error(`Error fetching profile for user ${userIdForLog}: The 'profiles' table does not exist. Code: ${profileError.code}, Message: ${profileError.message}. Please ensure the 'profiles' table is created in your database. Check migrations or Supabase SQL Editor. Full error:`, profileError);
      } else if (typeof profileError === 'object' && profileError !== null && Object.keys(profileError).length === 0) {
        console.error(`Error fetching profile for user ${userIdForLog}: Received an empty error object {}. This could indicate a problem with RLS policies on the 'profiles' table, the table might not exist, or a network issue. Supabase error code: ${profileError.code || 'N/A'}, Message: ${profileError.message || 'N/A'}`);
      } else if (typeof profileError === 'object' && profileError !== null) {
        console.error(`Error fetching profile for user ${userIdForLog}: Code: ${profileError.code || 'N/A'}, Message: ${profileError.message || 'N/A'}. Full error:`, profileError);
      } else {
        console.error(`Error fetching profile for user ${userIdForLog}: Non-object error:`, profileError);
      }
      // Return authUser with null profile to indicate issue but still provide auth info
      return { ...authUser, profile: null };
    }
    
    const profile = profileData ? {
        id: profileData.id,
        name: profileData.name || null,
        email: profileData.email || null, // email from profiles table might be redundant if authUser.email is primary
        avatar_url: profileData.avatar_url || null,
        created_at: profileData.created_at,
        updated_at: profileData.updated_at,
    } : null;

    return { ...authUser, profile };

  } catch (error) {
    console.error(`Unexpected error in fetchUserWithProfile for user ${authUser.id}:`, error);
    return { ...authUser, profile: null }; // Fallback
  }
}


export const getCurrentUser = async (): Promise<AppUser | null> => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error("Error getting session:", sessionError);
    return null;
  }
  if (!session || !session.user) return null;
  return fetchUserWithProfile(session.user);
};

export const login = async (email: string, password: string): Promise<AppUser> => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("Supabase login error:", error);
    if (error.message.includes("Invalid login credentials")) {
        throw new Error("Invalid email or password. Please try again.");
    }
    throw new Error(error.message || "An unknown login error occurred.");
  }
  if (!data.user) throw new Error("Login successful but no user data received.");
  
  const appUser = await fetchUserWithProfile(data.user);
  if (!appUser) throw new Error("Login successful but failed to process user data.");
  return appUser;
};

export const register = async (name: string, email: string, password: string): Promise<AppUser> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { // This data is stored in auth.users.raw_user_meta_data
        name: name,
      },
      // Supabase sends a confirmation email by default.
      // Customize email template in Supabase Dashboard: Authentication > Email Templates
      // The link will point to SITE_URL (set in Supabase Auth settings) + #confirmation_token=TOKEN
      // You need to handle this flow on the client-side.
      emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });

  if (error) {
    console.error("Supabase registration error:", error);
    if (error.message.includes("User already registered")) {
        throw new Error("This email address is already registered. Please try to log in.");
    }
    throw new Error(error.message || "An unknown registration error occurred.");
  }
  if (!data.user) throw new Error("Registration successful but no user data received.");

  // The profiles table should be populated by the trigger `on_auth_user_created`
  // We wait a bit to give the trigger time to run, then fetch the profile.
  // A more robust solution might involve polling or a serverless function if immediate profile is critical.
  await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay for trigger

  const appUser = await fetchUserWithProfile(data.user);

  // If profile still not found, it's an issue (trigger failed or RLS issue)
  if (!appUser || !appUser.profile) {
     console.warn(`User ${data.user.id} registered, but profile was not found immediately. The on_auth_user_created trigger might have issues or RLS policies are too restrictive.`);
     // Attempt to create profile manually as a fallback - this is not ideal and indicates trigger issues.
     // It requires user to have insert permission on profiles table directly after signup for their own ID.
     const { error: insertError } = await supabase.from('profiles').insert({
        id: data.user.id,
        name: name,
        email: data.user.email,
     });
     if (insertError) {
        console.error("Fallback profile insert failed:", insertError);
        // Proceed without profile, user might see a degraded experience until profile is sorted.
        return { ...data.user, profile: null };
     }
     // Re-fetch after manual insert
     const finalAppUser = await fetchUserWithProfile(data.user);
     if (!finalAppUser) throw new Error("Registration and fallback profile creation successful but failed to process user data.");
     return finalAppUser;
  }

  return appUser;
};

export const logout = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Supabase logout error:", error);
    throw new Error(error.message || "An unknown logout error occurred.");
  }
};

export const onAuthStateChangeCallback = (
  callback: (user: AppUser | null, session: Session | null) => void
): { unsubscribe: () => void } => {
  const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      const appUser = await fetchUserWithProfile(session.user);
      callback(appUser, session);
    } else if (event === 'SIGNED_OUT') {
      callback(null, null);
    } else if (event === 'USER_UPDATED' && session?.user) {
      const appUser = await fetchUserWithProfile(session.user);
      callback(appUser, session);
    } else if (event === 'PASSWORD_RECOVERY') {
      // Handle password recovery event, e.g. redirect to a password reset page
    } else if (session?.user) { // For other events like TOKEN_REFRESHED, if user exists
      const appUser = await fetchUserWithProfile(session.user);
      callback(appUser, session);
    } else { // If no session or user for other events
      callback(null, session);
    }
  });

  return { unsubscribe: authListener.subscription.unsubscribe };
};
