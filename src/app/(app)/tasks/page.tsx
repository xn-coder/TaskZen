
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
  const { user, isInitialLoading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname(); 
  const { toast } = useToast();
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const [filters, setFilters] = useState<{ status: TaskStatus[]; priority: TaskPriority[] }>({
    status: [],
    priority: [],
  });

  useEffect(() => {
    if (!authLoading && user && user.uid) { 
      setIsLoading(true);
      getTasks(user.uid) 
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

  useEffect(() => {
    if (initialFilterParam && user?.uid && tasks.length > 0) {
      if (initialFilterParam === "overdue") {
         setFilters(prev => ({...prev, status: ['Overdue']}));
         return; 
      }
      // For 'assigned' or 'created', the filtering is now primarily handled by `filteredTasks` memo
      // and the `getTasks` function itself which fetches relevant tasks based on userId.
      // This effect ensures that if URL has `filter=assigned` or `filter=created`,
      // those tasks are prioritized or shown. The `filteredTasks` memo will respect these.
    }
  }, [initialFilterParam, user, tasks.length]); // Added tasks.length as a dependency


  const filteredTasks = useMemo(() => {
    let tasksToFilter = [...tasks]; 

    if (user?.uid) {
        if (initialFilterParam === "assigned") {
            // Filter tasks where the current user is one of the assignees
            tasksToFilter = tasksToFilter.filter(task => task.assignee_ids.includes(user.uid!));
        } else if (initialFilterParam === "created") {
            tasksToFilter = tasksToFilter.filter(task => task.created_by_id === user.uid);
        }
        // "overdue" is handled by status filter
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
    const params = new URLSearchParams(searchParams.toString()); 
    params.delete("filter"); 
    params.delete("query"); 
    router.replace(`${pathname}?${params.toString()}`); 
  }, [searchParams, router, pathname]);


  const handleEditTask = (task: Task) => {
    if (user?.uid !== task.created_by_id) {
      toast({ title: "Permission Denied", description: `Only the creator can edit task: ${task.title}.`, variant: "destructive"});
      return;
    }
    router.push(`/tasks/${task.id}/edit`);
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

