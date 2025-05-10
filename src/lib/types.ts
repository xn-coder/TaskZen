
export interface Profile {
  id: string; // Firebase UID
  name: string;
  email: string; 
  avatar_url?: string;
}

export type TaskStatus = "To Do" | "In Progress" | "Done" | "Overdue";
export type TaskPriority = "Low" | "Medium" | "High";

export interface Comment {
  userId: string;
  userName: string;
  text: string;
  createdAt: string; // ISO string
}

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
  comments: Comment[] | null;
}

// This type represents the data structure in Firestore before processing (e.g., Timestamps not converted)
export interface TaskDocumentData {
  title: string;
  description: string;
  due_date: firebase.firestore.Timestamp;
  priority: TaskPriority;
  status: Exclude<TaskStatus, "Overdue">;
  assignee_ids: string[];
  created_by_id: string;
  created_at: firebase.firestore.Timestamp;
  updated_at: firebase.firestore.Timestamp;
  comments: Comment[]; // In Firestore, comments will have `createdAt` as Timestamp if serverTimestamp() is used, or string if client-generated.
}
