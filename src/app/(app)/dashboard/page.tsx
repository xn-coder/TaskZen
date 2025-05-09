
"use client";

import { useEffect, useState, useMemo } from 'react';
import type { Task } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { getDashboardTasks } from '@/lib/taskService'; // Use taskService
import { TaskCard } from '@/components/tasks/TaskCard';
import { Loader2, ListChecks, UserPlus, AlertOctagon, CheckSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";


// Dummy functions for edit/delete for now, as dashboard is read-only focus
// Actual edit/delete will be handled on the full /tasks page or specific task edit page.
const handleEditTaskRedirect = (task: Task, router: ReturnType<typeof useRouter>) => {
  // For now, let's assume edit will be handled on a dedicated page or modal opened from /tasks
  // This is a placeholder.
  // router.push(`/tasks/edit/${task.id}`); // Example redirect
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
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();


  useEffect(() => {
    if (!authLoading && user && user.profile) { // Ensure user and profile are loaded
      setIsLoading(true);
      getDashboardTasks(user.id) // Pass user.id (Supabase auth user ID)
        .then(data => {
          setDashboardTasks(data);
        })
        .catch(error => {
          console.error("Failed to load dashboard tasks:", error);
          toast({ title: "Error", description: "Could not load dashboard tasks.", variant: "destructive" });
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (!authLoading && !user) {
      router.replace('/login'); 
    }
  }, [user, authLoading, router, toast]);


  // handleDeleteTask is not a primary feature of the dashboard view.
  // It will be available on the /tasks page.
  const handleDeleteTaskPlaceholder = (taskId: string) => {
     toast({ title: "Delete Action", description: `To delete tasks, please go to the All Tasks page.`});
  };


  if (isLoading || authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !user.profile) { // Redirect if no user/profile after loading
    return null; 
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
