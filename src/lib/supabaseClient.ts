import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase'; // Assuming you will create this type definition

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = `Supabase client initialization failed: Missing Supabase URL or Anon Key. 
Please ensure these variables are correctly set in your .env.local file, which must be located in the root directory of your project (same level as package.json).
VERY IMPORTANT: You MUST restart your Next.js development server (e.g., stop the 'npm run dev' command and run it again) after creating or modifying the .env.local file for the changes to take effect.
Double-check the variable names and their values. Refer to the README.md file for detailed setup instructions.
Supabase services will not be available until this is resolved.`;
  console.error(errorMessage);
  if (typeof window !== 'undefined') {
    // Potentially show an error to the user in the UI or throw to stop execution on client-side
  } else {
    // For server-side, throwing an error might be appropriate to halt problematic startup
    throw new Error(errorMessage);
  }
  // Fallback to a dummy client if critical errors should not halt the app entirely (e.g. for specific pages not needing Supabase)
  // However, for this app, Supabase is critical.
}

export const supabase = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
