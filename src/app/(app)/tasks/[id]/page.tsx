
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { getDoc, doc, updateDoc, arrayUnion, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Task, Profile, Comment, TaskStatus } from '@/lib/types';
import { TASK_EDITABLE_STATUSES } from '@/lib/constants';
import { processTask, getAllProfilesMap } from '@/lib/taskService'; 
import { Loader2, AlertTriangle, CalendarDays, Users, Tag, MessageSquare, Send, Edit, Trash2, UserCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from '@/components/ui/separator';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
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
import { deleteTask as apiDeleteTask } from '@/lib/taskService';
import { cn } from '@/lib/utils';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, isInitialLoading: authLoading, realtimeTasks } = useAuth(); 
  const { toast } = useToast();

  const taskId = typeof params.id === 'string' ? params.id : null;

  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | undefined>(undefined);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);


  const fetchTaskDetails = async () => {
    if (!taskId || !currentUser) return;
    setIsLoading(true);
    try {
      const taskDocRef = doc(db, 'tasks', taskId);
      const taskSnap = await getDoc(taskDocRef);

      if (taskSnap.exists()) {
        const profilesMap = await getAllProfilesMap();
        const processedTask = await processTask(taskSnap, profilesMap);
        setTask(processedTask);
        setSelectedStatus(processedTask.status === 'Overdue' ? 'To Do' : processedTask.status); 
      } else {
        setError("Task not found.");
        toast({ title: "Error", description: "The requested task could not be found.", variant: "destructive" });
        router.replace('/tasks');
      }
    } catch (e) {
      console.error("Error fetching task details:", e);
      setError("Failed to load task details.");
      toast({ title: "Error", description: "Failed to load task details. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, currentUser, authLoading, router]); 


  useEffect(() => {
    if (taskId && realtimeTasks && realtimeTasks.length > 0) {
      const contextTask = realtimeTasks.find(t => t.id === taskId);
      if (contextTask) {
        if (JSON.stringify(task) !== JSON.stringify(contextTask)) {
          setTask(contextTask);
          if (contextTask.status !== selectedStatus && (contextTask.status !== 'Overdue' || selectedStatus === 'Overdue')) {
            setSelectedStatus(contextTask.status === 'Overdue' ? 'To Do' : contextTask.status);
          }
        }
      } else {
        if (task) { 
            if (!isLoading) {
            }
        }
      }
    }
  }, [realtimeTasks, taskId, task, isLoading, selectedStatus]); 


  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUser || !task) return;
    setIsSubmittingComment(true);
    try {
      const commentToAdd: Comment = {
        userId: currentUser.uid,
        userName: currentUser.profile?.name || currentUser.displayName || "User",
        text: newComment.trim(),
        createdAt: new Date().toISOString(), 
      };
      const taskDocRef = doc(db, 'tasks', task.id);
      await updateDoc(taskDocRef, {
        comments: arrayUnion(commentToAdd),
        updated_at: serverTimestamp(),
      });
      setTask(prevTask => prevTask ? ({
        ...prevTask,
        comments: [...(prevTask.comments || []), commentToAdd].sort((a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()),
        updated_at: new Date().toISOString(), 
      }) : null);
      setNewComment("");
      toast({ title: "Comment Added", description: "Your comment has been posted." });
    } catch (e) {
      console.error("Error adding comment:", e);
      toast({ title: "Error", description: "Failed to add comment.", variant: "destructive" });
    } finally {
      setIsSubmittingComment(false);
    }
  };
  
  const handleStatusUpdate = async (newStatus: TaskStatus) => {
    if (!task || !currentUser || newStatus === task.status) return;
    if (newStatus === "Overdue" && task.status !== "Overdue") {
        toast({ title: "Invalid Status", description: "Cannot manually set status to Overdue.", variant: "destructive" });
        setSelectedStatus(task.status === 'Overdue' ? 'To Do' : task.status);
        return;
    }

    setIsUpdatingStatus(true);
    try {
        const taskDocRef = doc(db, 'tasks', task.id);
        await updateDoc(taskDocRef, {
            status: newStatus,
            updated_at: serverTimestamp(),
        });
        setTask(prev => prev ? ({ ...prev, status: newStatus, updated_at: new Date().toISOString() }) : null);
        setSelectedStatus(newStatus);
        toast({ title: "Status Updated", description: `Task status changed to ${newStatus}.` });
    } catch (e) {
        console.error("Error updating status:", e);
        toast({ title: "Error", description: "Failed to update task status.", variant: "destructive" });
        setSelectedStatus(task.status === 'Overdue' ? 'To Do' : task.status); 
    } finally {
        setIsUpdatingStatus(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!task || !currentUser || currentUser.uid !== task.created_by_id) {
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


  if (isLoading || authLoading) {
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
      <div className="flex h-full items-center justify-center p-4 sm:p-8">
        <p className="text-base sm:text-lg text-muted-foreground">Task data is unavailable.</p>
      </div>
    );
  }

  const isCreator = currentUser?.uid === task.created_by_id;
  const isAssignee = task.assignee_ids?.includes(currentUser?.uid || "");
  const canUpdateStatusOrComment = isCreator || isAssignee;

  const priorityColors: Record<Task["priority"], string> = {
    Low: "bg-blue-500",
    Medium: "bg-yellow-500",
    High: "bg-red-500",
  };
  
  const sortedComments = (task.comments || []).sort((a,b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime());

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
                       <AvatarImage src={`https://avatar.vercel.sh/${comment.userId}.png`} alt={comment.userName} data-ai-hint="profile avatar" />
                       <AvatarFallback>{comment.userName.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 bg-muted/50 p-2 sm:p-3 rounded-lg">
                      <div className="flex justify-between items-center">
                        <p className="text-xs sm:text-sm font-medium text-foreground">{comment.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {comment.createdAt ? formatDistanceToNow(parseISO(comment.createdAt), { addSuffix: true }) : 'Recently'}
                        </p>
                      </div>
                      <p className="text-xs sm:text-sm text-foreground/90 mt-1">{comment.text}</p>
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
                {task.due_date ? format(parseISO(task.due_date), "MMMM d, yyyy") : 'Not set'}
              </div>
            </div>
            <Separator />
            {task.created_by && (
              <div>
                <h4 className="text-sm sm:text-md font-semibold mb-2 text-muted-foreground">Created By</h4>
                <div className="flex items-center space-x-2">
                  <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
                     <AvatarImage src={task.created_by.avatar_url || `https://avatar.vercel.sh/${task.created_by.email || task.created_by.id}.png`} alt={task.created_by.name} data-ai-hint="profile avatar" />
                     <AvatarFallback>{task.created_by.name ? task.created_by.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs sm:text-sm text-foreground">{task.created_by.name || 'Unknown User'}</span>
                </div>
                 <p className="text-xs text-muted-foreground mt-1">
                    On: {task.created_at ? format(parseISO(task.created_at), "MMM d, yyyy, hh:mm a") : 'N/A'}
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
                        <AvatarImage src={assignee.avatar_url || `https://avatar.vercel.sh/${assignee.email || assignee.id}.png`} alt={assignee.name} data-ai-hint="profile avatar"/>
                        <AvatarFallback>{assignee.name ? assignee.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs sm:text-sm text-foreground">{assignee.name || 'Unknown User'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
             <Separator />
             <div>
                 <p className="text-xs text-muted-foreground">
                    {task.updated_at ? `Last updated: ${formatDistanceToNow(parseISO(task.updated_at), { addSuffix: true })}` : 'Last updated: N/A'}
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
            <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

