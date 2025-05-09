"use client";

import { useEffect, useState } from 'react';
import type { Task } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { getDashboardTasks } from '@/lib/taskService';
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
  const { user, isInitialLoading: authContextLoading } = useAuth();
  const [dashboardTasks, setDashboardTasks] = useState<{ assignedTasks: Task[], createdTasks: Task[], overdueTasks: Task[] }>({
    assignedTasks: [],
    createdTasks: [],
    overdueTasks: [],
  });
  const [isFetchingTasks, setIsFetchingTasks] = useState(true); // Specific for task fetching
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // If auth is still loading, or no user yet, don't do anything here.
    // ProtectedRoute and the initial checks below will handle UI.
    if (authContextLoading || !user) {
      setIsFetchingTasks(false); // Not fetching tasks if auth isn't ready
      return;
    }

    // At this point, authContextLoading is false, and user object exists.
    // Now, check for profile.
    if (!user.profile) {
      // Profile is not yet available. AuthContext might still be fetching it, or it failed.
      // We don't start fetching tasks. The UI below will handle showing a message.
      // This useEffect will re-run when `user` (and hopefully `user.profile`) updates.
      setIsFetchingTasks(false); // Not fetching if profile is missing
      return;
    }

    // User and profile are available. Fetch tasks.
    // console.log("Dashboard: User and profile loaded, fetching tasks for user:", user.id);
    setIsFetchingTasks(true);
    getDashboardTasks(user.id)
      .then(data => {
        setDashboardTasks(data);
      })
      .catch(error => {
        console.error("Failed to load dashboard tasks:", error);
        toast({ title: "Error", description: "Could not load dashboard tasks.", variant: "destructive" });
      })
      .finally(() => {
        setIsFetchingTasks(false);
      });

  }, [user, authContextLoading, router, toast]);


  const handleDeleteTaskPlaceholder = (taskId: string) => {
     toast({ title: "Delete Action", description: `To delete tasks, please go to the All Tasks page.`});
  };

  // 1. Handle Auth Loading
  if (authContextLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-foreground">Authenticating...</p>
      </div>
    );
  }

  // 2. Auth is done, but no user (should be caught by ProtectedRoute, but as a fallback)
  if (!user) {
    // This state indicates an issue if ProtectedRoute didn't redirect.
    // For robustness, we can show a loader while redirecting.
    // router.replace('/login'); // This might be too aggressive here, ProtectedRoute handles it.
    return (
       <div className="flex h-full flex-col items-center justify-center text-center p-6">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Authentication Issue</h2>
        <p className="text-muted-foreground mb-6">
          User data is not available. You might be redirected to login.
        </p>
        <Button onClick={() => router.push('/login')} variant="outline">
          Go to Login
        </Button>
      </div>
    );
  }

  // 3. Auth is done, user exists, but profile is missing.
  if (!user.profile) {
    return (
       <div className="flex h-full flex-col items-center justify-center text-center p-6">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Profile Not Loaded</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Your profile information could not be loaded. This can happen if the 'profiles' table is missing in the database or if there are permission issues. Please ensure database migrations (especially `0001_setup_profiles.sql`) have been run. Refer to `README.md` for setup instructions.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()} variant="outline">
            Refresh Page
          </Button>
          <Button onClick={() => router.push('/login')} variant="default">
            Logout and Login Again
          </Button>
        </div>
      </div>
    );
  }
  
  // 4. User and profile are loaded. If tasks are still fetching, show task-specific loader.
  if (isFetchingTasks) {
     return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-foreground">Loading dashboard tasks...</p>
      </div>
    );
  }

  // All checks passed, data loaded (or failed gracefully). Render the dashboard.
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
        <Card className="p-6 text-center text-muted-foreground border-dashed border-muted-foreground/30 rounded-lg bg-card">
          {EmptyIconComponent && <EmptyIconComponent size={48} className="mx-auto mb-4 text-muted-foreground/50" />}
          <p>{emptyMessage}</p>
          <Button asChild variant="link" className="mt-2 text-primary">
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
