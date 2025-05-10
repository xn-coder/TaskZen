"use client";

import { useEffect, useState } from 'react';
import type { Task } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { getDashboardTasks } from '@/lib/taskService';
import { TaskCard } from '@/components/tasks/TaskCard';
import { Loader2, ListChecks, UserPlus, AlertOctagon, CheckSquare, AlertTriangle, Users } from 'lucide-react'; // Added Users
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";


export default function DashboardPage() {
  const { user, isInitialLoading: authLoading } = useAuth();
  const [dashboardTasks, setDashboardTasks] = useState<{ assignedTasks: Task[], createdTasks: Task[], overdueTasks: Task[] }>({
    assignedTasks: [],
    createdTasks: [],
    overdueTasks: [],
  });
  const [isFetchingTasks, setIsFetchingTasks] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const handleEditTaskRedirect = (task: Task) => {
    // Creator check removed. Non-creators can access edit page to update status.
    // Field-level permissions are handled in TaskForm and Firestore rules.
    router.push(`/tasks/${task.id}/edit`);
  };

  useEffect(() => {
    if (authLoading) {
      setIsFetchingTasks(true); // Keep fetching tasks true while auth is loading
      return;
    }

    if (!user) {
      setIsFetchingTasks(false);
      router.replace('/login'); 
      return;
    }
    
    if (!user.profile) {
      // Profile might still be loading or failed to load, wait for it or handle appropriately.
      // For now, let's assume if user object is there but no profile, it might be an issue.
      // However, critical operations depend on user.uid which is available.
      // If profile is strictly needed for getDashboardTasks, this needs refinement.
      // Assuming getDashboardTasks primarily uses user.uid.
      console.warn("Dashboard: User profile is not loaded. Proceeding with user.uid.");
      // setIsFetchingTasks(false); // Optionally, handle if profile is absolutely necessary before fetch
      // return;
    }

    setIsFetchingTasks(true);
    getDashboardTasks(user.uid) 
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

  }, [user, authLoading, router, toast]);


  const handleDeleteTaskPlaceholder = (taskId: string) => {
     // Actual delete permission is checked on TaskCard and via Firestore rules.
     // This placeholder might be for a different context if needed.
     // For now, direct deletion attempt from here is not the primary path.
     toast({ title: "Delete Action", description: `To delete tasks, please go to the All Tasks page.`});
  };

  if (authLoading || (!user && !authLoading) /* covers initial redirect state before user obj is nullified by context */) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-foreground">Authenticating...</p>
      </div>
    );
  }
  
  // After authLoading is false, if user is still null, it means redirection to login should happen or user is logged out
  if (!user && !authLoading) {
     if (typeof window !== "undefined") router.replace('/login');
     return (
       <div className="flex h-full flex-col items-center justify-center text-center p-6">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Redirecting to Login</h2>
        <p className="text-muted-foreground mb-6">
          Please log in to view your dashboard.
        </p>
        <Button onClick={() => router.push('/login')} variant="outline">
          Go to Login
        </Button>
      </div>
    );
  }
  
  // User object exists, but profile might be missing
  if (user && !user.profile && !authLoading) {
    // This specific check might need re-evaluation based on how critical profile is versus user.uid
    // For now, keep it as it might indicate an incomplete user setup state.
    return (
       <div className="flex h-full flex-col items-center justify-center text-center p-6">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Profile Not Loaded</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Your profile information could not be loaded. This can happen if the profile document is missing or if there are permission issues. Please ensure your database is set up correctly and rules allow profile reads. Refer to `README.md` for setup instructions.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()} variant="outline">
            Refresh Page
          </Button>
           <Button onClick={async () => {
            try {
              await useAuth().logout(); 
            } catch (e) { console.error(e); }
            // router.push('/login'); // Logout itself should redirect via AuthContext
          }} variant="default">
            Logout and Login Again
          </Button>
        </div>
      </div>
    );
  }
  
  if (isFetchingTasks && user) { // Only show task loading if user is present
     return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-foreground">Loading dashboard tasks...</p>
      </div>
    );
  }

  // Fallback if somehow no user but not caught above (should be rare)
  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-foreground">Verifying session...</p>
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
              onEdit={() => handleEditTaskRedirect(task)} // Use updated redirect handler
              onDelete={handleDeleteTaskPlaceholder} // This is a placeholder, actual delete is on All Tasks page
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
  const welcomeName = user.profile?.name || user.displayName || user.email || "User";

  return (
    <div className="container mx-auto py-2">
      <div className="mb-8 p-6 bg-card rounded-lg shadow">
        <h1 className="text-3xl font-bold text-foreground">Welcome back, {welcomeName}!</h1>
        <p className="text-muted-foreground">Here&apos;s a summary of your tasks.</p>
      </div>

      {renderTaskSection("Tasks Assigned to You", dashboardTasks.assignedTasks, Users, "No active tasks currently assigned to you. Great job!", CheckSquare, "/tasks?filter=assigned")}
      {renderTaskSection("Tasks You Created", dashboardTasks.createdTasks, UserPlus, "You haven't created any active tasks yet.", CheckSquare, "/tasks?filter=created")}
      {renderTaskSection("Overdue Tasks", dashboardTasks.overdueTasks, AlertOctagon, "No overdue tasks. Keep it up!", CheckSquare, "/tasks?filter=overdue")}

    </div>
  );
}

