
# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Environment Setup

This application uses Supabase for its backend. To run the application locally, you need to set up Supabase environment variables.

1.  **Create a `.env.local` file** in the root directory of your project.
2.  **Add your Supabase credentials** to this file:

    ```env
    NEXT_PUBLIC_SUPABASE_URL="YOUR_SUPABASE_URL"
    NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
    ```

    Replace `"YOUR_SUPABASE_URL"` and `"YOUR_SUPABASE_ANON_KEY"` with your actual Supabase project URL and anon key. You can find these in your Supabase project settings (Project Settings > API).

    **Important:** Ensure these variables start with `NEXT_PUBLIC_` to be accessible on the client-side by Next.js.

3.  **Restart your development server** if it's already running for the changes to take effect.

With these variables set, the application should be able to connect to your Supabase instance.

## Database Setup

This application requires certain database tables and configurations to be present in your Supabase project.

### Initial Schema (Profiles Table and Tasks Table)

If you are setting up the project for the first time, or if you encounter errors related to missing tables, such as:
- `"relation 'public.profiles' does not exist"`
- `"relation 'public.tasks' does not exist"`
you need to apply the initial database schema.

The SQL for this is located in:
- `supabase/migrations/0001_setup_profiles.sql` (for user profiles)
- `supabase/migrations/0002_setup_tasks.sql` (for tasks)

**How to apply SQL migrations:**

1.  Navigate to your Supabase project dashboard.
2.  Go to the **SQL Editor** section (usually found in the sidebar).
3.  Click on **+ New query**.
4.  Open the respective `.sql` migration file from the `supabase/migrations` directory in your project:
    *   First, run `0001_setup_profiles.sql`.
    *   Then, run `0002_setup_tasks.sql`.
5.  Copy the entire content of the SQL file.
6.  Paste the copied SQL into the Supabase SQL editor.
7.  Click **RUN**.
8.  Repeat for any other necessary migration files in their numerical order.

**The `0001_setup_profiles.sql` script will:**
*   Create the `profiles` table, which stores user profile information linked to `auth.users`.
*   Set up Row Level Security (RLS) policies for the `profiles` table, allowing users to manage their own profiles and making profiles publicly readable.
*   Create a database trigger that automatically creates a new profile entry in `public.profiles` whenever a new user signs up via `auth.users`. This trigger attempts to populate the `name` and `avatar_url` from the `raw_user_meta_data` provided during sign-up.

**The `0002_setup_tasks.sql` script will:**
*   Create the `tasks` table for managing tasks.
*   Define necessary columns like `title`, `description`, `due_date`, `priority`, `status`, `assignee_id`, `created_by_id`.
*   Set up foreign key relationships to the `profiles` table.
*   Implement Row Level Security (RLS) policies for tasks, ensuring users can only access and modify tasks they are authorized to.
*   Create a trigger to automatically update the `updated_at` timestamp for tasks.

**Note for existing users:** If you had users in your `auth.users` table *before* applying the `0001_setup_profiles.sql` script, their profiles will not be automatically created by the trigger for those pre-existing users. You may need to manually create profile entries for them or write a separate script to backfill this data. For new sign-ups *after* the script is run, profiles will be created automatically.
Ensure these migrations are run in order to avoid foreign key constraint errors.
