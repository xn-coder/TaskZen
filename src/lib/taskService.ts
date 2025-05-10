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
  // created_by_profile is removed as direct join in realtime query was problematic
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
  // Ensure due_date is parsed correctly; if it's invalid, isBefore might behave unexpectedly or error.
  // A null due_date means it's not overdue by date.
  let dueDateValid = false;
  let parsedDueDate: Date | null = null;
  if (taskData.due_date) {
    try {
      parsedDueDate = parseISO(taskData.due_date);
      dueDateValid = !isNaN(parsedDueDate.getTime());
    } catch (e) {
      // console.warn(`Invalid due_date format for task ${taskData.id}: ${taskData.due_date}`);
      dueDateValid = false;
    }
  }
  
  const isOverdue = taskData.status !== 'Done' && dueDateValid && parsedDueDate && isBefore(parsedDueDate, now);


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
  
  // Fetch tasks without joining profiles directly in this main query, processTask will handle resolution
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

  const tasksPromises = tasksData.map(taskDoc => processTask(taskDoc as TaskRowWithPossibleProfile, profilesMap));
  return Promise.all(tasksPromises);
};


export const getDashboardTasks = async (userId: string): Promise<{ assignedTasks: Task[], createdTasks: Task[], overdueTasks: Task[] }> => {
  const allUserTasks = await getTasks(userId); 

  const assignedToUser = allUserTasks.filter(
    task => task.assignee_ids && 
            task.assignee_ids.includes(userId) &&
            task.created_by_id === userId && // Filter for tasks also created by the user
            task.status !== 'Done' && 
            task.status !== 'Overdue'
  );
  const createdByUser = allUserTasks.filter(
    task => task.created_by_id === userId && task.status !== 'Done' && task.status !== 'Overdue'
  );
  const overdueTasks = allUserTasks.filter(task => task.status === 'Overdue');
    
  return {
    assignedTasks: assignedToUser,
    createdTasks: createdByUser,
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
    comments: [] as Comment[], // Initialize with empty comments
  };

  const { data, error } = await supabase
    .from('tasks')
    .insert(payloadToInsert)
    .select() // Select all columns of the inserted row
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
      // This case should be less likely if .single() is used and insert is successful,
      // but it's a safeguard.
      console.error(logMessage, "No data returned after insert, and no explicit error object.");
    }
    throw new Error(error?.message || 'Failed to create task or retrieve it after creation.');
  }
  
  const profilesMap = await getAllProfilesMap();
  return processTask(data as TaskRowWithPossibleProfile, profilesMap); 
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
     // Ensure due_date is correctly formatted. If it's already a Date object, format it.
    // If it's a string, ensure it's valid ISO before attempting to re-format or use directly.
    try {
      updatePayload.due_date = formatISO(parseISO(taskUpdates.due_date));
    } catch(e) {
      console.warn(`Invalid due_date provided for update: ${taskUpdates.due_date}. Using original value or nulling if invalid.`);
      // Decide on fallback: use original string if Supabase can handle it, or nullify if it's truly bad
      updatePayload.due_date = taskUpdates.due_date; // Or null if it must be ISO
    }
  }
  
  if (newCommentText && newCommentText.trim() !== "" && currentUser && currentUser.id) {
    const newComment: Comment = {
      userId: currentUser.id,
      userName: currentUser.profile?.name || currentUser.email || "User", // Safely access profile name
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
    .select() // Select all columns after update
    .single();

  if (error) {
    console.error(`Error updating task ${taskId} in Supabase:`, error);
    throw error;
  }
  if (!updatedTaskData) {
      throw new Error("Failed to update task or retrieve it after update.");
  }
  const profilesMap = await getAllProfilesMap();
  return processTask(updatedTaskData as TaskRowWithPossibleProfile, profilesMap);
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
        .select(`*`) 
        .or(`created_by_id.eq.${userId},assignee_ids.cs.{${userId}}`)
        .order('created_at', { ascending: false });

      if (error) {
        let logMessage = `Error fetching tasks for real-time update for userId: ${userId}.`;
        let processedError: PostgrestError;

        if (typeof error === 'object' && error !== null && Object.keys(error).length === 0 && !(error as PostgrestError).message) {
          console.warn(`${logMessage} Received an empty error object from Supabase. Original error:`, error);
          processedError = {
            message: "An empty or unspecific error object was received from Supabase while fetching tasks.",
            code: "SUPABASE_EMPTY_ERROR",
            details: "The error object from Supabase lacked standard properties like 'message' or 'code'. This could indicate a network connectivity issue, a problem with Row Level Security (RLS) policies preventing data access, or an internal Supabase error.",
            hint: "Check your network connection, Supabase project status, and RLS policies for the 'tasks' table. Ensure the user has SELECT permissions."
          } as PostgrestError;
           console.error(logMessage, processedError.message, "Raw error:", error);
        } else if (error && typeof error === 'object' && 'message' in error) {
          const pgError = error as PostgrestError;
          console.error(
            logMessage,
            `Message: ${pgError.message || 'N/A'}, Code: ${pgError.code || 'N/A'}, Details: ${pgError.details || 'N/A'}, Hint: ${pgError.hint || 'N/A'}. Raw error:`,
            error // Log the original error object as well
          );
          processedError = pgError;
        } else {
          console.error(logMessage + " Encountered an unexpected error type:", error);
          processedError = {
            message: "An unexpected error occurred while fetching tasks.",
            code: "UNKNOWN_TASK_FETCH_ERROR",
            details: String(error), // Convert to string if not already
            hint: "Review console logs for more specific details."
          } as PostgrestError;
        }
        
        callback({ tasks: [], isLoading: false, error: processedError });
        return;
      }

      const processedTasks = await Promise.all(
        (tasksData || []).map(taskDoc => processTask(taskDoc as TaskRowWithPossibleProfile, profilesMap))
      );
      callback({ tasks: processedTasks, isLoading: false, error: null });
    } catch (e: any) {
      const logMessage = `Exception in fetchAndProcessTasks for userId: ${userId}.`;
      let processedError: PostgrestError;
      if (e && typeof e === 'object' && 'message' in e) {
         const pgError = e as PostgrestError;
         console.error(
          logMessage,
          `Message: ${pgError.message || 'N/A'}, Code: ${pgError.code || 'N/A'}, Details: ${pgError.details || 'N/A'}, Hint: ${pgError.hint || 'N/A'}. Raw error:`,
          e 
        );
        processedError = pgError;
      } else {
        console.error(logMessage, "Unknown error structure:", e);
        processedError = { 
            message: e.message || "Unknown exception occurred during task processing.", 
            code: "PROCESSING_EXCEPTION", 
            details: String(e), 
            hint: "Check console for details." 
        } as PostgrestError;
      }
      callback({ tasks: [], isLoading: false, error: processedError });
    }
  };

  fetchAndProcessTasks(); // Initial fetch

  channel = supabaseClient
    .channel(`public:tasks:user-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      (payload) => {
        // console.log('Realtime change received for tasks:', payload);
        fetchAndProcessTasks(); // Re-fetch and process on any change
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        // console.log(`User ${userId} subscribed to tasks realtime!`);
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`Realtime channel error for user ${userId}:`, status, err);
        let channelError : PostgrestError;
        if (err && typeof err === 'object' && 'message' in err) {
            channelError = err as PostgrestError;
        } else {
            channelError = {
                message: `Realtime channel ${status}`,
                code: status,
                details: err ? String(err) : "No specific error details from channel.",
                hint: "Check network or Supabase realtime status."
            } as PostgrestError;
        }
        callback({ tasks: [], isLoading: false, error: channelError});
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
