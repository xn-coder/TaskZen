
import type { Task, User, TaskStatus } from './types';
import { formatISO } from 'date-fns';

// Mock Users
export const mockUsers: User[] = [
  { id: 'user1', name: 'Alice Wonderland', email: 'alice@example.com', avatar: 'https://picsum.photos/seed/alice/40/40' },
  { id: 'user2', name: 'Bob The Builder', email: 'bob@example.com', avatar: 'https://picsum.photos/seed/bob/40/40' },
  { id: 'user3', name: 'Charlie Chaplin', email: 'charlie@example.com', avatar: 'https://picsum.photos/seed/charlie/40/40' },
];

// Mock Tasks
export let mockTasks: Task[] = [
  {
    id: 'task1',
    title: 'Design landing page',
    description: 'Create mockups for the new landing page with a focus on user engagement.',
    dueDate: formatISO(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)), // 3 days from now
    priority: 'High',
    status: 'In Progress',
    assigneeId: 'user1',
    createdById: 'user2',
    createdAt: formatISO(new Date()),
    updatedAt: formatISO(new Date()),
  },
  {
    id: 'task2',
    title: 'Develop API endpoints',
    description: 'Implement REST API endpoints for task management, including CRUD operations.',
    dueDate: formatISO(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days from now
    priority: 'Medium',
    status: 'To Do',
    assigneeId: 'user2',
    createdById: 'user1',
    createdAt: formatISO(new Date()),
    updatedAt: formatISO(new Date()),
  },
  {
    id: 'task3',
    title: 'User testing for beta version',
    description: 'Conduct user testing sessions and gather feedback for the beta release.',
    dueDate: formatISO(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)), // 2 days ago
    priority: 'High',
    status: 'To Do', 
    assigneeId: 'user3',
    createdById: 'user1',
    createdAt: formatISO(new Date()),
    updatedAt: formatISO(new Date()),
  },
  {
    id: 'task4',
    title: 'Write documentation',
    description: 'Prepare comprehensive documentation for developers and end-users.',
    dueDate: formatISO(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)), // 14 days from now
    priority: 'Low',
    status: 'To Do',
    createdById: 'user3',
    createdAt: formatISO(new Date()),
    updatedAt: formatISO(new Date()),
  },
  {
    id: 'task5',
    title: 'Deploy to staging server',
    description: 'Deploy the latest build to the staging environment for QA.',
    dueDate: formatISO(new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)), // 1 day from now
    priority: 'Medium',
    status: 'Done',
    assigneeId: 'user1',
    createdById: 'user2',
    createdAt: formatISO(new Date()),
    updatedAt: formatISO(new Date()),
  },
];

// Denormalize tasks with user objects for easier display
export const getDenormalizedTasks = (tasks: Task[]): Task[] => {
  return tasks.map(task => ({
    ...task,
    assignee: task.assigneeId ? mockUsers.find(u => u.id === task.assigneeId) : undefined,
    createdBy: mockUsers.find(u => u.id === task.createdById)!, // Assuming createdBy is always valid
  }));
};


// Helper to update task status if overdue and denormalize
export const getTasksWithResolvedStatus = (tasks: Task[]): Task[] => {
  const now = new Date();
  return tasks.map(task => {
    const isOverdue = task.status !== 'Done' && new Date(task.dueDate) < now;
    return {
      ...task,
      status: isOverdue ? 'Overdue' as TaskStatus : task.status,
      assignee: task.assigneeId ? mockUsers.find(u => u.id === task.assigneeId) : undefined,
      createdBy: mockUsers.find(u => u.id === task.createdById)!,
    };
  });
};

export const addTask = (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task => {
  const newTask: Task = {
    ...task,
    id: `task${mockTasks.length + 1}`,
    createdAt: formatISO(new Date()),
    updatedAt: formatISO(new Date()),
  };
  mockTasks = [...mockTasks, newTask];
  return newTask;
};

export const updateTask = (updatedTask: Task): Task | undefined => {
  mockTasks = mockTasks.map(task => 
    task.id === updatedTask.id ? { ...updatedTask, updatedAt: formatISO(new Date()) } : task
  );
  return mockTasks.find(task => task.id === updatedTask.id);
};

export const deleteTask = (taskId: string): void => {
  mockTasks = mockTasks.filter(task => task.id !== taskId);
};
