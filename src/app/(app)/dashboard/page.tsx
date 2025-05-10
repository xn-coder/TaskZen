
"use client";

import { useEffect, useMemo, useCallback } from 'react'; 
import type { Task } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { TaskCard } from '@/components/tasks/TaskCard';
import { Loader2, ListChecks, UserPlus, AlertOctagon, CheckSquare, AlertTriangle, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";


export default function DashboardPage() {
  const { user, isInitialLoading: authLoading, realtimeTasks, areRealtimeTasksLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleEditTaskRedirect = useCallback((task: Task) => {
    router.push(`/tasks/${task.id}/edit`);
  }, [router]);
  
  const handleDeleteTaskPlaceholder = useCallback((taskId: string) => {
     toast({ title: "Delete Action", description: `To delete tasks, please go to the All Tasks page.`});
  }, [toast]);
  
  const dashboardData = useMemo(() => {
    if (!user || !user.uid || !realtimeTasks) return { assignedTasks: [], createdTasks: [], overdueTasks: [] };
    
    const assignedToUser = realtimeTasks.filter(
      task => task.assignee_ids.includes(user.uid) && task.status !== 'Done' && task.status !== 'Overdue'
    );
    const createdByUser = realtimeTasks.filter(
      task => task.created_by_id === user.uid && task.status !== 'Done' && task.status !== 'Overdue'
    );
    const overdue = realtimeTasks.filter(task => task.status === 'Overdue');
    
    return { assignedTasks: assignedToUser, createdTasks: createdByUser, overdueTasks: overdue };
  }, [realtimeTasks, user]);


  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-foreground">Authenticating...</p>
      </div>
    );
  }
  
  if (!user && !authLoading) {
     if (typeof window !== "undefined") router.replace('/login');
     return (
       <div className="flex h-full flex-col items-center justify-center text-center p-4 sm:p-6">
        <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-destructive mb-4" />
        <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2">Redirecting to Login</h2>
        <p className="text-sm sm:text-base text-muted-foreground mb-6">
          Please log in to view your dashboard.
        </p>
        <Button onClick={() => router.push('/login')} variant="outline">
          Go to Login
        </Button>
      </div>
    );
  }
  
  if (user && !user.profile && !authLoading) {
    return (
       <div className="flex h-full flex-col items-center justify-center text-center p-4 sm:p-6">
        <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-destructive mb-4" />
        <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2">Profile Not Loaded</h2>
        <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-md">
          Your profile information could not be loaded. This can happen if the profile document is missing or if there are permission issues. Please ensure your database is set up correctly and rules allow profile reads. Refer to `README.md` for setup instructions.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={() => window.location.reload()} variant="outline">
            Refresh Page
          </Button>
           <Button onClick={async () => {
            try {
              await useAuth().logout(); 
            } catch (e) { console.error(e); }
          }} variant="default">
            Logout and Login Again
          </Button>
        </div>
      </div>
    );
  }
  
  if (user && areRealtimeTasksLoading && !authLoading) { 
     return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-foreground">Loading dashboard tasks...</p>
      </div>
    );
  }

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <h2 className="text-xl sm:text-2xl font-semibold flex items-center mb-2 sm:mb-0">
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
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tasksToDisplay.slice(0,4).map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={() => handleEditTaskRedirect(task)}
              onDelete={handleDeleteTaskPlaceholder} 
            />
          ))}
        </div>
      ) : (
        <Card className="p-4 sm:p-6 text-center text-muted-foreground border-dashed border-muted-foreground/30 rounded-lg bg-card">
          {EmptyIconComponent && <EmptyIconComponent size={48} className="mx-auto mb-4 text-muted-foreground/50" />}
          <p className="text-sm sm:text-base">{emptyMessage}</p>
          <Button asChild variant="link" className="mt-2 text-primary text-sm sm:text-base">
            <Link href="/tasks/create">Create a new task</Link>
          </Button>
        </Card>
      )}
    </section>
  );
  const welcomeName = user.profile?.name || user.displayName || user.email || "User";

  return (
    <div className="container mx-auto py-2">
      <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-card rounded-lg shadow">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Welcome back, {welcomeName}!</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Here&apos;s a summary of your tasks.</p>
      </div>

      {renderTaskSection("Tasks Assigned to You", dashboardData.assignedTasks, Users, "No active tasks currently assigned to you. Great job!", CheckSquare, "/tasks?filter=assigned")}
      {renderTaskSection("Tasks You Created", dashboardData.createdTasks, UserPlus, "You haven't created any active tasks yet.", CheckSquare, "/tasks?filter=created")}
      {renderTaskSection("Overdue Tasks", dashboardData.overdueTasks, AlertOctagon, "No overdue tasks. Keep it up!", CheckSquare, "/tasks?filter=overdue")}

    </div>
  );
}

