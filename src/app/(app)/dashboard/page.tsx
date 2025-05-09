
"use client";

import { useEffect, useState, useMemo } from 'react';
import type { Task } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { mockTasks as allMockTasks, getTasksWithResolvedStatus } from '@/lib/store';
import { TaskCard } from '@/components/tasks/TaskCard';
import { Loader2, ListChecks, UserPlus, AlertOctagon, CheckSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// Dummy functions for edit/delete for now, as dashboard is read-only focus
const handleEditTask = (task: Task) => console.log("Edit task:", task.id);
const handleDeleteTask = (taskId: string) => console.log("Delete task:", taskId);

export default function DashboardPage() {
  const { user, isInitialLoading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      // Simulate API call or data fetching
      setTimeout(() => {
        const processedTasks = getTasksWithResolvedStatus(allMockTasks);
        setTasks(processedTasks);
        setIsLoading(false);
      }, 500);
    } else if (!authLoading && !user) {
      router.replace('/login'); // Should be handled by ProtectedRoute, but good as fallback
    }
  }, [user, authLoading, router]);

  const { assignedTasks, createdTasks, overdueTasks } = useMemo(() => {
    if (!user) return { assignedTasks: [], createdTasks: [], overdueTasks: [] };
    
    const assigned = tasks.filter(task => task.assigneeId === user.id && task.status !== 'Done');
    const created = tasks.filter(task => task.createdById === user.id && task.status !== 'Done');
    const overdue = tasks.filter(task => 
      (task.assigneeId === user.id || task.createdById === user.id) && task.status === 'Overdue'
    );
    
    return { assignedTasks: assigned, createdTasks: created, overdueTasks: overdue };
  }, [tasks, user]);

  if (isLoading || authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; // Or redirect, handled by ProtectedRoute
  }

  const renderTaskSection = (title: string, tasksToDisplay: Task[], IconComponent: React.ElementType, emptyMessage: string, EmptyIconComponent?: React.ElementType) => (
    <section className="mb-8">
      <h2 className="mb-4 text-2xl font-semibold flex items-center">
        <span className="mr-2 p-2 bg-primary/10 text-primary rounded-lg">
          <IconComponent size={24} />
        </span>
        {title} ({tasksToDisplay.length})
      </h2>
      {tasksToDisplay.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tasksToDisplay.slice(0,4).map(task => ( // Display max 4 tasks, with a link to see all
            <TaskCard key={task.id} task={task} onEdit={handleEditTask} onDelete={handleDeleteTask} />
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
      {tasksToDisplay.length > 4 && (
         <div className="mt-4 text-right">
            <Button asChild variant="outline">
                <Link href="/tasks">View All {title}</Link>
            </Button>
         </div>
      )}
    </section>
  );

  return (
    <div className="container mx-auto py-2">
      <div className="mb-8 p-6 bg-card rounded-lg shadow">
        <h1 className="text-3xl font-bold text-foreground">Welcome back, {user.name}!</h1>
        <p className="text-muted-foreground">Here&apos;s a summary of your tasks.</p>
      </div>

      {renderTaskSection("Tasks Assigned to You", assignedTasks, ListChecks, "No tasks currently assigned to you. Great job!", CheckSquare)}
      {renderTaskSection("Tasks You Created", createdTasks, UserPlus, "You haven't created any active tasks yet.", CheckSquare)}
      {renderTaskSection("Overdue Tasks", overdueTasks, AlertOctagon, "No overdue tasks. Keep it up!", CheckSquare)}

    </div>
  );
}
