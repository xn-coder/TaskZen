import { supabase } from './supabaseClient';
import type { Task, Profile, TaskStatus, Comment } from './types';
import type { AppUser } from './auth';
import type { SupabaseClient, RealtimeChannel, PostgrestError } from '@supabase/supabase-js';
import { formatISO, parseISO, isBefore } from 'date-fns';
import type { Database } from '@/lib/types/supabase'; // Ensure this path is correct

// Type for the JSONB comments column
type Json = Database['public']['']['']['']; // Adjusted to be more general if specific schema isn't known for comments only

// Represents the raw row from the 'tasks' table, possibly before profile data is joined/resolved.
type TaskRowWithPossibleProfile = Database['public']['Tables']['tasks']['Row'];


export const processTask = async (
    taskDataFromDb: TaskRowWithPossibleProfile, 
    profilesMap: Map<string, Profile>
  ): Promise<Task> => {
  
  if (!taskDataFromDb || !taskDataFromDb.id) {
    // console.error("processTask: Task data is invalid or missing ID.", taskDataFromDb);
    throw new Error(`Task data is invalid or missing ID.`);
  }
  
  const now = new Date();
  let dueDateValid = false;
  let parsedDueDate: Date | null = null;
  if (taskDataFromDb.due_date) {
    try {
      parsedDueDate = parseISO(taskDataFromDb.due_date);
      dueDateValid = !isNaN(parsedDueDate.getTime());
    } catch (e) {
      // console.warn(`Invalid due_date format for task ${taskDataFromDb.id}: ${taskDataFromDb.due_date}`);
      dueDateValid = false;
    }
  }
  
  const isOverdue = taskDataFromDb.status !== 'Done' && dueDateValid && parsedDueDate && isBefore(parsedDueDate, now);

  let assignees: Profile[] = [];
  if (taskDataFromDb.assignee_ids && Array.isArray(taskDataFromDb.assignee_ids)) {
    for (const assigneeId of taskDataFromDb.assignee_ids) {
      if (assigneeId) { // Ensure assigneeId is not null
        const profile = profilesMap.get(assigneeId);
        if (profile) {
          assignees.push(profile);
        }
      }
    }
  }
  
  const createdByProfile = taskDataFromDb.created_by_id ? profilesMap.get(taskDataFromDb.created_by_id) : null;

  const currentComments = (taskDataFromDb.comments as Comment[] | null) || [];
  const sortedComments = [...currentComments].sort((a: Comment, b: Comment) => {
    const dateA = a.createdAt ? parseISO(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? parseISO(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  return {
    id: taskDataFromDb.id!,
    title: taskDataFromDb.title || 'Untitled Task',
    description: taskDataFromDb.description || null,
    due_date: taskDataFromDb.due_date || null,
    priority: (taskDataFromDb.priority as TaskPriority) || 'Medium',
    status: isOverdue ? 'Overdue' : (taskDataFromDb.status as TaskStatus) || 'To Do',
    assignee_ids: taskDataFromDb.assignee_ids || [],
    assignees: assignees.length > 0 ? assignees : null, 
    created_by_id: taskDataFromDb.created_by_id!,
    created_by: createdByProfile, 
    created_at: taskDataFromDb.created_at || new Date().toISOString(),
    updated_at: taskDataFromDb.updated_at || new Date().toISOString(),
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

// Helper to fetch specific profiles by IDs
const getSpecificProfilesMap = async (profileIds: string[]): Promise<Map<string, Profile>> => {
  if (!profileIds || profileIds.length === 0) {
    return new Map();
  }
  const uniqueProfileIds = Array.from(new Set(profileIds.filter(id => id !== null))); // Filter out nulls before Set
  if (uniqueProfileIds.length === 0) {
    return new Map();
  }

  const profilesMap = new Map<string, Profile>();
  const { data, error } = await supabase.from('profiles').select('*').in('id', uniqueProfileIds);
  if (error) {
    console.error('Error fetching specific profiles for map:', error);
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
    // Ensure `assignee_ids` is the correct column name for an array of UUIDs.
    // The .cs operator means "contains" for arrays.
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
  taskData: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'status' | 'assignees' | 'created_by' | 'comments'> & { status: Exclude<TaskStatus, "Overdue">; created_by_id: string },
  currentUserProfile?: Profile | null
): Promise<Task> => {
  
  const payloadToInsert: Database['public']['Tables']['tasks']['Insert'] = {
    title: taskData.title,
    description: taskData.description || null,
    due_date: taskData.due_date ? parseISO(taskData.due_date).toISOString() : null,
    priority: taskData.priority,
    status: taskData.status,
    assignee_ids: taskData.assignee_ids, // taskData.assignee_ids is string[] due to form schema
    created_by_id: taskData.created_by_id,
    comments: [] as unknown as Json, 
  };

  const { data: insertedTaskData, error } = await supabase
    .from('tasks')
    .insert(payloadToInsert)
    .select()
    .single();

  if (error || !insertedTaskData) {
    const logMessage = "Error adding task to Supabase:";
    if (error) {
      console.error(logMessage, error);
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
  
  const profileIdsToFetch: string[] = [];
  if (insertedTaskData.created_by_id && (!currentUserProfile || currentUserProfile.id !== insertedTaskData.created_by_id)) {
    profileIdsToFetch.push(insertedTaskData.created_by_id);
  }
  if (insertedTaskData.assignee_ids && Array.isArray(insertedTaskData.assignee_ids)) {
    profileIdsToFetch.push(...insertedTaskData.assignee_ids.filter(id => id !== null) as string[]);
  }
  
  const profilesMap = await getSpecificProfilesMap(profileIdsToFetch);

  if (currentUserProfile) {
    profilesMap.set(currentUserProfile.id, currentUserProfile);
  }
  
  return processTask(insertedTaskData as TaskRowWithPossibleProfile, profilesMap); 
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
    try {
      updatePayload.due_date = formatISO(parseISO(taskUpdates.due_date));
    } catch(e) {
      console.warn(`Invalid due_date provided for update: ${taskUpdates.due_date}. Using original value or nulling if invalid.`);
      updatePayload.due_date = taskUpdates.due_date; 
    }
  }
  
  if (newCommentText && newCommentText.trim() !== "" && currentUser && currentUser.id) {
    const newComment: Comment = {
      userId: currentUser.id,
      userName: currentUser.profile?.name || currentUser.email || "User", 
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
    updatePayload.comments = [...existingComments, newComment] as unknown as Json;
  }
  
  updatePayload.updated_at = new Date().toISOString(); 

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
            error 
          );
          processedError = pgError;
        } else {
          console.error(logMessage + " Encountered an unexpected error type:", error);
          processedError = {
            message: "An unexpected error occurred while fetching tasks.",
            code: "UNKNOWN_TASK_FETCH_ERROR",
            details: String(error), 
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

  fetchAndProcessTasks(); 

  channel = supabaseClient
    .channel(`public:tasks:user-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      async (payload) => {
        console.log(`Realtime event for tasks received by user ${userId}:`, payload);
        await fetchAndProcessTasks(); 
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        // console.log(`User ${userId} subscribed to tasks realtime!`);
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        let channelError : PostgrestError;
        if (err && typeof err === 'object' && 'message' in err) {
            channelError = err as PostgrestError;
             console.error(`Realtime channel error for user ${userId}: Message: ${channelError.message}, Code: ${channelError.code}, Details: ${channelError.details}, Hint: ${channelError.hint}. Raw error:`, err);
        } else {
            channelError = {
                message: `Realtime channel ${status}`,
                code: status,
                details: err ? String(err) : "No specific error details from channel.",
                hint: "Check network or Supabase realtime status."
            } as PostgrestError;
            console.error(`Realtime channel error for user ${userId}:`, status, err, "(Processed as PostgrestError anaylogue)");
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