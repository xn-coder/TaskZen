
import { db } from './firebase';
import type { Task, Profile, TaskStatus, Comment, TaskDocumentData } from './types';
import type { AppUser } from './auth'; // Import AppUser
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
  DocumentSnapshot, 
  arrayUnion, // Import arrayUnion
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
  // Process timestamps in comments
  if (data.comments && Array.isArray(data.comments)) {
    data.comments = data.comments.map((comment: any) => {
      if (comment.createdAt && comment.createdAt instanceof Timestamp) {
        return { ...comment, createdAt: formatISO(comment.createdAt.toDate()) };
      }
      return comment;
    });
  }
  return data;
};

const processTask = async (taskDocSnap: DocumentSnapshot, profilesMap: Map<string, Profile>): Promise<Task> => {
  if (!taskDocSnap.exists()) {
    throw new Error(`Task document with ID ${taskDocSnap.id} does not exist.`);
  }
  const taskData = processTimestampsInDoc({ id: taskDocSnap.id, ...taskDocSnap.data()! }); 
  
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
    assignees: assignees.length > 0 ? assignees : null, 
    created_by: createdByProfile, 
    comments: taskData.comments || [], // Ensure comments is an array
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
    // Fetch tasks where user is creator OR assignee
    const createdQuery = query(tasksCollection, where('created_by_id', '==', userId));
    const assignedQuery = query(tasksCollection, where('assignee_ids', 'array-contains', userId));
    
    const [createdSnapshot, assignedSnapshot] = await Promise.all([
        getDocs(createdQuery),
        getDocs(assignedQuery)
    ]);

    const taskMap = new Map<string, QueryDocumentSnapshot>();
    createdSnapshot.forEach(docSnap => taskMap.set(docSnap.id, docSnap));
    assignedSnapshot.forEach(docSnap => taskMap.set(docSnap.id, docSnap)); 

    const tasksPromises = Array.from(taskMap.values())
        .sort((a, b) => (b.data().created_at as Timestamp).toMillis() - (a.data().created_at as Timestamp).toMillis()) // Sort by created_at desc
        .map(docSnap => processTask(docSnap, profilesMap));
    return Promise.all(tasksPromises);

  } else { // Fallback for admin-like view, not currently used but kept for completeness
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

export const addTask = async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'status' | 'assignees' | 'created_by' | 'comments'> & { status: Exclude<TaskStatus, "Overdue"> }): Promise<Task> => {
  const tasksCollection = collection(db, 'tasks');
  const payload = {
    ...taskData,
    due_date: taskData.due_date ? Timestamp.fromDate(parseISO(taskData.due_date)) : Timestamp.now(),
    description: taskData.description || "", 
    assignee_ids: taskData.assignee_ids || [],
    comments: [], // Initialize comments as an empty array
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(tasksCollection, payload);
    const newDocSnap = await getDoc(docRef);

    if (!newDocSnap.exists()) {
      console.error(`Failed to retrieve document (ID: ${docRef.id}) immediately after creation.`);
      throw new Error("Failed to create task: Could not retrieve task data post-creation.");
    }
    
    const profilesMap = await getAllProfilesMap();
    return processTask(newDocSnap, profilesMap); 
  } catch (error) {
    console.error("Error adding task to Firestore:", error);
    throw error;
  }
};

// Define a type for the data that can be updated, excluding resolved fields and ensuring dates are strings for input
type TaskUpdatePayload = Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'assignees' | 'created_by' | 'comments'>>;


export const updateTask = async (
  taskId: string,
  taskUpdates: TaskUpdatePayload,
  newCommentText?: string,
  currentUser?: AppUser | null
): Promise<Task> => {
  const taskDocRef = doc(db, 'tasks', taskId);
  
  const firestoreUpdatePayload: any = { updated_at: serverTimestamp() };

  // Prepare main task updates
  for (const key in taskUpdates) {
    if (Object.prototype.hasOwnProperty.call(taskUpdates, key)) {
      const typedKey = key as keyof TaskUpdatePayload;
      if (typedKey === 'due_date' && taskUpdates.due_date) {
        firestoreUpdatePayload.due_date = Timestamp.fromDate(parseISO(taskUpdates.due_date as string));
      } else if (typedKey === 'description' && taskUpdates.description === undefined) {
        firestoreUpdatePayload.description = "";
      } else if (typedKey === 'assignee_ids' && taskUpdates.assignee_ids) {
        firestoreUpdatePayload.assignee_ids = taskUpdates.assignee_ids || [];
      }
      else {
        firestoreUpdatePayload[typedKey] = taskUpdates[typedKey];
      }
    }
  }
  
  // Prepare comment if provided
  if (newCommentText && newCommentText.trim() !== "" && currentUser && currentUser.uid) {
    const newComment: Comment = {
      userId: currentUser.uid,
      userName: currentUser.profile?.name || currentUser.displayName || "User",
      text: newCommentText.trim(),
      createdAt: formatISO(new Date()), // Client-generated ISO string for simplicity with arrayUnion
                                        // For server timestamp, would need a Cloud Function or more complex client logic
    };
    firestoreUpdatePayload.comments = arrayUnion(newComment);
  }

  try {
    await updateDoc(taskDocRef, firestoreUpdatePayload);
    const updatedDocSnap = await getDoc(taskDocRef);
     if (!updatedDocSnap.exists()) {
        throw new Error("Failed to update task or retrieve it after update.");
    }
    const profilesMap = await getAllProfilesMap();
    return processTask(updatedDocSnap, profilesMap);
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

export const onTasksUpdate = (
  userId: string,
  callback: (data: { tasks: Task[]; isLoading: boolean }) => void
): (() => void) => {
  const tasksCollection = collection(db, 'tasks');
  
  callback({ tasks: [], isLoading: true }); 

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
          if (!taskMap.has(docSnap.id)) {
            taskMap.set(docSnap.id, docSnap);
          }
        });
        
        // Sort combined tasks by created_at desc before processing
        const sortedTaskDocs = Array.from(taskMap.values()).sort((a, b) => {
            const timeA = (a.data().created_at as Timestamp) || Timestamp.now(); // Fallback if somehow null
            const timeB = (b.data().created_at as Timestamp) || Timestamp.now();
            return timeB.toMillis() - timeA.toMillis();
        });

        const tasksPromises = sortedTaskDocs.map(docSnap =>
          processTask(docSnap, profilesMapCache!) 
        );
        
        try {
            const allTasks = await Promise.all(tasksPromises);
            if(callback) callback({ tasks: allTasks, isLoading: false });
        } catch (error) {
            console.error("Error processing tasks for real-time update:", error);
            if(callback) callback({ tasks: [], isLoading: false }); 
        }
    }, 100); 
  };
  
  const qCreated = query(tasksCollection, where('created_by_id', '==', userId));
  const unsubscribeCreated = onSnapshot(qCreated, (snapshot) => {
    currentCreatedDocs = snapshot.docs;
    if (!createdListenerInitialized) createdListenerInitialized = true;
    profilesMapCache = null; 
    processAndRelay();
  }, (error) => {
    console.error('Error listening to created tasks:', error);
    if(callback) callback({ tasks: [], isLoading: false });
  });

  const qAssigned = query(tasksCollection, where('assignee_ids', 'array-contains', userId));
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
