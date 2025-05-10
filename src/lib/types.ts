
export interface Profile {
  id: string; // Firebase UID
  name: string;
  email: string; 
  avatar_url?: string;
}

export type TaskStatus = "To Do" | "In Progress" | "Done" | "Overdue";
export type TaskPriority = "Low" | "Medium" | "High";

export interface Task {
  id: string; // Firestore document ID
  title: string;
  description: string;
  due_date: string; // ISO string (converted from/to Firebase Timestamp)
  priority: TaskPriority;
  status: TaskStatus; // "Overdue" is client-calculated. Firestore stores "To Do", "In Progress", "Done"
  assignee_ids: string[]; // Array of Firebase UIDs, FK to profiles.id (conceptually)
  assignees: Profile[] | null; 
  created_by_id: string; // Firebase UID, FK to profiles.id (conceptually)
  created_by?: Profile; 
  created_at: string; // ISO string (converted from Firebase Timestamp)
  updated_at: string; // ISO string (converted from Firebase Timestamp)
}

