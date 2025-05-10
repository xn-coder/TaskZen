
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import type { Task, TaskPriority, TaskStatus } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { getTasks, deleteTask as apiDeleteTask } from '@/lib/taskService';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskFilter } from '@/components/tasks/TaskFilter';
import { TaskSearch } from '@/components/tasks/TaskSearch';
import { Button, buttonVariants } from "@/components/ui/button";
import { Loader2, PlusCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
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
  const router = useRouter();
  const { toast } = useToast();
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const [filters, setFilters] = useState<{ status: TaskStatus[]; priority: TaskPriority[] }>({
    status: [],
    priority: [],
  });

  useEffect(() => {
    if (!authLoading && user && user.uid) { // Ensure user and user.uid (Firebase) is loaded
      setIsLoading(true);
      getTasks(user.uid) // Pass user.uid for Firebase to fetch tasks related to this user
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
  const initialFilterParam = searchParams.get("filter");

  // This effect tries to apply initial filters from URL if user context is ready.
  // Note: `tasks` state is updated by the main getTasks fetch. This effect *filters* the already fetched `tasks`.
  // This might lead to a flicker if `getTasks` hasn't completed.
  // A more robust approach might involve passing filter params directly to `getTasks` or using a separate fetching logic.
  useEffect(() => {
    if (initialFilterParam && user?.uid && tasks.length > 0) { // Check tasks.length to avoid filtering empty array
      let tempFilteredTasks = [...tasks]; // Work on a copy
      if (initialFilterParam === "assigned") {
        tempFilteredTasks = tempFilteredTasks.filter(t => t.assignee_id === user.uid);
      } else if (initialFilterParam === "created") {
        tempFilteredTasks = tempFilteredTasks.filter(t => t.created_by_id === user.uid);
      } else if (initialFilterParam === "overdue") {
         // For "overdue" filter from URL, we set the filter state, which will be applied by `filteredTasks` memo
         setFilters(prev => ({...prev, status: ['Overdue']}));
         // We don't directly filter `tasks` here for "overdue" as `filteredTasks` handles it based on `filters` state
         return; // Exit early as filter state change will trigger re-memoization
      }
      // If specific filters like 'assigned' or 'created' were applied, update the main tasks state.
      // This is a bit of a hack. Ideally, these filters are part of the `filteredTasks` memo logic or `getTasks` itself.
      // setTasks(tempFilteredTasks); // This might be too aggressive and could interfere with other filters.
                                  // For now, let's rely on filteredTasks memo.
    }
  }, [initialFilterParam, user, tasks]); // Add tasks to dependency array


  const filteredTasks = useMemo(() => {
    let tasksToFilter = [...tasks]; // Start with all fetched tasks

    // Apply dashboard-linked pre-filter if present and user context is available
    if (user?.uid) {
        if (initialFilterParam === "assigned") {
            tasksToFilter = tasksToFilter.filter(task => task.assignee_id === user.uid);
        } else if (initialFilterParam === "created") {
            tasksToFilter = tasksToFilter.filter(task => task.created_by_id === user.uid);
        }
        // "overdue" from initialFilterParam is handled by setting the `filters.status` state,
        // which is then applied below.
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
      const currentFilterValues = prevFilters[filterType] as string[];
      const newFilterValues = currentFilterValues.includes(value)
        ? currentFilterValues.filter(v => v !== value)
        : [...currentFilterValues, value];
      return { ...prevFilters, [filterType]: newFilterValues as TaskStatus[] | TaskPriority[] };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ status: [], priority: [] });
    const params = new URLSearchParams(searchParams.toString()); // Use toString() for current params
    params.delete("filter"); // Clear the "filter" param from URL
    params.delete("query"); // Also clear search query if desired
    router.replace(`${pathname}?${params.toString()}`); // Use pathname
  }, [searchParams, router, pathname]);


  const handleEditTask = (task: Task) => {
    // For Firebase, task.id is Firestore document ID
    // router.push(`/tasks/edit/${task.id}`); // Uncomment when edit page is ready
    toast({ title: "Edit Action", description: `Editing task: ${task.title}. (Edit page not implemented)`});
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    const taskTitle = tasks.find(t => t.id === taskToDelete)?.title || "Task";
    try {
      await apiDeleteTask(taskToDelete); // taskToDelete is Firestore document ID
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
  
  if (!user) return null; 

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
