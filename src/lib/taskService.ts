
import { supabase } from './supabaseClient';
import type { Task, Profile, TaskStatus, Comment } from './types';
import type { AppUser } from './auth';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'; // Added RealtimeChannel
import { formatISO, parseISO, isBefore } from 'date-fns';

// Helper to convert Supabase timestamp strings (which should be ISO) to consistent ISO strings for dates if needed,
// though Supabase typically returns them as ISO strings already.
const processTimestampsInDoc = (docData: any): any => {
  const data = { ...docData };
  // Supabase returns ISO strings, so direct use is usually fine.
  // Conversion might be needed if manipulating Date objects.
  // For now, assume due_date, created_at, updated_at are valid ISO strings from Supabase.
  // Comments createdAt should also be an ISO string.
  if (data.comments && Array.isArray(data.comments)) {
    data.comments = data.comments.map((comment: any) => {
      if (comment.createdAt && typeof comment.createdAt === 'string') {
        try {
            parseISO(comment.createdAt); // Validate
            return comment;
        } catch (e) {
            return { ...comment, createdAt: new Date().toISOString() }; // Fallback
        }
      }
      return comment;
    });
  }
  return data;
};

export const processTask = async (
    taskDataFromDb: Partial<Database['public']['Tables']['tasks']['Row'] & { id: string }>, // Expect at least id
    profilesMap: Map<string, Profile>
  ): Promise<Task> => {
  
  if (!taskDataFromDb || !taskDataFromDb.id) {
    throw new Error(`Task data is invalid or missing ID.`);
  }

  const taskData = processTimestampsInDoc(taskDataFromDb);
  
  const now = new Date();
  // Ensure due_date is valid before parsing
  const dueDate = taskData.due_date ? parseISO(taskData.due_date) : new Date(0); // Treat null/undefined due_date as very past
  const isOverdue = taskData.status !== 'Done' && taskData.due_date && isBefore(dueDate, now);

  let assignees: Profile[] = [];
  if (taskData.assignee_ids && Array.isArray(taskData.assignee_ids)) {
    for (const assigneeId of taskData.assignee_ids) {
      const profile = profilesMap.get(assigneeId);
      if (profile) {
        assignees.push(profile);
      }
    }
  }
  
  const createdByProfile = taskData.created_by_id ? profilesMap.get(taskData.created_by_id) : null;

  const sortedComments = (taskData.comments || []).sort((a: Comment, b: Comment) => 
    parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()
  );

  return {
    id: taskData.id!,
    title: taskData.title || 'Untitled Task',
    description: taskData.description || null,
    due_date: taskData.due_date || null,
    priority: taskData.priority || 'Medium',
    status: isOverdue ? 'Overdue' : (taskData.status as TaskStatus) || 'To Do',
    assignee_ids: taskData.assignee_ids || [],
    assignees: assignees.length > 0 ? assignees : null, 
    created_by_id: taskData.created_by_id!,
    created_by: createdByProfile, 
    created_at: taskData.created_at || new Date().toISOString(),
    updated_at: taskData.updated_at || new Date().toISOString(),
    comments: sortedComments,
  } as Task;
};


export const getAllProfilesMap = async (): Promise<Map<string, Profile>> => {
  const profilesMap = new Map<string, Profile>();
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) {
    console.error('Error fetching profiles for map:', error);
    return profilesMap; // Return empty map on error
  }
  data?.forEach((profile) => {
    profilesMap.set(profile.id, profile as Profile);
  });
  return profilesMap;
};

export const getTasks = async (userId?: string): Promise<Task[]> => {
  const profilesMap = await getAllProfilesMap();
  
  let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });

  if (userId) {
    // Fetch tasks where user is creator OR an assignee
    // Supabase OR condition: .or(`created_by_id.eq.${userId},assignee_ids.cs.{${userId}}`)
    // cs.{value} checks if array contains value.
    query = query.or(`created_by_id.eq.${userId},assignee_ids.cs.{${userId}}`);
  }

  const { data: tasksData, error } = await query;

  if (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
  if (!tasksData) return [];

  const tasksPromises = tasksData.map(taskDoc => processTask(taskDoc, profilesMap));
  return Promise.all(tasksPromises);
};


export const getDashboardTasks = async (userId: string): Promise<{ assignedTasks: Task[], createdTasks: Task[], overdueTasks: Task[] }> => {
  const allUserTasks = await getTasks(userId); 

  const assignedTasks = allUserTasks.filter(
    task => task.assignee_ids && task.assignee_ids.includes(userId) && task.status !== 'Done' && task.status !== 'Overdue'
  );
  const createdTasks = allUserTasks.filter(
    task => task.created_by_id === userId && task.status !== 'Done' && task.status !== 'Overdue'
  );
  const overdueTasks = allUserTasks.filter(task => task.status === 'Overdue');
    
  return {
    assignedTasks,
    createdTasks,
    overdueTasks,
  };
};

export const addTask = async (
  taskData: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'status' | 'assignees' | 'created_by' | 'comments'> & { status: Exclude<TaskStatus, "Overdue">; created_by_id: string }
): Promise<Task> => {
  
  const payloadToInsert = {
    title: taskData.title,
    description: taskData.description || null,
    due_date: taskData.due_date ? parseISO(taskData.due_date).toISOString() : null, // Ensure ISO format
    priority: taskData.priority,
    status: taskData.status,
    assignee_ids: taskData.assignee_ids || null,
    created_by_id: taskData.created_by_id,
    comments: [], // Initialize with empty array for comments
    // created_at and updated_at will be set by default in DB
  };

  const { data: newTaskData, error } = await supabase
    .from('tasks')
    .insert(payloadToInsert)
    .select()
    .single(); // Assuming insert returns the created row

  if (error) {
    console.error("Error adding task to Supabase:", error);
    throw error;
  }
  if (!newTaskData) {
    throw new Error("Failed to create task: No data returned after insert.");
  }
  
  const profilesMap = await getAllProfilesMap();
  return processTask(newTaskData, profilesMap); 
};


