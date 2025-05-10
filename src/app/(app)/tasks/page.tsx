
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import type { Task, TaskPriority, TaskStatus } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { deleteTask as apiDeleteTask } from '@/lib/taskService'; // getTasks removed
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskFilter } from '@/components/tasks/TaskFilter';
import { TaskSearch } from '@/components/tasks/TaskSearch';
import { Button, buttonVariants } from "@/components/ui/button";
import { Loader2, PlusCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
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
  const { user, isInitialLoading: authLoading, realtimeTasks, areRealtimeTasksLoading } = useAuth();
  // Removed local tasks state and isLoading state for fetching tasks
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname(); 
  const { toast } = useToast();
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const [filters, setFilters] = useState<{ status: TaskStatus[]; priority: TaskPriority[] }>({
    status: [],
    priority: [],
  });

  // useEffect for fetching initial tasks is removed, using realtimeTasks from context

  const query = searchParams.get("query") || "";
  const initialFilterParam = searchParams.get("filter");

  useEffect(() => {
    // This effect sets initial filters based on URL params (e.g., from dashboard links)
    if (initialFilterParam && user?.uid && realtimeTasks.length > 0) { // Depend on realtimeTasks
      if (initialFilterParam === "overdue") {
         setFilters(prev => ({...prev, status: ['Overdue']}));
      } else if (initialFilterParam === "assigned") {
        // If you want to pre-filter based on "assigned" or "created" query params on this page,
        // you might not need to. The filteredTasks memo will handle it if `initialFilterParam` logic is added there.
        // For now, only "overdue" is explicitly set as a filter.
        // "Assigned" and "Created" are used as a base list in filteredTasks.
      }
      // Clear the 'filter' search param after applying it, so direct filtering works next.
      // This is optional and depends on desired UX.
      // const params = new URLSearchParams(searchParams.toString());
      // params.delete("filter");
      // router.replace(`${pathname}?${params.toString()}`, { scroll: false });

    }
  }, [initialFilterParam, user, realtimeTasks.length, searchParams, router, pathname]); 


  const filteredTasks = useMemo(() => {
    let tasksToFilter = [...realtimeTasks]; 

    if (user?.uid) {
        // Apply dashboard-like pre-filtering if 'filter' param is present and not 'overdue' (handled by setFilters)
        if (initialFilterParam === "assigned") {
            tasksToFilter = tasksToFilter.filter(task => task.assignee_ids && task.assignee_ids.includes(user.uid!));
        } else if (initialFilterParam === "created") {
            tasksToFilter = tasksToFilter.filter(task => task.created_by_id === user.uid);
        }
        // 'overdue' filter is handled by the `filters.status` state which is set by the useEffect above
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
  }, [realtimeTasks, query, filters, initialFilterParam, user]);

  const handleFilterChange = useCallback((filterType: "status" | "priority", value: string) => {
    setFilters(prevFilters => {
      const currentFilterValues = prevFilters[filterType] as string[];
      const newFilterValues = currentFilterValues.includes(value)
        ? currentFilterValues.filter(v => v !== value)
        : [...currentFilterValues, value];
      return { ...prevFilters, [filterType]: newFilterValues as TaskStatus[] | TaskPriority[] };
    });
    // Clear the 'filter' query param when user manually changes filters
    const params = new URLSearchParams(searchParams.toString());
    if (params.has("filter")) {
        params.delete("filter");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [searchParams, router, pathname]);

  const clearFilters = useCallback(() => {
    setFilters({ status: [], priority: [] });
    const params = new URLSearchParams(searchParams.toString()); 
    params.delete("filter"); // Ensure 'filter' from URL is also cleared
    // query (search term) is handled by TaskSearch component itself, not cleared here by default
    // If you want to clear search query too: params.delete("query");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false }); 
  }, [searchParams, router, pathname]);


  const handleEditTask = (task: Task) => {
    router.push(`/tasks/${task.id}/edit`);
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    // Find from realtimeTasks as local 'tasks' state is removed
    const taskBeingDeleted = realtimeTasks.find(t => t.id === taskToDelete);
    if (!taskBeingDeleted) return;

    if (user?.uid !== taskBeingDeleted.created_by_id) {
      toast({ title: "Permission Denied", description: "Only the task creator can delete this task.", variant: "destructive"});
      setTaskToDelete(null);
      return;
    }

    try {
      await apiDeleteTask(taskToDelete); 
      // No need to manually update local state, real-time listener will handle it.
      // setTasks(prevTasks => prevTasks.filter(t => t.id !== taskToDelete));
      toast({ title: "Task Deleted", description: `"${taskBeingDeleted.title}" has been deleted.` });
    } catch (error: any) {
      toast({ title: "Error Deleting Task", description: error.message || "Could not delete task.", variant: "destructive" });
    } finally {
      setTaskToDelete(null);
    }
  };

  // Combined loading state for auth and tasks
  if (authLoading || (user && areRealtimeTasksLoading)) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user && !authLoading) { // If auth is done and no user, redirect (handled by ProtectedRoute, but good fallback)
     if (typeof window !== "undefined") router.replace('/login');
     return null; 
  }
  if (!user) return null; // Should be caught by above or ProtectedRoute

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
              onDelete={() => {
                const taskToDeleteRef = realtimeTasks.find(t => t.id === task.id);
                if (taskToDeleteRef && user?.uid !== taskToDeleteRef.created_by_id) {
                   toast({ title: "Permission Denied", description: "Only the task creator can delete this task.", variant: "destructive"});
                   return;
                }
                setTaskToDelete(task.id);
              }}
            />
          ))}
        </div>
      ) : (
        <div className="mt-10 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-card">
          <AlertTriangle className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">No Tasks Found</h2>
          <p className="text-muted-foreground">
            {(query || filters.status.length > 0 || filters.priority.length > 0) 
              ? "Try adjusting your search or filters." 
              : "You haven't created or been assigned any tasks yet."}
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
              "{realtimeTasks.find(t => t.id === taskToDelete)?.title || ''}".
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
