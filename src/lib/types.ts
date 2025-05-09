
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string; // URL to avatar image
}

export type TaskStatus = "To Do" | "In Progress" | "Done" | "Overdue";
export type TaskPriority = "Low" | "Medium" | "High";

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string; // ISO string
  priority: TaskPriority;
  status: TaskStatus;
  assigneeId?: string; // Store assignee ID
  assignee?: User; // Optional: denormalized user object for display
  createdById: string; // Store creator ID
  createdBy?: User; // Optional: denormalized user object for display
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}
