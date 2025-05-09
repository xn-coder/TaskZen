
export interface Profile { // Renamed from User for clarity with Supabase
  id: string; // UUID, matches Supabase auth user ID
  name: string;
  email: string; // Denormalized from auth.users for convenience
  avatar_url?: string; // Optional avatar URL from Supabase storage or user_metadata
}

export type TaskStatus = "To Do" | "In Progress" | "Done" | "Overdue";
export type TaskPriority = "Low" | "Medium" | "High";

export interface Task {
  id: string; // UUID from Supabase
  title: string;
  description: string;
  due_date: string; // ISO string (Supabase timestamptz)
  priority: TaskPriority;
  status: TaskStatus; // "Overdue" is client-calculated. DB stores "To Do", "In Progress", "Done"
  assignee_id?: string | null; // UUID, FK to profiles.id
  assignee?: Profile | null; // Optional: denormalized profile object for display
  created_by_id: string; // UUID, FK to profiles.id
  created_by?: Profile; // Optional: denormalized profile object for display
  created_at: string; // ISO string (Supabase timestamptz)
  updated_at: string; // ISO string (Supabase timestamptz)
}
