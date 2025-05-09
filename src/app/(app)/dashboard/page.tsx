"use client";

import { useEffect, useState, useMemo } from 'react';
import type { Task } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { getDashboardTasks } from '@/lib/taskService'; // Use taskService
import { TaskCard } from '@/components/tasks/TaskCard';
import { Loader2, ListChecks, UserPlus, AlertOctagon, CheckSquare, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";


const handleEditTaskRedirect = (task: Task, router: ReturnType<typeof useRouter>) => {
  const { toast } = useToast();
  toast({ title: "Edit Action", description: `To edit '${task.title}', please go to the All Tasks page.`});
};


export default function DashboardPage() {
  const { user, isInitialLoading: authLoading } = useAuth();
  const [dashboardTasks, setDashboardTasks] = useState<{ assignedTasks: Task[], createdTasks: Task[], overdueTasks: Task[] }>({
    assignedTasks: [],
    createdTasks: [],
    overdueTasks: [],
  });
  const [isLoading, setIsLoading] = useState(true); // Combined loading state for the page
  const router = useRouter();
  const { toast } = useToast();


  useEffect(() => {
    // Scenario 1: Auth is still loading.
    if (authLoading) {
      setIsLoading(true); // General page loading is true
      return;
    }

    // Scenario 2: Auth is done, but no user. Redirect.
    if (!user) {
      router.replace('/login');
      setIsLoading(false); // Stop general page loading as we are redirecting
      return;
    }

    // Scenario 3: Auth is done, user exists, but profile is not yet loaded/available.
    if (user && !user.profile) {
      // console.log("Dashboard: User loaded, waiting for profile...");
      setIsLoading(true); // Keep page loading, as profile is essential for dashboard content/logic
      // Potentially add a timeout here or a listener for profile update if it's highly async
      // For now, relying on `user` object update from AuthContext to re-trigger this effect.
      return;
    }

    // Scenario 4: Auth is done, user exists, profile exists. Fetch tasks.
    if (user && user.profile) {
      // console.log("Dashboard: User and profile loaded, fetching tasks for user:", user.id);
      setIsLoading(true); // Set loading true specifically for task fetching operation
      getDashboardTasks(user.id)
        .then(data => {
          setDashboardTasks(data);
        })
        .catch(error => {
          console.error("Failed to load dashboard tasks:", error);
          toast({ title: "Error", description: "Could not load dashboard tasks.", variant: "destructive" });
        })
        .finally(() => {
          setIsLoading(false); // Task fetching attempt (success or fail) is complete
        });
    }
  }, [user, authLoading, router, toast]);


  const handleDeleteTaskPlaceholder = (taskId: string) => {
     toast({ title: "Delete Action", description: `To delete tasks, please go to the All Tasks page.`});
  };


  if (isLoading) { // Covers authLoading, profile pending, and task fetching
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // This state implies authLoading is false, isLoading (for tasks/profile) is false,
  // but user or user.profile is still not available. This is an unexpected state
  // if useEffect correctly handles redirects and profile loading.
  if (!user || !user.profile) {
    return (
       <div className="flex h-full flex-col items-center justify-center text-center p-6">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Could Not Load User Data</h2>
        <p className="text-muted-foreground mb-6">
          There was an issue retrieving your profile information. Please try logging in again.
        </p>
        <Button onClick={() => router.push('/login')} variant="outline">
          Go to Login
        </Button>
      </div>
    );
  }

  const renderTaskSection = (title: string, tasksToDisplay: Task[], IconComponent: React.ElementType, emptyMessage: string, EmptyIconComponent?: React.ElementType, viewAllLink?: string) => (
    <section className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold flex items-center">
          <span className="mr-2 p-2 bg-primary/10 text-primary rounded-lg">
            <IconComponent size={24} />
          </span>
          {title} ({tasksToDisplay.length})
        </h2>
        {tasksToDisplay.length > 4 && viewAllLink && (
            <Button asChild variant="outline" size="sm">
                <Link href={viewAllLink}>View All</Link>
            </Button>
         )}
      </div>
      {tasksToDisplay.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tasksToDisplay.slice(0,4).map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={(t) => handleEditTaskRedirect(t, router)}
              onDelete={handleDeleteTaskPlaceholder}
            />
          ))}
        </div>
      ) : (
        <Card className="p-6 text-center text-muted-foreground border-dashed">
          {EmptyIconComponent && <EmptyIconComponent size={48} className="mx-auto mb-4 text-muted-foreground/50" />}
          <p>{emptyMessage}</p>
          <Button asChild variant="link" className="mt-2">
            <Link href="/tasks/create">Create a new task</Link>
          </Button>
        </Card>
      )}
    </section>
  );

  return (
    <div className="container mx-auto py-2">
      <div className="mb-8 p-6 bg-card rounded-lg shadow">
        <h1 className="text-3xl font-bold text-foreground">Welcome back, {user.profile.name}!</h1>
        <p className="text-muted-foreground">Here&apos;s a summary of your tasks.</p>
      </div>

      {renderTaskSection("Tasks Assigned to You", dashboardTasks.assignedTasks, ListChecks, "No active tasks currently assigned to you. Great job!", CheckSquare, "/tasks?filter=assigned")}
      {renderTaskSection("Tasks You Created", dashboardTasks.createdTasks, UserPlus, "You haven't created any active tasks yet.", CheckSquare, "/tasks?filter=created")}
      {renderTaskSection("Overdue Tasks", dashboardTasks.overdueTasks, AlertOctagon, "No overdue tasks. Keep it up!", CheckSquare, "/tasks?filter=overdue")}

    </div>
  );
}
