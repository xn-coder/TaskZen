"use client";

import type { PostgrestError } from "@supabase/supabase-js";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import type { Task, Profile, Comment, TaskStatus } from "@/lib/types";
import { TASK_EDITABLE_STATUSES } from "@/lib/constants";
import { processTask, getAllProfilesMap, updateTask as apiUpdateTask, deleteTask as apiDeleteTask } from "@/lib/taskService";
import { Loader2, AlertTriangle, CalendarDays, Users, Tag, MessageSquare, Send, Edit, Trash2, UserCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import Link from "next/link";
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
import { cn } from "@/lib/utils";

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, isInitialLoading: authLoading, realtimeTasks } = useAuth();
  const { toast } = useToast();

  const taskId = typeof params.id === "string" ? params.id : null;

  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | undefined>(undefined);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const sortedComments = useMemo(() => {
    if (!task || !task.comments) {
      return [];
    }
    return [...(Array.isArray(task.comments) ? task.comments : [])].sort((a, b) => {
        const dateA = a.createdAt ? parseISO(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? parseISO(b.createdAt).getTime() : 0;
        return dateB - dateA; 
    });
  }, [task?.comments]);

  const fetchTaskDetails = useCallback(async () => {
    if (!taskId || !currentUser?.id) { // Ensure currentUser.id is also checked
        if(!taskId) setError("Task ID is missing.");
        if(!currentUser?.id) setError("User not available for fetching task.");
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { data: taskDataFromDb, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (fetchError) {
        console.error("Error fetching task from Supabase:", fetchError);
        if (fetchError.code === 'PGRST116') { 
          setError("Task not found.");
          toast({
            title: "Error",
            description: "The requested task could not be found.",
            variant: "destructive",
          });
          setIsLoading(false); 
          router.replace('/tasks');
          return; 
        } else {
          throw fetchError; 
        }
      }
      
      if (taskDataFromDb) {
        const profilesMap = await getAllProfilesMap();
        const processedTask = await processTask(taskDataFromDb, profilesMap);
        setTask(processedTask);
        setSelectedStatus(processedTask.status === "Overdue" ? "To Do" : processedTask.status);
      } else {
        throw { code: 'CUSTOM_NO_DATA', message: 'Task data not returned from database.' };
      }
    } catch (e: any) {
      let uiError = "Failed to load task details.";
      let toastMessage = "An unexpected error occurred. Please try again.";
      let errorTitle = "Error Loading Task";
      
      console.error("Full error object in fetchTaskDetails:", e); 

      const pgError = e as PostgrestError;

      if (e && typeof e === 'object') {
        if (pgError.code === 'PGRST116' || e.code === 'CUSTOM_NO_DATA') { 
          uiError = "Task not found.";
          toastMessage = "The requested task could not be found.";
          errorTitle = "Task Not Found";
        } else if (pgError.message || pgError.code) { 
          uiError = `Error: ${pgError.message || `Code ${pgError.code}`}`;
          toastMessage = pgError.message || `An error occurred (Code: ${pgError.code}).`;
          if (pgError.details) toastMessage += ` Details: ${pgError.details}`;
          if (pgError.hint) toastMessage += ` Hint: ${pgError.hint}`;
        } else { // Covers empty error objects or other non-Postgrest object errors
          uiError = "An unexpected error occurred while fetching task details.";
          toastMessage = "Please check the console for more information or try again later.";
        }
      } else if (typeof e === 'string') {
        uiError = e;
        toastMessage = e;
      }

      setError(uiError);
      toast({
        title: errorTitle,
        description: toastMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false); 
    }
  }, [taskId, currentUser?.id, router, toast]); 

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.replace('/login');
      return;
    }
    if (taskId) {
      fetchTaskDetails();
    } else {
      setError("Task ID is missing.");
      setIsLoading(false);
    }
  }, [taskId, currentUser, authLoading, router, fetchTaskDetails]);


  useEffect(() => {
    if (!taskId) return;

    const contextTask = realtimeTasks.find(t => t.id === taskId);

    if (contextTask) {
      // If task found in realtime context
      if (!task || (task.updated_at !== contextTask.updated_at)) {
        setTask(contextTask);
        const newStatus = contextTask.status === "Overdue" ? "To Do" : contextTask.status;
        if (selectedStatus !== newStatus) {
            setSelectedStatus(newStatus);
        }
      }
      // If we were loading and found the task in context, stop loading and clear errors
      if (isLoading) {
        setIsLoading(false);
        setError(null);
      }
    } else if (!isLoading && task?.id === taskId && !error) {
      // Task was previously loaded but is no longer in realtimeTasks (e.g., deleted, access revoked)
      // And we are not currently loading, and there's no existing error for this task
      console.warn(`TaskDetailPage: Task ${taskId} disappeared from realtimeTasks or access potentially revoked.`);
      setError("Task not found or access has changed. It might have been deleted.");
      // Optionally, navigate away or show a more permanent "not found" state
      // router.replace('/tasks'); 
    }
  }, [realtimeTasks, taskId, task, isLoading, error, router, selectedStatus]);


  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUser || !task) return;
    setIsSubmittingComment(true);
    try {
      await apiUpdateTask(task.id, {}, newComment.trim(), currentUser);
      setNewComment(""); 
      toast({ title: "Comment Added", description: "Your comment has been posted." });
    } catch (e: any) {
      console.error("Error adding comment:", e);
      toast({ title: "Error", description: e.message || "Failed to add comment.", variant: "destructive" });
    } finally {
      setIsSubmittingComment(false);
    }
  };
  
  const handleStatusUpdate = async (newStatus: TaskStatus) => {
    if (!task || !currentUser || newStatus === task.status) return;
    if (newStatus === "Overdue" && task.status !== "Overdue") {
        toast({ title: "Invalid Status", description: "Cannot manually set status to Overdue.", variant: "destructive" });
        setSelectedStatus(task.status === "Overdue" ? "To Do" : task.status);
        return;
    }

    setIsUpdatingStatus(true);
    try {
        const commentText = `Status changed from ${task.status} to ${newStatus}.`;
        await apiUpdateTask(task.id, { status: newStatus as Exclude<TaskStatus, "Overdue"> }, commentText, currentUser);
        toast({ title: "Status Updated", description: `Task status changed to ${newStatus}.` });
    } catch (e: any) {
        console.error("Error updating status:", e);
        toast({ title: "Error", description: e.message || "Failed to update task status.", variant: "destructive" });
        setSelectedStatus(task.status === "Overdue" ? "To Do" : task.status); 
    } finally {
        setIsUpdatingStatus(false);
    }
  };

  const handleDeleteTaskAction = async () => {
    if (!task || !currentUser || currentUser.id !== task.created_by_id) {
      toast({ title: "Permission Denied", description: "Only the task creator can delete this task.", variant: "destructive" });
      setShowDeleteConfirm(false);
      return;
    }
    try {
      await apiDeleteTask(task.id);
      toast({ title: "Task Deleted", description: `Task "${task.title}" has been deleted.` });
      router.push('/tasks'); 
    } catch (error: any) {
      toast({ title: "Error Deleting Task", description: error.message || "Could not delete task.", variant: "destructive" });
    } finally {
      setShowDeleteConfirm(false);
    }
  };


  if (isLoading || authLoading) { // Check authLoading as well
    return (
      <div className="flex h-full items-center justify-center p-4 sm:p-8">
        <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 animate-spin text-primary" />
        <p className="ml-3 text-base sm:text-lg text-foreground">Loading task details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 text-center p-4 sm:p-8">
        <AlertTriangle className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-destructive mb-4" />
        <h2 className="text-lg sm:text-xl font-semibold text-destructive mb-2">Error</h2>
        <p className="text-sm sm:text-base text-muted-foreground">{error}</p>
        <Button onClick={() => router.push('/tasks')} className="mt-4">
          Back to Tasks
        </Button>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="container mx-auto py-8 text-center p-4 sm:p-8">
        <AlertTriangle className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2">Task Not Found</h2>
        <p className="text-sm sm:text-base text-muted-foreground">The task data could not be loaded. It might have been deleted or you may not have access.</p>
        <Button onClick={() => router.push('/tasks')} className="mt-4">
          Back to Tasks
        </Button>
      </div>
    );
  }

  const isCreator = currentUser?.id === task.created_by_id;
  const isAssignee = task.assignee_ids?.includes(currentUser?.id || "");
  const canUpdateStatusOrComment = isCreator || isAssignee;

  const priorityColors: Record<Task["priority"], string> = {
    Low: "bg-blue-500",
    Medium: "bg-yellow-500",
    High: "bg-red-500",
  };
  

  return (
    <div className="container mx-auto py-4 sm:py-8">
      <Card className="max-w-4xl mx-auto shadow-xl">
        <CardHeader className="border-b p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start">
            <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 sm:mb-0">{task.title}</CardTitle>
            {isCreator && (
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => router.push(`/tasks/${task.id}/edit`)}>
                  <Edit className="mr-1 sm:mr-2 h-4 w-4" /> Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="mr-1 sm:mr-2 h-4 w-4" /> Delete
                </Button>
              </div>
            )}
          </div>
          {task.description && (
            <CardDescription className="text-sm sm:text-md text-muted-foreground pt-2">{task.description}</CardDescription>
          )}
        </CardHeader>

        <CardContent className="pt-6 grid md:grid-cols-3 gap-6 p-4 sm:p-6">
          <div className="md:col-span-2 space-y-6">
            <div>
              <h3 className="text-md sm:text-lg font-semibold mb-3 text-foreground">Comments</h3>
              <div className="space-y-4 max-h-72 sm:max-h-96 overflow-y-auto pr-2">
                {sortedComments.length > 0 ? sortedComments.map((comment, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <Avatar className="h-6 w-6 sm:h-8 sm:w-8 mt-1">
                       <AvatarImage src={`https://avatar.vercel.sh/${comment.userId}.png?u=${comment.userId}`} alt={comment.userName} data-ai-hint="profile avatar" />
                       <AvatarFallback>{comment.userName ? comment.userName.charAt(0).toUpperCase() : "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 bg-muted/50 p-2 sm:p-3 rounded-lg">
                      <div className="flex justify-between items-center">
                        <p className="text-xs sm:text-sm font-medium text-foreground">{comment.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {comment.createdAt ? formatDistanceToNow(parseISO(comment.createdAt), { addSuffix: true }) : "Recently"}
                        </p>
                      </div>
                      <p className="text-xs sm:text-sm text-foreground/90 mt-1 whitespace-pre-wrap break-words">{comment.text}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                )}
              </div>
            </div>

            {canUpdateStatusOrComment && (
              <div>
                <Separator className="my-4 sm:my-6" />
                <h3 className="text-md sm:text-lg font-semibold mb-3 text-foreground">Add Comment</h3>
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Type your comment..."
                  rows={3}
                  className="mb-2 text-sm sm:text-base"
                  disabled={isSubmittingComment}
                />
                <Button onClick={handleAddComment} disabled={isSubmittingComment || !newComment.trim()} size="sm">
                  {isSubmittingComment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Send className="mr-2 h-4 w-4" /> Post Comment
                </Button>
              </div>
            )}
          </div>

          <aside className="md:col-span-1 space-y-4 sm:space-y-6 md:border-l md:pl-6">
            <div>
              <h4 className="text-sm sm:text-md font-semibold mb-2 text-muted-foreground">Status</h4>
              {canUpdateStatusOrComment ? (
                <Select
                    value={selectedStatus}
                    onValueChange={(value) => handleStatusUpdate(value as TaskStatus)}
                    disabled={isUpdatingStatus}
                >
                    <SelectTrigger className="w-full text-sm sm:text-base">
                        <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                        {TASK_EDITABLE_STATUSES.map(s => (
                            <SelectItem key={s} value={s} className="text-sm sm:text-base">{s}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              ) : (
                 <Badge variant={task.status === "Done" ? "default" : task.status === "Overdue" ? "destructive" : "secondary" }
                   className={cn(`text-xs sm:text-sm`, task.status === "Done" ? "bg-green-500 text-primary-foreground" : task.status === "Overdue" ? "bg-orange-500 text-primary-foreground" : "" )}
                 >
                    {task.status}
                </Badge>
              )}
               {isUpdatingStatus && <Loader2 className="mt-2 h-4 w-4 animate-spin text-primary" />}
            </div>
            <Separator />
            <div>
              <h4 className="text-sm sm:text-md font-semibold mb-2 text-muted-foreground">Priority</h4>
              <Badge className={cn(`text-xs sm:text-sm text-white`, priorityColors[task.priority])}>{task.priority}</Badge>
            </div>
            <Separator />
            <div>
              <h4 className="text-sm sm:text-md font-semibold mb-2 text-muted-foreground">Due Date</h4>
              <div className="flex items-center text-xs sm:text-sm text-foreground">
                <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                {task.due_date ? format(parseISO(task.due_date), "MMMM d, yyyy") : "Not set"}
              </div>
            </div>
            <Separator />
            {task.created_by && (
              <div>
                <h4 className="text-sm sm:text-md font-semibold mb-2 text-muted-foreground">Created By</h4>
                <div className="flex items-center space-x-2">
                  <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
                     <AvatarImage src={task.created_by.avatar_url || `https://avatar.vercel.sh/${task.created_by.email || task.created_by.id}.png?u=${task.created_by_id}`} alt={task.created_by.name || "User"} data-ai-hint="profile avatar" />
                     <AvatarFallback>{task.created_by.name ? task.created_by.name.charAt(0).toUpperCase() : "U"}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs sm:text-sm text-foreground">{task.created_by.name || "Unknown User"}</span>
                </div>
                 <p className="text-xs text-muted-foreground mt-1">
                    On: {task.created_at ? format(parseISO(task.created_at), "MMM d, yyyy, hh:mm a") : "N/A"}
                </p>
              </div>
            )}
            <Separator />
            {task.assignees && task.assignees.length > 0 && (
              <div>
                <h4 className="text-sm sm:text-md font-semibold mb-2 text-muted-foreground">Assignees</h4>
                <div className="space-y-2">
                  {task.assignees.map(assignee => (
                    <div key={assignee.id} className="flex items-center space-x-2">
                      <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
                        <AvatarImage src={assignee.avatar_url || `https://avatar.vercel.sh/${assignee.email || assignee.id}.png?u=${assignee.id}`} alt={assignee.name || "User"} data-ai-hint="profile avatar"/>
                        <AvatarFallback>{assignee.name ? assignee.name.charAt(0).toUpperCase() : "U"}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs sm:text-sm text-foreground">{assignee.name || "Unknown User"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
             <Separator />
             <div>
                 <p className="text-xs text-muted-foreground">
                    {task.updated_at ? `Last updated: ${formatDistanceToNow(parseISO(task.updated_at), { addSuffix: true })}` : "Last updated: N/A"}
                </p>
             </div>
          </aside>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the task "{task.title}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTaskAction} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
