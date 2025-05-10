
import { db } from './firebase';
import type { Task, Profile, TaskStatus } from './types';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  Timestamp,
  serverTimestamp,
  onSnapshot,
  QueryDocumentSnapshot,
  DocumentSnapshot, // Import DocumentSnapshot
} from 'firebase/firestore';
import { formatISO, parseISO, isBefore } from 'date-fns';

// Helper to convert Firebase Timestamps to ISO strings for dates
const processTimestampsInDoc = (docData: any) => {
  const data = { ...docData };
  if (data.due_date && data.due_date instanceof Timestamp) {
    data.due_date = formatISO(data.due_date.toDate());
  }
  if (data.created_at && data.created_at instanceof Timestamp) {
    data.created_at = formatISO(data.created_at.toDate());
  }
  if (data.updated_at && data.updated_at instanceof Timestamp) {
    data.updated_at = formatISO(data.updated_at.toDate());
  }
  return data;
};

// processTask can accept DocumentSnapshot as QueryDocumentSnapshot is a DocumentSnapshot
// and it only uses .id and .data() which are available after an exists() check.
const processTask = async (taskDocSnap: DocumentSnapshot, profilesMap: Map<string, Profile>): Promise<Task> => {
  if (!taskDocSnap.exists()) {
    // This path should ideally not be hit if callers check .exists() first
    throw new Error(`Task document with ID ${taskDocSnap.id} does not exist.`);
  }
  const taskData = processTimestampsInDoc({ id: taskDocSnap.id, ...taskDocSnap.data()! }); // Added '!' as exists is true
  
  const now = new Date();
  const dueDate = taskData.due_date ? parseISO(taskData.due_date) : new Date(0); 
  const isOverdue = taskData.status !== 'Done' && isBefore(dueDate, now);

  let assignees: Profile[] = [];
  if (taskData.assignee_ids && Array.isArray(taskData.assignee_ids)) {
    for (const assigneeId of taskData.assignee_ids) {
      const profile = profilesMap.get(assigneeId);
      if (profile) {
        assignees.push(profile);
      }
    }
  }
  const createdByProfile = taskData.created_by_id ? profilesMap.get(taskData.created_by_id) : undefined;

  return {
    ...taskData,
    status: isOverdue ? 'Overdue' : taskData.status,
    assignee_ids: taskData.assignee_ids || [],
    assignees: assignees.length > 0 ? assignees : null, // Keep as null if no assignees resolved
    created_by: createdByProfile, // Keep as undefined if no creator profile resolved
  } as Task;
};

const getAllProfilesMap = async (): Promise<Map<string, Profile>> => {
  const profilesMap = new Map<string, Profile>();
  try {
    const profilesCollection = collection(db, 'profiles');
    const q = query(profilesCollection);
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((docSnap) => {
      profilesMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Profile);
    });
  } catch (error) {
    console.error('Error fetching profiles for map:', error);
  }
  return profilesMap;
};


export const getTasks = async (userId?: string): Promise<Task[]> => {
  const profilesMap = await getAllProfilesMap();
  const tasksCollection = collection(db, 'tasks');
  
  let q;
  if (userId) {
    const createdQuery = query(tasksCollection, where('created_by_id', '==', userId), orderBy('created_at', 'desc'));
    const assignedQuery = query(tasksCollection, where('assignee_ids', 'array-contains', userId), orderBy('created_at', 'desc'));
    
    const [createdSnapshot, assignedSnapshot] = await Promise.all([
        getDocs(createdQuery),
        getDocs(assignedQuery)
    ]);

    const taskMap = new Map<string, QueryDocumentSnapshot>();
    createdSnapshot.forEach(docSnap => taskMap.set(docSnap.id, docSnap));
    assignedSnapshot.forEach(docSnap => taskMap.set(docSnap.id, docSnap)); 

    const tasksPromises = Array.from(taskMap.values()).map(docSnap => processTask(docSnap, profilesMap));
    return Promise.all(tasksPromises);

  } else {
    q = query(tasksCollection, orderBy('created_at', 'desc'));
    const querySnapshot = await getDocs(q);
    const tasksPromises = querySnapshot.docs.map(docSnap => processTask(docSnap, profilesMap));
    return Promise.all(tasksPromises);
  }
};

