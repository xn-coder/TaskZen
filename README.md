
# TaskZen - Powered by Supabase & Next.js

This is a Next.js starter application for TaskZen, a task management tool, using Supabase for its backend.

To get started, take a look at `src/app/page.tsx`.

## Environment Setup

This application uses Supabase for its backend. To run the application locally, you need to set up Supabase environment variables.

1.  **Create a `.env.local` file** in the root directory of your project.
2.  **Add your Supabase project configuration** to this file. It should look like this:

    ```env
    NEXT_PUBLIC_SUPABASE_URL="YOUR_SUPABASE_URL"
    NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
    ```

    Replace `"YOUR_SUPABASE_URL"` and `"YOUR_SUPABASE_ANON_KEY"` with your actual Supabase project's API URL and anon (public) key.

    **How to find your Supabase project configuration:**
    *   Go to your [Supabase Dashboard](https://app.supabase.io).
    *   Select your project (or create one if you haven't).
    *   In the project sidebar, navigate to **Project Settings** (the gear icon).
    *   Under **API**, you will find your **Project URL** (this is `NEXT_PUBLIC_SUPABASE_URL`) and the **Project API keys** section. Use the `anon` `public` key for `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
    *   **Important:** Ensure these variables start with `NEXT_PUBLIC_` to be accessible on the client-side by Next.js.

3.  **Restart your development server** if it's already running for the changes to take effect (`npm run dev` or `yarn dev`).

With these variables set, the application should be able to connect to your Supabase project.

## Database Setup (Supabase - PostgreSQL)

This application uses Supabase's PostgreSQL database to store user profiles and tasks. You'll need to run SQL migrations to set up the tables and Row Level Security (RLS) policies.

### Migrations

The necessary SQL migration files are located in the `supabase/migrations` directory.

1.  **Using Supabase CLI (Recommended for local development & CI/CD):**
    *   Install the Supabase CLI: `npm install supabase --save-dev` (or globally).
    *   Link your local project to your Supabase project: `npx supabase login`, then `npx supabase link --project-ref YOUR_PROJECT_REF`. Find `YOUR_PROJECT_REF` in your Supabase project's dashboard URL (e.g., `https://app.supabase.io/project/YOUR_PROJECT_REF`).
    *   Apply migrations: `npx supabase db push`.

2.  **Manual Setup via Supabase Dashboard (Alternative):**
    *   Go to your [Supabase Dashboard](https://app.supabase.io) and select your project.
    *   Navigate to the **SQL Editor** in the sidebar.
    *   Click **+ New query**.
    *   Open each SQL file from the `supabase/migrations` directory in your project (e.g., `0000_create_profiles_table.sql`, `0001_create_tasks_table.sql`).
    *   Copy the entire content of one SQL file.
    *   Paste the copied SQL into the Supabase SQL editor and click **RUN**.
    *   Repeat for all migration files in chronological order.

### Included Migration Files:

*   **`supabase/migrations/0000_create_profiles_table.sql`**: Sets up the `profiles` table to store user-specific information.
*   **`supabase/migrations/0001_create_tasks_table.sql`**: Sets up the `tasks` table for task management.
*   **(Future migrations for comments, etc., would go here)**

### Data Structure (Defined by Migrations)

*   **`profiles` table:**
    *   `id` (uuid, primary key, references `auth.users.id`)
    *   `name` (text)
    *   `email` (text, unique)
    *   `avatar_url` (text, nullable)
    *   `created_at` (timestamptz, default `now()`)
    *   `updated_at` (timestamptz, default `now()`)
*   **`tasks` table:**
    *   `id` (uuid, primary key, default `gen_random_uuid()`)
    *   `title` (text, not null)
    *   `description` (text)
    *   `due_date` (timestamptz)
    *   `priority` (text, e.g., "Low", "Medium", "High", not null)
    *   `status` (text, e.g., "To Do", "In Progress", "Done", not null)
    *   `assignee_ids` (array of uuid, nullable)
    *   `created_by_id` (uuid, not null, references `auth.users.id`)
    *   `created_at` (timestamptz, default `now()`)
    *   `updated_at` (timestamptz, default `now()`)
    *   `comments` (jsonb, nullable, default `'[]'::jsonb`)

### Row Level Security (RLS)

RLS policies are defined within the migration SQL files. They ensure that users can only access and modify data they are permitted to. For example:
*   Users can read their own profile and insert their own profile.
*   Users can update their own profile.
*   Users can create tasks.
*   Users can read tasks they created or are assigned to.
*   Users can update tasks based on their role (creator or assignee).
*   Only creators can delete tasks.

**Make sure RLS is enabled for your tables in the Supabase dashboard (Authentication > Policies).** The migrations should enable them, but it's good to verify.

## Authentication

Supabase Authentication is used for user sign-up and login. Email/password authentication is enabled by default.

### Customizing Supabase Email Templates

Supabase allows you to customize authentication emails (like confirmation, password reset) in your Supabase project dashboard:

1.  Go to your [Supabase Dashboard](https://app.supabase.io/).
2.  Select your project.
3.  Navigate to **Authentication** (under the Auth section in the sidebar), then go to the **Templates** tab.
4.  You can edit the email templates here. They use Liquid templating. For instance, to include the user's email, you might use `{{ .Email }}`. To use user metadata like `name` (which we store in the `profiles` table and can be synced to `auth.users.user_metadata`), you might use `{{ .UserMetaData.name }}`.
    *   Example in the "Confirm signup" template:
        ```html
        <h2>Confirm your signup</h2>

        <p>Hello {{ .UserMetaData.name | default: .Email }},</p> <!-- Use name if available, else email -->

        <p>Follow this link to confirm your user:</p>
        <p><a href="{{ .ConfirmationURL }}">Confirm your mail</a></p>
        ```
    Make sure your application provides the `name` in the `options.data` field during `supabase.auth.signUp()` if you want to use it directly in the `user_metadata` for email templates. The current `register` function in `src/lib/auth.ts` does this.

By following these setup steps, your Next.js application should be correctly configured to use Supabase for authentication and its database.
