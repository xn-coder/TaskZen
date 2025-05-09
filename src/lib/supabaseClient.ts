import { createClient } from '@supabase/supabase-js';

// For Next.js, NEXT_PUBLIC_ variables are inlined at build time for client-side bundles
// and are also available in the server-side environment.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // This error will be thrown if the environment variables are not set.
  // The user needs to create a .env.local file with these variables.
  console.error('Error: Missing Supabase URL or Anon Key. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file. Refer to README.md for setup instructions.');
  throw new Error('Missing Supabase URL or Anon Key. Check console for details and README.md for setup instructions.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
