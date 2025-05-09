import { supabase } from './supabaseClient';
import type { Task, Profile, TaskStatus } from './types';
import { formatISO, parseISO, isBefore } from 'date-fns';

// Helper to resolve "Overdue" status and denormalize tasks
const processTask = (task: any, profiles: Profile[]): Task => {
  const now = new Date();
  const dueDate = parseISO(task.due_date);
  const isOverdue = task.status !== 'Done' && isBefore(dueDate, now);
  
  const assignee = task.assignee_id ? profiles.find(p => p.id === task.assignee_id) : null;
  const createdBy = profiles.find(p => p.id === task.created_by_id);

  return {
    ...task,
    due_date: task.due_date, // keep as ISO string from DB
    status: isOverdue ? 'Overdue' : task.status,
    assignee: assignee || null,
    created_by: createdBy,
    created_at: task.created_at,
    updated_at: task.updated_at,
  } as Task;
};

// Fetch all profiles to help with denormalization
// In a larger app, you might fetch only necessary profiles or optimize this.
const getAllProfiles = async (): Promise<Profile[]> => {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) {
    console.error('Error fetching profiles:', error);
    return [];
  }
  return data as Profile[];
};

export const getTasks = async (userId?: string): Promise<Task[]> => {
  // Fetch all profiles first
  const profiles = await getAllProfiles();

  let query = supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });

  // If userId is provided, you might filter tasks related to this user (e.g., created_by_id or assignee_id)
  // For now, fetches all tasks as per previous mock behavior for all tasks page.
  // Dashboard page will need specific filtering logic for "assigned to me" or "created by me".

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
  return data.map(task => processTask(task, profiles));
};


export const getDashboardTasks = async (userId: string): Promise<{assignedTasks: Task[], createdTasks: Task[], overdueTasks: Task[]}> => {
  const profiles = await getAllProfiles();

  // Tasks assigned to user
  const { data: assigned, error: assignedError } = await supabase
    .from('tasks')
    .select('*')
    .eq('assignee_id', userId)
    .neq('status', 'Done') // Exclude 'Done' tasks
    .order('due_date', { ascending: true });
  
  if (assignedError) console.error('Error fetching assigned tasks:', assignedError);

  // Tasks created by user
  const { data: created, error: createdError } = await supabase
    .from('tasks')
    .select('*')
    .eq('created_by_id', userId)
    .neq('status', 'Done') // Exclude 'Done' tasks
    .order('due_date', { ascending: true });

  if (createdError) console.error('Error fetching created tasks:', createdError);

  const assignedTasks = (assigned || []).map(task => processTask(task, profiles));
  const createdTasks = (created || []).map(task => processTask(task, profiles));
  
  const overdueTasks = [...assignedTasks, ...createdTasks].filter(task => task.status === 'Overdue')
    // Remove duplicates if a task is both assigned and created by the user and overdue
    .filter((task, index, self) => index === self.findIndex((t) => t.id === task.id));

  return { 
    assignedTasks: assignedTasks.filter(t => t.status !== 'Overdue'), // Dashboard sections show non-overdue separately
    createdTasks: createdTasks.filter(t => t.status !== 'Overdue'), 
    overdueTasks 
  };
};


export const addTask = async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'status' | 'assignee' | 'created_by'> & { status: Exclude<TaskStatus, "Overdue"> }): Promise<Task> => {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      ...taskData,
      due_date: taskData.due_date, // Ensure it's ISO string
    })
    .select()
    .single();

  if (error) throw error;
  
  const profiles = await getAllProfiles(); // For processing the newly added task
  return processTask(data, profiles);
};

export const updateTask = async (taskId: string, taskData: Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'assignee' | 'created_by'>>): Promise<Task> => {
  // If status is being updated and it's "Overdue", it should be a valid DB status.
  // The "Overdue" status is purely for display and client-side calculation.
  const updatePayload = { ...taskData };
  if (updatePayload.status === 'Overdue') {
    // Determine what the actual DB status should be if it was marked "Overdue" by client logic
    // This might mean reverting to its previous non-overdue status or a default like "To Do"
    // For simplicity, we'll assume forms don't submit "Overdue" directly.
    // If they do, we need a strategy, e.g., fetch current task and see if due_date < now.
    // For now, we rely on TaskForm not setting status to 'Overdue'.
  }


  const { data, error } = await supabase
    .from('tasks')
    .update({
      ...updatePayload,
      updated_at: new Date().toISOString(), // Manually set updated_at
    })
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  
  const profiles = await getAllProfiles();
  return processTask(data, profiles);
};

export const deleteTask = async (taskId: string): Promise<void> => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) throw error;
};

export const getProfilesForDropdown = async (): Promise<Profile[]> => {
  return getAllProfiles();
};
