
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { getDoc, doc, updateDoc, arrayUnion, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Task, Profile, Comment, TaskStatus } from '@/lib/types';
import { TASK_EDITABLE_STATUSES } from '@/lib/constants';
import { processTask, getAllProfilesMap } from '@/lib/taskService'; // Assuming these helpers are exported
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

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, isInitialLoading: authLoading } = useAuth();
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
        setSelectedStatus(processedTask.status === 'Overdue' ? 'To Do' : processedTask.status); // Default to 'To Do' if Overdue for select
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
  }, [taskId, currentUser, authLoading, router, toast]);


  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUser || !task) return;
    setIsSubmittingComment(true);
    try {
      const commentToAdd: Comment = {
        userId: currentUser.uid,
        userName: currentUser.profile?.name || currentUser.displayName || "User",
        text: newComment.trim(),
        createdAt: new Date().toISOString(), // ISO string
      };
      const taskDocRef = doc(db, 'tasks', task.id);
      await updateDoc(taskDocRef, {
        comments: arrayUnion(commentToAdd),
        updated_at: serverTimestamp(),
      });
      setTask(prevTask => prevTask ? ({
        ...prevTask,
        comments: [...(prevTask.comments || []), commentToAdd].sort((a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()),
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
    // Prevent updating to "Overdue" manually
    if (newStatus === "Overdue" && task.status !== "Overdue") {
        toast({ title: "Invalid Status", description: "Cannot manually set status to Overdue.", variant: "destructive" });
        setSelectedStatus(task.status === 'Overdue' ? 'To Do' : task.status); // Reset select
        return;
    }

    setIsUpdatingStatus(true);
    try {
        const taskDocRef = doc(db, 'tasks', task.id);
        await updateDoc(taskDocRef, {
            status: newStatus,
            updated_at: serverTimestamp(),
        });
        // Optimistically update local state, or refetch if consistency is critical
        setTask(prev => prev ? ({ ...prev, status: newStatus, updated_at: new Date().toISOString() }) : null);
        setSelectedStatus(newStatus);
        toast({ title: "Status Updated", description: `Task status changed to ${newStatus}.` });
    } catch (e) {
        console.error("Error updating status:", e);
        toast({ title: "Error", description: "Failed to update task status.", variant: "destructive" });
        setSelectedStatus(task.status === 'Overdue' ? 'To Do' : task.status); // Revert on error
    } finally {
        setIsUpdatingStatus(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!task || !currentUser || currentUser.uid !== task.created_by_id) return;
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
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-foreground">Loading task details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 text-center p-8">
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
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-lg text-muted-foreground">Task data is unavailable.</p>
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
    <div className="container mx-auto py-8">
      <Card className="max-w-4xl mx-auto shadow-xl">
        <CardHeader className="border-b">
          <div className="flex justify-between items-start">
            <CardTitle className="text-3xl font-bold">{task.title}</CardTitle>
            {isCreator && (
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => router.push(`/tasks/${task.id}/edit`)}>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </div>
            )}
          </div>
          {task.description && (
            <CardDescription className="text-md text-muted-foreground pt-2">{task.description}</CardDescription>
          )}
        </CardHeader>

        <CardContent className="pt-6 grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3 text-foreground">Comments</h3>
              <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {sortedComments.length > 0 ? sortedComments.map((comment, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <Avatar className="h-8 w-8 mt-1">
                       <AvatarImage src={`https://avatar.vercel.sh/${comment.userId}.png`} alt={comment.userName} data-ai-hint="profile avatar" />
                       <AvatarFallback>{comment.userName.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 bg-muted/50 p-3 rounded-lg">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-medium text-foreground">{comment.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(parseISO(comment.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <p className="text-sm text-foreground/90 mt-1">{comment.text}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                )}
              </div>
            </div>

            {canUpdateStatusOrComment && (
              <div>
                <Separator className="my-6" />
                <h3 className="text-lg font-semibold mb-3 text-foreground">Add Comment</h3>
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Type your comment..."
                  rows={3}
                  className="mb-2"
                  disabled={isSubmittingComment}
                />
                <Button onClick={handleAddComment} disabled={isSubmittingComment || !newComment.trim()}>
                  {isSubmittingComment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Send className="mr-2 h-4 w-4" /> Post Comment
                </Button>
              </div>
            )}
          </div>

          <aside className="md:col-span-1 space-y-6 border-l md:pl-6">
            <div>
              <h4 className="text-md font-semibold mb-2 text-muted-foreground">Status</h4>
              {canUpdateStatusOrComment ? (
                <Select 
                    value={selectedStatus} 
                    onValueChange={(value) => handleStatusUpdate(value as TaskStatus)}
                    disabled={isUpdatingStatus}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                        {TASK_EDITABLE_STATUSES.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              ) : (
                 <Badge variant={task.status === "Done" ? "default" : task.status === "Overdue" ? "destructive" : "secondary" }
                   className={`text-sm ${task.status === "Done" ? "bg-green-500" : task.status === "Overdue" ? "bg-orange-500" : "" }`}
                 >
                    {task.status}
                </Badge>
              )}
               {isUpdatingStatus && <Loader2 className="mt-2 h-4 w-4 animate-spin text-primary" />}
            </div>
            <Separator />
            <div>
              <h4 className="text-md font-semibold mb-2 text-muted-foreground">Priority</h4>
              <Badge className={`text-sm text-white ${priorityColors[task.priority]}`}>{task.priority}</Badge>
            </div>
            <Separator />
            <div>
              <h4 className="text-md font-semibold mb-2 text-muted-foreground">Due Date</h4>
              <div className="flex items-center text-sm text-foreground">
                <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                {task.due_date ? format(parseISO(task.due_date), "MMMM d, yyyy") : 'Not set'}
              </div>
            </div>
            <Separator />
            {task.created_by && (
              <div>
                <h4 className="text-md font-semibold mb-2 text-muted-foreground">Created By</h4>
                <div className="flex items-center space-x-2">
                  <Avatar className="h-8 w-8">
                     <AvatarImage src={task.created_by.avatar_url || `https://avatar.vercel.sh/${task.created_by.email || task.created_by.id}.png`} alt={task.created_by.name} data-ai-hint="profile avatar" />
                     <AvatarFallback>{task.created_by.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-foreground">{task.created_by.name}</span>
                </div>
                 <p className="text-xs text-muted-foreground mt-1">
                    On: {format(parseISO(task.created_at), "MMM d, yyyy, hh:mm a")}
                </p>
              </div>
            )}
            <Separator />
            {task.assignees && task.assignees.length > 0 && (
              <div>
                <h4 className="text-md font-semibold mb-2 text-muted-foreground">Assignees</h4>
                <div className="space-y-2">
                  {task.assignees.map(assignee => (
                    <div key={assignee.id} className="flex items-center space-x-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={assignee.avatar_url || `https://avatar.vercel.sh/${assignee.email || assignee.id}.png`} alt={assignee.name} data-ai-hint="profile avatar"/>
                        <AvatarFallback>{assignee.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-foreground">{assignee.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
             <Separator />
             <div>
                 <p className="text-xs text-muted-foreground">
                    Last updated: {formatDistanceToNow(parseISO(task.updated_at), { addSuffix: true })}
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
            <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
