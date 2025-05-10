
import { supabase } from './supabaseClient';
import type { Task, Profile, TaskStatus, Comment } from './types';
import type { AppUser } from './auth';
import type { SupabaseClient, RealtimeChannel, PostgrestError } from '@supabase/supabase-js';
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

type TaskRowWithPossibleProfile = Partial<Database['public']['Tables']['tasks']['Row']> & { 
  id: string; 
  created_by_profile?: Profile | null 
};


export const processTask = async (
    taskDataFromDb: TaskRowWithPossibleProfile, 
    profilesMap: Map<string, Profile>
  ): Promise<Task> => {
  
  if (!taskDataFromDb || !taskDataFromDb.id) {
    // console.error("processTask: Task data is invalid or missing ID.", taskDataFromDb);
    throw new Error(`Task data is invalid or missing ID.`);
  }

  const taskData = processTimestampsInDoc(taskDataFromDb);
  
  const now = new Date();
  const dueDate = taskData.due_date ? parseISO(taskData.due_date) : new Date(0); 
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
  
  const createdByProfile = taskData.created_by_profile || (taskData.created_by_id ? profilesMap.get(taskData.created_by_id) : null);

  const sortedComments = (taskData.comments || []).sort((a: Comment, b: Comment) => 
    parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()
  );

  return {
    id: taskData.id!,
    title: taskData.title || 'Untitled Task',
    description: taskData.description || null,
    due_date: taskData.due_date || null,
    priority: (taskData.priority as TaskPriority) || 'Medium',
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
  
  const payloadToInsert: Omit<Database['public']['Tables']['tasks']['Insert'], 'id' | 'created_at' | 'updated_at' | 'comments'> & {comments?: any} = {
    title: taskData.title,
    description: taskData.description || null,
    due_date: taskData.due_date ? parseISO(taskData.due_date).toISOString() : null,
    priority: taskData.priority,
    status: taskData.status, // This is Exclude<TaskStatus, "Overdue">
    assignee_ids: taskData.assignee_ids || null,
    created_by_id: taskData.created_by_id,
    comments: [] as Comment[],
  };

  const { data, error } = await supabase
    .from('tasks')
    .insert(payloadToInsert)
    .select()
    .single();

  if (error || !data) {
    const logMessage = "Error adding task to Supabase:";
    if (error) {
      console.error(logMessage, error);
      // Check if the error is a PostgrestError for more details
      if (typeof error === 'object' && 'message' in error) {
        const pgError = error as PostgrestError;
        throw new Error(`Failed to create task: ${pgError.message} (Code: ${pgError.code})`);
      } else {
        throw new Error('Failed to create task due to an unknown error.');
      }
    } else {
      console.error(logMessage, "No data returned after insert, and no explicit error object.");
    }
    throw new Error(error?.message || 'Failed to create task or retrieve it after creation.');
  }
  
  const profilesMap = await getAllProfilesMap();
  return processTask(data, profilesMap); 
};


type TaskUpdatePayload = Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'assignees' | 'created_by'>>;

export const updateTask = async (
  taskId: string,
  taskUpdates: TaskUpdatePayload,
  newCommentText?: string,
  currentUser?: AppUser | null 
): Promise<Task> => {
  
  const updatePayload: any = { ...taskUpdates };
  delete updatePayload.id; 

  if (taskUpdates.due_date) {
    updatePayload.due_date = parseISO(taskUpdates.due_date).toISOString();
  }
  
  if (newCommentText && newCommentText.trim() !== "" && currentUser && currentUser.id && currentUser.profile) {
    const newComment: Comment = {
      userId: currentUser.id,
      userName: currentUser.profile.name || currentUser.email || "User",
      text: newCommentText.trim(),
      createdAt: new Date().toISOString(),
    };
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
  
  updatePayload.updated_at = new Date().toISOString(); 

  const { data: updatedTaskData, error } = await supabase
    .from('tasks')
    .update(updatePayload)
    .eq('id', taskId)
    .select(`
      *,
      created_by_profile:profiles!created_by_id (id, name, email, avatar_url)
    `)
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


export const onTasksUpdate = (
  userId: string,
  callback: (data: { tasks: Task[]; isLoading: boolean; error?: PostgrestError | null }) => void,
  supabaseClient: SupabaseClient<Database>
): (() => void) => {
  
  if (typeof callback !== 'function') {
    console.error("onTasksUpdate: Callback is not a function.");
    return () => {}; 
  }
  
  callback({ tasks: [], isLoading: true, error: null });
  let channel: RealtimeChannel | null = null;

  const fetchAndProcessTasks = async () => {
    try {
      const profilesMap = await getAllProfilesMap();
      
      const { data: tasksData, error } = await supabaseClient
        .from('tasks')
        .select(`
          *,
          created_by_profile:profiles!created_by_id(id, name, email, avatar_url)
        `)
        .or(`created_by_id.eq.${userId},assignee_ids.cs.{${userId}}`)
        .order('created_at', { ascending: false });

      if (error) {
        let logMessage = `Error fetching tasks for real-time update for userId: ${userId}.`;
        console.error(logMessage, error); // Log the error object itself
        callback({ tasks: [], isLoading: false, error });
        return;
      }

      const processedTasks = await Promise.all(
        (tasksData || []).map(taskDoc => processTask(taskDoc as TaskRowWithPossibleProfile, profilesMap))
      );
      callback({ tasks: processedTasks, isLoading: false, error: null });
    } catch (e: any) {
      const logMessage = `Exception in fetchAndProcessTasks for userId: ${userId}.`;
      if (e && typeof e === 'object' && 'message' in e) {
         const pgError = e as PostgrestError;
         console.error(
          logMessage,
          `Message: ${pgError.message || 'N/A'}, Code: ${pgError.code || 'N/A'}, Details: ${pgError.details || 'N/A'}, Hint: ${pgError.hint || 'N/A'}. Raw error:`,
          e 
        );
        callback({ tasks: [], isLoading: false, error: pgError });
      } else {
        console.error(logMessage, "Unknown error structure:", e);
        callback({ tasks: [], isLoading: false, error: { message: "Unknown error occurred", code: "UNKNOWN", details: "", hint: "" } as PostgrestError });
      }
    }
  };

  fetchAndProcessTasks();

  channel = supabaseClient
    .channel(`public:tasks:user-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      (payload) => {
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
  
  return () => {
    if (channel) {
      supabaseClient.removeChannel(channel)
        .then(() => { /* console.log(`Unsubscribed from tasks channel for user ${userId}`) */ })
        .catch(err => console.error(`Error unsubscribing from tasks channel for user ${userId}:`, err));
      channel = null;
    }
  };
};

import type { Database } from '@/lib/types/supabase';

