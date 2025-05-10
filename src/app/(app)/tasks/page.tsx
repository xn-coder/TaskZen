
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import type { Task, TaskPriority, TaskStatus } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { deleteTask as apiDeleteTask } from '@/lib/taskService'; 
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname(); 
  const { toast } = useToast();
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const [filters, setFilters] = useState<{ status: TaskStatus[]; priority: TaskPriority[] }>({
    status: [],
    priority: [],
  });

  const query = searchParams.get("query") || "";
  const initialFilterParam = searchParams.get("filter");

  useEffect(() => {
    if (initialFilterParam && user?.uid && realtimeTasks.length > 0) { 
      if (initialFilterParam === "overdue") {
         setFilters(prev => ({...prev, status: ['Overdue']}));
      }
    }
  }, [initialFilterParam, user, realtimeTasks.length, searchParams, router, pathname]); 


  const filteredTasks = useMemo(() => {
    let tasksToFilter = [...realtimeTasks]; 

    if (user?.uid) {
        if (initialFilterParam === "assigned") {
            tasksToFilter = tasksToFilter.filter(task => task.assignee_ids && task.assignee_ids.includes(user.uid!));
        } else if (initialFilterParam === "created") {
            tasksToFilter = tasksToFilter.filter(task => task.created_by_id === user.uid);
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
  }, [realtimeTasks, query, filters, initialFilterParam, user]);

  const handleFilterChange = useCallback((filterType: "status" | "priority", value: string) => {
    setFilters(prevFilters => {
      const currentFilterValues = prevFilters[filterType] as string[];
      const newFilterValues = currentFilterValues.includes(value)
        ? currentFilterValues.filter(v => v !== value)
        : [...currentFilterValues, value];
      return { ...prevFilters, [filterType]: newFilterValues as TaskStatus[] | TaskPriority[] };
    });
    const params = new URLSearchParams(searchParams.toString());
    if (params.has("filter")) {
        params.delete("filter");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [searchParams, router, pathname]);

  const clearFilters = useCallback(() => {
    setFilters({ status: [], priority: [] });
    const params = new URLSearchParams(searchParams.toString()); 
    params.delete("filter"); 
    router.replace(`${pathname}?${params.toString()}`, { scroll: false }); 
  }, [searchParams, router, pathname]);


  const handleEditTask = useCallback((task: Task) => {
    router.push(`/tasks/${task.id}/edit`);
  }, [router]);

  const handleDeleteRequest = useCallback((taskId: string) => {
    const taskToDeleteRef = realtimeTasks.find(t => t.id === taskId);
    if (taskToDeleteRef && user?.uid !== taskToDeleteRef.created_by_id) {
       toast({ title: "Permission Denied", description: "Only the task creator can delete this task.", variant: "destructive"});
       return;
    }
    setTaskToDelete(taskId);
  }, [realtimeTasks, user, toast]);


  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    const taskBeingDeleted = realtimeTasks.find(t => t.id === taskToDelete);
    if (!taskBeingDeleted) return;

    if (user?.uid !== taskBeingDeleted.created_by_id) {
      toast({ title: "Permission Denied", description: "Only the task creator can delete this task.", variant: "destructive"});
      setTaskToDelete(null);
      return;
    }

    try {
      await apiDeleteTask(taskToDelete); 
      toast({ title: "Task Deleted", description: `"${taskBeingDeleted.title}" has been deleted.` });
    } catch (error: any) {
      toast({ title: "Error Deleting Task", description: error.message || "Could not delete task.", variant: "destructive" });
    } finally {
      setTaskToDelete(null);
    }
  };

  if (authLoading || (user && areRealtimeTasksLoading)) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user && !authLoading) { 
     if (typeof window !== "undefined") router.replace('/login');
     return null; 
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
              onDelete={handleDeleteRequest}
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
