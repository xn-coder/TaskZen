
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TaskForm } from "@/components/tasks/TaskForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, AlertTriangle } from 'lucide-react';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Task } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";

export default function EditTaskPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isInitialLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const taskId = typeof params.id === 'string' ? params.id : null;
  
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return; // Wait for auth state to resolve

    if (!user) {
      router.replace('/login');
      return;
    }

    if (!taskId) {
      setError("Task ID is missing.");
      setIsLoading(false);
      return;
    }

    const fetchTask = async () => {
      setIsLoading(true);
      try {
        const taskDocRef = doc(db, 'tasks', taskId);
        const taskSnap = await getDoc(taskDocRef);

        if (taskSnap.exists()) {
          const taskData = { id: taskSnap.id, ...taskSnap.data() } as Task;
          // Convert Timestamps to ISO strings if necessary, TaskForm expects Date objects or ISO strings
          if (taskData.due_date && taskData.due_date instanceof Object && 'toDate' in taskData.due_date) {
             taskData.due_date = (taskData.due_date as any).toDate().toISOString();
          }


          if (taskData.created_by_id !== user.uid) {
            setError("You are not authorized to edit this task.");
            toast({
              title: "Permission Denied",
              description: "You can only edit tasks that you created.",
              variant: "destructive",
            });
            router.replace('/tasks'); // Or dashboard
          } else {
            setTask(taskData);
          }
        } else {
          setError("Task not found.");
           toast({
            title: "Error",
            description: "The requested task could not be found.",
            variant: "destructive",
          });
          router.replace('/tasks');
        }
      } catch (e) {
        console.error("Error fetching task:", e);
        setError("Failed to load task details.");
        toast({
          title: "Error",
          description: "Failed to load task details. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTask();
  }, [taskId, user, authLoading, router, toast]);

  if (isLoading || authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-foreground">Loading task...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">Error</h2>
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => router.push('/tasks')} className="mt-4">
          Back to Tasks
        </Button>
      </div>
    );
  }

  if (!task) {
    // This case should ideally be handled by the error state or redirection
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-lg text-muted-foreground">Task data is unavailable.</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-3xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Edit Task</CardTitle>
          <CardDescription>Update the details for your task below.</CardDescription>
        </CardHeader>
        <CardContent>
          <TaskForm initialData={task} isEditing={true} />
        </CardContent>
      </Card>
    </div>
  );
}