type TaskUpdatePayload = Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'assignees' | 'created_by'>>;

export const updateTask = async (
  taskId: string,
  taskUpdates: TaskUpdatePayload,
  newCommentText?: string,
  currentUser?: AppUser | null 
): Promise<Task> => {
  
  const updatePayload: any = { ...taskUpdates };
  delete updatePayload.id; // Ensure id is not in payload for update

  if (taskUpdates.due_date) {
    updatePayload.due_date = parseISO(taskUpdates.due_date).toISOString();
  }
  
  // Handle comments
  if (newCommentText && newCommentText.trim() !== "" && currentUser && currentUser.id && currentUser.profile) {
    const newComment: Comment = {
      userId: currentUser.id,
      userName: currentUser.profile.name || currentUser.email || "User",
      text: newCommentText.trim(),
      createdAt: new Date().toISOString(),
    };
    // Fetch existing comments, append, then update
    const { data: existingTask, error: fetchError } = await supabase
      .from('tasks')
      .select('comments')
      .eq('id', taskId)
      .single();

    if (fetchError) {
      console.error(`Error fetching existing comments for task ${taskId}:`, fetchError);
      throw fetchError;
    }
    const existingComments = (existingTask?.comments as Comment[] || []);
    updatePayload.comments = [...existingComments, newComment];
  }
  
  updatePayload.updated_at = new Date().toISOString(); // Manually set updated_at for Supabase

  const { data: updatedTaskData, error } = await supabase
    .from('tasks')
    .update(updatePayload)
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error(`Error updating task ${taskId} in Supabase:`, error);
    throw error;
  }
  if (!updatedTaskData) {
      throw new Error("Failed to update task or retrieve it after update.");
  }
  const profilesMap = await getAllProfilesMap();
  return processTask(updatedTaskData, profilesMap);
};

export const deleteTask = async (taskId: string): Promise<void> => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) {
    console.error(`Error deleting task ${taskId} from Supabase:`, error);
    throw error;
  }
};

export const getProfilesForDropdown = async (): Promise<Profile[]> => {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) {
    console.error('Error fetching profiles for dropdown:', error);
    return [];
  }
  return (data || []) as Profile[];
};


// Realtime task updates using Supabase
export const onTasksUpdate = (
  userId: string,
  callback: (data: { tasks: Task[]; isLoading: boolean }) => void,
  supabaseClient: SupabaseClient<Database> // Pass the Supabase client instance
): (() => void) => { // Returns an unsubscribe function
  
  if (typeof callback !== 'function') {
    console.error("onTasksUpdate: Callback is not a function.");
    return () => {}; 
  }
  
  callback({ tasks: [], isLoading: true });
  let channel: RealtimeChannel | null = null;

  const fetchAndProcessTasks = async () => {
    try {
      // Re-fetch all tasks relevant to the user.
      // This could be optimized to fetch only changed tasks if Supabase Realtime payload provides enough info.
      const profilesMap = await getAllProfilesMap(); // Re-fetch profiles in case they changed
      
      const { data: tasksData, error } = await supabaseClient
        .from('tasks')
        .select('*')
        .or(`created_by_id.eq.${userId},assignee_ids.cs.{${userId}}`) // cs for array contains
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tasks for real-time update:', error);
        callback({ tasks: [], isLoading: false }); // Send empty on error, stop loading
        return;
      }

      const processedTasks = await Promise.all(
        (tasksData || []).map(taskDoc => processTask(taskDoc, profilesMap))
      );
      callback({ tasks: processedTasks, isLoading: false });
    } catch (e) {
      console.error('Exception in fetchAndProcessTasks:', e);
      callback({ tasks: [], isLoading: false });
    }
  };

  // Initial fetch
  fetchAndProcessTasks();

  // Set up Supabase Realtime channel
  channel = supabaseClient
    .channel(`public:tasks:user-${userId}`) // Unique channel name per user or general tasks
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks', 
        // Optional filter: filter for tasks where user is creator or assignee
        // This filter might be complex and better handled by re-fetching all relevant tasks on any change signal.
        // filter: `created_by_id=eq.${userId} OR assignee_ids=cs.{${userId}}`
      },
      (payload) => {
        // console.log('Supabase Realtime: Change received!', payload);
        // Re-fetch tasks when a change occurs.
        // This is simpler than trying to merge payload.new/old, especially with joins/processing.
        fetchAndProcessTasks();
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        // console.log(`User ${userId} subscribed to tasks realtime!`);
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`Realtime channel error for user ${userId}:`, status, err);
        // Optionally, try to resubscribe or notify user
      }
    });
  
  // Return unsubscribe function
  return () => {
    if (channel) {
      supabaseClient.removeChannel(channel)
        .then(() => { /* console.log(`Unsubscribed from tasks channel for user ${userId}`) */ })
        .catch(err => console.error(`Error unsubscribing from tasks channel for user ${userId}:`, err));
      channel = null;
    }
  };
};

// Import Database type from supabase.ts (generated types)
import type { Database } from '@/lib/types/supabase';