export const getDashboardTasks = async (userId: string): Promise<{ assignedTasks: Task[], createdTasks: Task[], overdueTasks: Task[] }> => {
  const allUserTasks = await getTasks(userId); 

  const assignedTasks = allUserTasks.filter(
    task => task.assignee_ids.includes(userId) && task.status !== 'Done' && task.status !== 'Overdue'
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

export const addTask = async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'status' | 'assignees' | 'created_by'> & { status: Exclude<TaskStatus, "Overdue"> }): Promise<Task> => {
  const tasksCollection = collection(db, 'tasks');
  const payload = {
    ...taskData,
    due_date: taskData.due_date ? Timestamp.fromDate(parseISO(taskData.due_date)) : Timestamp.now(),
    description: taskData.description || "", 
    assignee_ids: taskData.assignee_ids || [],
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(tasksCollection, payload);
    const newDocSnap = await getDoc(docRef);

    if (!newDocSnap.exists()) {
      // This case should be rare if addDoc was successful, but good to handle.
      console.error(`Failed to retrieve document (ID: ${docRef.id}) immediately after creation.`);
      throw new Error("Failed to create task: Could not retrieve task data post-creation.");
    }
    
    const profilesMap = await getAllProfilesMap();
    // newDocSnap is a DocumentSnapshot here. processTask can handle it if .exists() is true.
    // The cast 'as QueryDocumentSnapshot' is for properties like .exists being typed as true,
    // which is fine after checking newDocSnap.exists().
    return processTask(newDocSnap as QueryDocumentSnapshot, profilesMap); 
  } catch (error) {
    console.error("Error adding task to Firestore:", error);
    throw error;
  }
};

export const updateTask = async (taskId: string, taskData: Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'assignees' | 'created_by'>>): Promise<Task> => {
  const taskDocRef = doc(db, 'tasks', taskId);
  
  const updatePayload: any = { ...taskData, updated_at: serverTimestamp() };
  if (taskData.due_date && typeof taskData.due_date === 'string') { 
    updatePayload.due_date = Timestamp.fromDate(parseISO(taskData.due_date));
  }
  if (taskData.hasOwnProperty('description') && taskData.description === undefined) {
    updatePayload.description = ""; 
  }
  if (taskData.hasOwnProperty('assignee_ids')) {
     updatePayload.assignee_ids = taskData.assignee_ids || [];
  }

  try {
    await updateDoc(taskDocRef, updatePayload);
    const updatedDocSnap = await getDoc(taskDocRef);
     if (!updatedDocSnap.exists()) {
        throw new Error("Failed to update task or retrieve it after update.");
    }
    const profilesMap = await getAllProfilesMap();
    return processTask(updatedDocSnap as QueryDocumentSnapshot, profilesMap);
  } catch (error) {
    console.error(`Error updating task ${taskId} in Firestore:`, error);
    throw error;
  }
};

export const deleteTask = async (taskId: string): Promise<void> => {
  const taskDocRef = doc(db, 'tasks', taskId);
  try {
    await deleteDoc(taskDocRef);
  } catch (error) {
    console.error(`Error deleting task ${taskId} from Firestore:`, error);
    throw error;
  }
};

export const getProfilesForDropdown = async (): Promise<Profile[]> => {
  const profilesMap = await getAllProfilesMap();
  return Array.from(profilesMap.values());
};

// Real-time listener for tasks
export const onTasksUpdate = (
  userId: string,
  callback: (data: { tasks: Task[]; isLoading: boolean }) => void
): (() => void) => {
  const tasksCollection = collection(db, 'tasks');
  
  callback({ tasks: [], isLoading: true }); // Initial loading state

  let currentCreatedDocs: QueryDocumentSnapshot[] = [];
  let currentAssignedDocs: QueryDocumentSnapshot[] = [];
  let createdListenerInitialized = false;
  let assignedListenerInitialized = false;
  let profilesMapCache: Map<string, Profile> | null = null;
  let processingTimeout: NodeJS.Timeout | null = null;


  const processAndRelay = async () => {
    if (processingTimeout) clearTimeout(processingTimeout);

    processingTimeout = setTimeout(async () => {
        if (!createdListenerInitialized || !assignedListenerInitialized) {
            if(callback) callback({ tasks: [], isLoading: true });
            return;
        }
        
        if (!profilesMapCache) {
            profilesMapCache = await getAllProfilesMap();
        }

        const taskMap = new Map<string, QueryDocumentSnapshot>();
        currentCreatedDocs.forEach(docSnap => taskMap.set(docSnap.id, docSnap));
        currentAssignedDocs.forEach(docSnap => {
          // Only add if not already present from created tasks (creator can also be assignee)
          if (!taskMap.has(docSnap.id)) {
            taskMap.set(docSnap.id, docSnap);
          }
        });
        
        const tasksPromises = Array.from(taskMap.values()).map(docSnap =>
          processTask(docSnap, profilesMapCache!) 
        );
        
        try {
            const allTasks = await Promise.all(tasksPromises);
            if(callback) callback({ tasks: allTasks, isLoading: false });
        } catch (error) {
            console.error("Error processing tasks for real-time update:", error);
            if(callback) callback({ tasks: [], isLoading: false }); 
        }
    }, 100); // Debounce processing by 100ms
  };
  
  const qCreated = query(tasksCollection, where('created_by_id', '==', userId), orderBy('created_at', 'desc'));
  const unsubscribeCreated = onSnapshot(qCreated, (snapshot) => {
    currentCreatedDocs = snapshot.docs;
    if (!createdListenerInitialized) createdListenerInitialized = true;
    profilesMapCache = null; 
    processAndRelay();
  }, (error) => {
    console.error('Error listening to created tasks:', error);
    if(callback) callback({ tasks: [], isLoading: false });
  });

  const qAssigned = query(tasksCollection, where('assignee_ids', 'array-contains', userId), orderBy('created_at', 'desc'));
  const unsubscribeAssigned = onSnapshot(qAssigned, (snapshot) => {
    currentAssignedDocs = snapshot.docs;
    if(!assignedListenerInitialized) assignedListenerInitialized = true;
    profilesMapCache = null; 
    processAndRelay();
  }, (error) => {
    console.error('Error listening to assigned tasks:', error);
    if(callback) callback({ tasks: [], isLoading: false });
  });

  return () => {
    if (processingTimeout) clearTimeout(processingTimeout);
    unsubscribeCreated();
    unsubscribeAssigned();
  };
};
