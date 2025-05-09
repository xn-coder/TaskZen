
import type { TaskStatus, TaskPriority } from './types';

export const APP_NAME = "TaskZen";

// Selectable statuses during task creation/editing
export const TASK_EDITABLE_STATUSES: Exclude<TaskStatus, "Overdue">[] = ["To Do", "In Progress", "Done"];
export const TASK_PRIORITIES: TaskPriority[] = ["Low", "Medium", "High"];

// All possible statuses for filtering (includes derived "Overdue")
export const TASK_FILTERABLE_STATUSES: TaskStatus[] = ["To Do", "In Progress", "Done", "Overdue"];
