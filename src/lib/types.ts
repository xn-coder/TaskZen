
export interface Profile {
  id: string; // Supabase auth.users.id (UUID)
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at?: string; // ISO string
  updated_at?: string; // ISO string
}

export type TaskStatus = "To Do" | "In Progress" | "Done" | "Overdue";
export type TaskPriority = "Low" | "Medium" | "High";

export interface Comment {
  userId: string; // Supabase auth.users.id (UUID)
  userName: string;
  text: string;
  createdAt: string; // ISO string
}

export interface Task {
  id: string; // Supabase table primary key (UUID)
  title: string;
  description: string | null;
  due_date: string | null; // ISO string
  priority: TaskPriority;
  status: TaskStatus; // "Overdue" is client-calculated. DB stores "To Do", "In Progress", "Done"
  assignee_ids: string[] | null; // Array of Supabase auth.users.id (UUIDs)
  assignees: Profile[] | null; // Populated client-side
  created_by_id: string; // Supabase auth.users.id (UUID)
  created_by?: Profile | null; // Populated client-side
  created_at: string; // ISO string
  updated_at: string; // ISO string
  comments: Comment[] | null; // Stored as JSONB in Supabase
}

// This type can be generated from your Supabase schema (e.g., using supabase gen types typescript)
// For now, we'll manually define a placeholder.
// Create a types/supabase.ts file and run `npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/types/supabase.ts`
// Then import it in supabaseClient.ts
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile; // Tabledatal
        Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at'> & { id: string }; // For inserts
        Update: Partial<Omit<Profile, 'id' | 'created_at'>> & { updated_at?: string }; // For updates
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          due_date: string | null;
          priority: TaskPriority;
          status: "To Do" | "In Progress" | "Done"; // DB status, "Overdue" is client-calculated
          assignee_ids: string[] | null;
          created_by_id: string;
          created_at: string;
          updated_at: string;
          comments: Comment[] | null;
        };
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'id' | 'created_at' | 'updated_at'> & {
            id?: string; // Optional for insert if db generates it
            comments?: Comment[]; // Can be optional on insert
        };
        Update: Partial<Omit<Database['public']['Tables']['tasks']['Row'], 'id' | 'created_at'>> & { updated_at?: string };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
  };
}
