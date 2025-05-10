
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TaskForm } from "@/components/tasks/TaskForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient'; // Import supabase client
import type { Task } from '@/lib/types'; // Using AppTask as Task
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { processTask, getAllProfilesMap } from '@/lib/taskService';


export default function EditTaskPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isInitialLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const taskId = typeof params.id === 'string' ? params.id : null;
  
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    if (authLoading) return; 

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
        const { data: taskDataFromDb, error: fetchError } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', taskId)
          .single();

        if (fetchError) {
          console.error("Error fetching task from Supabase:", fetchError);
          if (fetchError.code === 'PGRST116') { // Resource not found
            setError("Task not found.");
            toast({
              title: "Error",
              description: "The requested task could not be found.",
              variant: "destructive",
            });
            router.replace('/tasks');
          } else {
            throw fetchError;
          }
          return;
        }
        
        if (taskDataFromDb) {
          const profilesMap = await getAllProfilesMap();
          const processedTaskData = await processTask(taskDataFromDb, profilesMap);
          
          const currentUserIsCreator = processedTaskData.created_by_id === user.id;
          setIsCreator(currentUserIsCreator);
          setTask(processedTaskData);
          
        } else {
          // Should be caught by PGRST116, but as a fallback
          setError("Task not found.");
          toast({
            title: "Error",
            description: "The requested task could not be found.",
            variant: "destructive",
          });
          router.replace('/tasks');
        }
      } catch (e: any) {
        console.error("Error processing task fetch:", e);
        setError("Failed to load task details.");
        toast({
          title: "Error",
          description: e.message || "Failed to load task details. Please try again.",
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
          <CardDescription>
            {isCreator ? "Update the details for your task below." : "Update the status of this task."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaskForm initialData={task} isEditing={true} isCreator={isCreator} />
        </CardContent>
      </Card>
    </div>
  );
}
