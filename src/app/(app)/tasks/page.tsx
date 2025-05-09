
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import type { Task, TaskPriority, TaskStatus } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { getTasks, deleteTask as apiDeleteTask } from '@/lib/taskService'; // Use taskService
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskFilter } from '@/components/tasks/TaskFilter';
import { TaskSearch } from '@/components/tasks/TaskSearch';
import { Button, buttonVariants } from "@/components/ui/button"; // Ensure buttonVariants is imported
import { Loader2, PlusCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation'; // Import useRouter
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function TasksPage() {
  const { user, isInitialLoading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter(); // Initialize router
  const { toast } = useToast();
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const [filters, setFilters] = useState<{ status: TaskStatus[]; priority: TaskPriority[] }>({
    status: [],
    priority: [],
  });

  useEffect(() => {
    if (!authLoading && user) { // Ensure user is loaded before fetching
      setIsLoading(true);
      getTasks(user.id) // Pass user.id if you want to filter tasks by user (e.g., for "My Tasks")
                       // Or remove user.id if this page should show all tasks (admin view)
        .then(fetchedTasks => {
          setTasks(fetchedTasks);
        })
        .catch(error => {
          console.error("Failed to load tasks:", error);
          toast({ title: "Error", description: "Could not load tasks.", variant: "destructive" });
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router, toast]);

  const query = searchParams.get("query") || "";
  const initialFilterParam = searchParams.get("filter"); // For dashboard links

  useEffect(() => {
    if (initialFilterParam && user?.profile) {
      // This is a simplified filter based on dashboard links. 
      // For a more robust solution, consider dedicated filter state in URL or context.
      if (initialFilterParam === "assigned") {
        // This would require tasks to have assignee info readily available for filtering.
        // The current getTasks might not be specific enough.
        // For now, this is a placeholder. A proper implementation would fetch tasks assigned to user.id
        // Or, filter client-side if all tasks are fetched.
         setTasks(prevTasks => prevTasks.filter(t => t.assignee_id === user.id));
      } else if (initialFilterParam === "created") {
         setTasks(prevTasks => prevTasks.filter(t => t.created_by_id === user.id));
      } else if (initialFilterParam === "overdue") {
         setFilters(prev => ({...prev, status: ['Overdue']}));
      }
    }
  }, [initialFilterParam, user]);


  const filteredTasks = useMemo(() => {
    let tasksToFilter = tasks;
    // Apply pre-filter from URL if any (basic example)
    if (user?.profile) {
        if (initialFilterParam === "assigned") {
            tasksToFilter = tasks.filter(task => task.assignee_id === user.id);
        } else if (initialFilterParam === "created") {
            tasksToFilter = tasks.filter(task => task.created_by_id === user.id);
        }
    }
    
    return tasksToFilter
      .filter(task => 
        (task.title.toLowerCase().includes(query.toLowerCase()) || 
         (task.description && task.description.toLowerCase().includes(query.toLowerCase())))
      )
      .filter(task => 
        filters.status.length === 0 || filters.status.includes(task.status)
      )
      .filter(task =>
        filters.priority.length === 0 || filters.priority.includes(task.priority)
      );
  }, [tasks, query, filters, initialFilterParam, user]);

  const handleFilterChange = useCallback((filterType: "status" | "priority", value: string) => {
    setFilters(prevFilters => {
      const currentFilterValues = prevFilters[filterType] as string[]; // Type assertion
      const newFilterValues = currentFilterValues.includes(value)
        ? currentFilterValues.filter(v => v !== value)
        : [...currentFilterValues, value];
      return { ...prevFilters, [filterType]: newFilterValues as TaskStatus[] | TaskPriority[] }; // Type assertion
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ status: [], priority: [] });
    // Optionally clear URL "filter" param if it was used for initial state
    const params = new URLSearchParams(searchParams);
    params.delete("filter");
    router.replace(`${router.pathname}?${params.toString()}`);
  }, [searchParams, router]);

  const handleEditTask = (task: Task) => {
    // For now, using toast as placeholder. In real app, navigate to an edit page/modal.
    // router.push(`/tasks/edit/${task.id}`);
    toast({ title: "Edit Clicked", description: `Editing task: ${task.title}. (Edit page/modal not implemented)`});
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    const taskTitle = tasks.find(t => t.id === taskToDelete)?.title || "Task";
    try {
      await apiDeleteTask(taskToDelete);
      setTasks(prevTasks => prevTasks.filter(t => t.id !== taskToDelete));
      toast({ title: "Task Deleted", description: `"${taskTitle}" has been deleted.` });
    } catch (error: any) {
      toast({ title: "Error Deleting Task", description: error.message || "Could not delete task.", variant: "destructive" });
    } finally {
      setTaskToDelete(null);
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) return null; // Should be handled by ProtectedRoute or useEffect redirect

  return (
    <div className="container mx-auto py-2">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-3xl font-bold text-foreground">All Tasks</h1>
        <Button asChild>
          <Link href="/tasks/create">
            <PlusCircle className="mr-2 h-5 w-5" /> Create New Task
          </Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-col md:flex-row md:items-center gap-4 p-4 bg-card rounded-lg shadow">
        <div className="flex-grow">
          <TaskSearch />
        </div>
        <TaskFilter 
          appliedFilters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={clearFilters}
        />
      </div>

      {filteredTasks.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredTasks.map(task => (
            <TaskCard 
              key={task.id} 
              task={task} 
              onEdit={handleEditTask} 
              onDelete={() => setTaskToDelete(task.id)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-10 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-card">
          <AlertTriangle className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">No Tasks Found</h2>
          <p className="text-muted-foreground">
            Try adjusting your search or filters, or create a new task.
          </p>
           <Button asChild className="mt-6">
            <Link href="/tasks/create">
                <PlusCircle className="mr-2 h-4 w-4" /> Create Task
            </Link>
        </Button>
        </div>
      )}

      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the task
              "{tasks.find(t => t.id === taskToDelete)?.title || ''}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTaskToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTask} className={buttonVariants({ variant: "destructive" })}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
