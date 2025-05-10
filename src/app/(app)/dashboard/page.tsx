
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
  // For Firebase, edit page would be /tasks/edit/[taskId]
  // This is a placeholder redirect for now.
  const { toast } = useToast(); // This needs to be created here or passed
  toast({ title: "Edit Action", description: `To edit '${task.title}', please go to the All Tasks page and find an edit button there.`});
};


export default function DashboardPage() {
  const { user, isInitialLoading: authContextLoading } = useAuth();
  const [dashboardTasks, setDashboardTasks] = useState<{ assignedTasks: Task[], createdTasks: Task[], overdueTasks: Task[] }>({
    assignedTasks: [],
    createdTasks: [],
    overdueTasks: [],
  });
  const [isFetchingTasks, setIsFetchingTasks] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (authContextLoading) {
      setIsFetchingTasks(false);
      return;
    }

    if (!user) {
      // This should ideally be caught by ProtectedRoute, but as a safeguard
      setIsFetchingTasks(false);
      router.replace('/login'); // Ensure redirection if somehow missed
      return;
    }
    
    // User exists, now check for profile.
    // With Firebase, user.profile is populated after user object is available
    // The `user` object from useAuth() is designed to include the profile.
    // If `user.profile` is null here, it means it couldn't be fetched or doesn't exist.
    if (!user.profile) {
      // This indicates an issue fetching the profile from Firestore or profile creation failed.
      setIsFetchingTasks(false); 
      // The UI below handles showing a "Profile Not Loaded" message.
      return;
    }

    // User and profile are available. Fetch tasks.
    setIsFetchingTasks(true);
    getDashboardTasks(user.uid) // Use user.uid for Firebase
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

  if (authContextLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-foreground">Authenticating...</p>
      </div>
    );
  }

  if (!user) {
     return (
       <div className="flex h-full flex-col items-center justify-center text-center p-6">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Authentication Required</h2>
        <p className="text-muted-foreground mb-6">
          Please log in to view your dashboard.
        </p>
        <Button onClick={() => router.push('/login')} variant="outline">
          Go to Login
        </Button>
      </div>
    );
  }

  if (!user.profile) {
    // This state implies user is authenticated but profile data is missing or failed to load
    return (
       <div className="flex h-full flex-col items-center justify-center text-center p-6">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Profile Not Loaded</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Your profile information could not be loaded. This can happen if the profile document is missing in Firestore or if there are permission issues with Firestore rules. Please ensure your Firestore database is set up correctly and rules allow profile reads. Refer to `README.md` for setup instructions.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()} variant="outline">
            Refresh Page
          </Button>
           <Button onClick={async () => {
            // Attempt to log out and redirect to login
            try {
              await useAuth().logout(); // This might be problematic if useAuth() is not stable here
            } catch (e) { console.error(e); }
            router.push('/login');
          }} variant="default">
            Logout and Login Again
          </Button>
        </div>
      </div>
    );
  }
  
  if (isFetchingTasks) {
     return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-foreground">Loading dashboard tasks...</p>
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
        <h1 className="text-3xl font-bold text-foreground">Welcome back, {user.profile.name || user.displayName || user.email}!</h1>
        <p className="text-muted-foreground">Here&apos;s a summary of your tasks.</p>
      </div>

      {renderTaskSection("Tasks Assigned to You", dashboardTasks.assignedTasks, ListChecks, "No active tasks currently assigned to you. Great job!", CheckSquare, "/tasks?filter=assigned")}
      {renderTaskSection("Tasks You Created", dashboardTasks.createdTasks, UserPlus, "You haven't created any active tasks yet.", CheckSquare, "/tasks?filter=created")}
      {renderTaskSection("Overdue Tasks", dashboardTasks.overdueTasks, AlertOctagon, "No overdue tasks. Keep it up!", CheckSquare, "/tasks?filter=overdue")}

    </div>
  );
}
