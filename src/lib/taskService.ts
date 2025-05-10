
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
  serverTimestamp
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

const processTask = async (taskDoc: any, profilesMap: Map<string, Profile>): Promise<Task> => {
  const taskData = processTimestampsInDoc({ id: taskDoc.id, ...taskDoc.data() });
  
  const now = new Date();
  // Ensure due_date is parsed correctly if it's already a string from processTimestampsInDoc
  const dueDate = taskData.due_date ? parseISO(taskData.due_date) : new Date(0); // Default to past if not set
  const isOverdue = taskData.status !== 'Done' && isBefore(dueDate, now);

  const assignee = taskData.assignee_id ? profilesMap.get(taskData.assignee_id) : null;
  const createdBy = taskData.created_by_id ? profilesMap.get(taskData.created_by_id) : undefined;


  return {
    ...taskData,
    status: isOverdue ? 'Overdue' : taskData.status,
    assignee: assignee || null,
    created_by: createdBy,
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
  // For "All Tasks" page, if userId is not specified for specific filtering, fetch all tasks.
  // If userId *is* provided, it implies "My Tasks" meaning created by OR assigned to the user.
  let q;
  if (userId) {
     // This query is complex for Firestore (OR queries on different fields).
     // A common pattern is to fetch separately and merge, or denormalize.
     // For simplicity, fetching tasks created by user and assigned to user separately.
    const createdQuery = query(tasksCollection, where('created_by_id', '==', userId), orderBy('created_at', 'desc'));
    const assignedQuery = query(tasksCollection, where('assignee_id', '==', userId), orderBy('created_at', 'desc'));
    
    const [createdSnapshot, assignedSnapshot] = await Promise.all([
        getDocs(createdQuery),
        getDocs(assignedQuery)
    ]);

    const taskMap = new Map<string, any>();
    createdSnapshot.forEach(docSnap => taskMap.set(docSnap.id, docSnap));
    assignedSnapshot.forEach(docSnap => taskMap.set(docSnap.id, docSnap)); // Overwrites if duplicate, which is fine

    const tasksPromises = Array.from(taskMap.values()).map(docSnap => processTask(docSnap, profilesMap));
    return Promise.all(tasksPromises);

  } else {
    // Fetch all tasks if no userId (e.g. for a potential admin view, though not implemented)
    // For now, this mirrors the previous behavior for the general tasks page.
    q = query(tasksCollection, orderBy('created_at', 'desc'));
    const querySnapshot = await getDocs(q);
    const tasksPromises = querySnapshot.docs.map(docSnap => processTask(docSnap, profilesMap));
    return Promise.all(tasksPromises);
  }
};

export const getDashboardTasks = async (userId: string): Promise<{ assignedTasks: Task[], createdTasks: Task[], overdueTasks: Task[] }> => {
  const profilesMap = await getAllProfilesMap();
  const tasksCollection = collection(db, 'tasks');

  const assignedQuery = query(
    tasksCollection,
    where('assignee_id', '==', userId),
    where('status', '!=', 'Done'),
    orderBy('status'), // Firestore requires orderBy for inequality filters on other fields
    orderBy('due_date', 'asc')
  );
  const createdQuery = query(
    tasksCollection,
    where('created_by_id', '==', userId),
    where('status', '!=', 'Done'),
    orderBy('status'),
    orderBy('due_date', 'asc')
  );

  try {
    const [assignedSnapshot, createdSnapshot] = await Promise.all([
      getDocs(assignedQuery),
      getDocs(createdQuery),
    ]);

    const assignedTasksPromises = assignedSnapshot.docs.map(doc => processTask(doc, profilesMap));
    const createdTasksPromises = createdSnapshot.docs.map(doc => processTask(doc, profilesMap));
    
    let assignedTasks = await Promise.all(assignedTasksPromises);
    let createdTasks = await Promise.all(createdTasksPromises);

    // Combine and filter for overdue tasks, ensuring uniqueness
    const allActiveTasks = new Map<string, Task>();
    assignedTasks.forEach(task => allActiveTasks.set(task.id, task));
    createdTasks.forEach(task => allActiveTasks.set(task.id, task)); // Overwrites if duplicate which is fine

    const overdueTasks = Array.from(allActiveTasks.values()).filter(task => task.status === 'Overdue');
    
    return {
      assignedTasks: assignedTasks.filter(t => t.status !== 'Overdue'),
      createdTasks: createdTasks.filter(t => t.status !== 'Overdue'),
      overdueTasks,
    };

  } catch (error) {
    console.error('Error fetching dashboard tasks:', error);
    return { assignedTasks: [], createdTasks: [], overdueTasks: [] };
  }
};

export const addTask = async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'status' | 'assignee' | 'created_by'> & { status: Exclude<TaskStatus, "Overdue"> }): Promise<Task> => {
  const tasksCollection = collection(db, 'tasks');
  const payload = {
    ...taskData,
    due_date: taskData.due_date ? Timestamp.fromDate(parseISO(taskData.due_date)) : Timestamp.now(),
    description: taskData.description || "", // Ensure empty string if undefined
    assignee_id: taskData.assignee_id || null, // Ensure null if undefined
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(tasksCollection, payload);
    const newDocSnap = await getDoc(docRef);
    if (!newDocSnap.exists()) {
        throw new Error("Failed to create task or retrieve it after creation.");
    }
    const profilesMap = await getAllProfilesMap();
    return processTask(newDocSnap, profilesMap);
  } catch (error) {
    console.error("Error adding task to Firestore:", error);
    throw error;
  }
};

export const updateTask = async (taskId: string, taskData: Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'assignee' | 'created_by'>>): Promise<Task> => {
  const taskDocRef = doc(db, 'tasks', taskId);
  
  const updatePayload: any = { ...taskData, updated_at: serverTimestamp() };
  if (taskData.due_date) {
    updatePayload.due_date = Timestamp.fromDate(parseISO(taskData.due_date));
  }
   if (taskData.hasOwnProperty('description') && taskData.description === undefined) {
    updatePayload.description = ""; // Handle explicit undefined to empty string
  }
  if (taskData.hasOwnProperty('assignee_id') && taskData.assignee_id === undefined) {
    updatePayload.assignee_id = null; // Handle explicit undefined to null
  }


  try {
    await updateDoc(taskDocRef, updatePayload);
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
