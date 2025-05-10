
"use client";

import type { Task, Profile, Comment } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CalendarDays, Edit3, Trash2, Users, AlertTriangle, CheckCircle2, Zap, MessageSquare } from "lucide-react"; 
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { Separator } from "@/components/ui/separator";

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  className?: string;
}

const priorityColors: Record<Task["priority"], string> = {
  Low: "bg-blue-500 hover:bg-blue-600",
  Medium: "bg-yellow-500 hover:bg-yellow-600",
  High: "bg-red-500 hover:bg-red-600",
};

const statusIcons: Record<Task["status"], React.ElementType> = {
  "To Do": Zap,
  "In Progress": Zap, 
  Done: CheckCircle2,
  Overdue: AlertTriangle,
};


export function TaskCard({ task, onEdit, onDelete, className }: TaskCardProps) {
  const { user } = useAuth();
  const StatusIcon = statusIcons[task.status] || Zap;

  const creatorName = task.created_by?.name || "Unknown Creator";
  
  const getAvatarFallback = (name: string | undefined) => {
    return name ? name.charAt(0).toUpperCase() : 'U';
  }

  const canDelete = user?.uid === task.created_by_id;
  // User can edit if they are creator or an assignee (for status update and comments)
  const canEdit = user?.uid === task.created_by_id || (task.assignee_ids && task.assignee_ids.includes(user?.uid || ""));


  return (
    <TooltipProvider>
    <Card className={cn("flex flex-col shadow-md hover:shadow-lg transition-shadow duration-200", className)}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold leading-tight">{task.title}</CardTitle>
          <Badge variant="secondary" className={cn("text-xs text-white", priorityColors[task.priority])}>
            {task.priority}
          </Badge>
        </div>
        <CardDescription className="text-sm text-muted-foreground mt-1 line-clamp-2">
          {task.description || "No description provided."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-3">
        <div className="flex items-center text-sm text-muted-foreground">
          <CalendarDays className="mr-2 h-4 w-4" />
          <span>Due: {task.due_date ? format(parseISO(task.due_date), "MMM d, yyyy") : 'N/A'}</span>
        </div>
        
        <div className="flex items-center text-sm">
           <StatusIcon className={cn("mr-2 h-4 w-4", 
            task.status === "Done" ? "text-green-500" :
            task.status === "Overdue" ? "text-orange-500" :
            task.status === "In Progress" ? "text-sky-500" :
            "text-muted-foreground"
          )} />
          <Badge variant="outline" className={cn(
              task.status === "Done" ? "border-green-500 text-green-600" :
              task.status === "Overdue" ? "border-orange-500 text-orange-600" :
              task.status === "In Progress" ? "border-sky-500 text-sky-600" :
              ""
            )}>
            {task.status}
          </Badge>
        </div>

        {task.assignees && task.assignees.length > 0 && (
          <div className="flex items-center text-sm text-muted-foreground">
            <Users className="mr-2 h-4 w-4" />
            <span>Assigned to:</span>
            <div className="ml-2 flex -space-x-2 overflow-hidden">
              {task.assignees.slice(0, 3).map(assignee => (
                <Tooltip key={assignee.id}>
                  <TooltipTrigger asChild>
                    <Avatar className="h-6 w-6 border-2 border-card hover:z-10">
                      <AvatarImage 
                        src={assignee.avatar_url || `https://avatar.vercel.sh/${assignee.email || assignee.id}.png`} 
                        alt={assignee.name} data-ai-hint="profile avatar"/>
                      <AvatarFallback>{getAvatarFallback(assignee.name)}</AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent><p>{assignee.name}</p></TooltipContent>
                </Tooltip>
              ))}
              {task.assignees.length > 3 && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Avatar className="h-6 w-6 border-2 border-card">
                            <AvatarFallback>+{task.assignees.length - 3}</AvatarFallback>
                        </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{task.assignees.slice(3).map(a => a.name).join(', ')}</p>
                    </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        )}
         {task.created_by_id && task.created_by && ( 
          <div className="flex items-center text-xs text-muted-foreground/80 pt-1">
            <span>Created by: {creatorName}</span>
          </div>
        )}

        {task.comments && task.comments.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <h4 className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center">
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
              Recent Comments ({task.comments.length})
            </h4>
            <div className="space-y-1.5 max-h-20 overflow-y-auto text-xs">
              {task.comments.slice(-2).map((comment, index) => ( // Show last 2 comments
                <div key={index} className="p-1.5 bg-muted/50 rounded-md">
                  <p className="font-medium text-foreground/80">{comment.userName}:</p>
                  <p className="text-muted-foreground line-clamp-2">{comment.text}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{format(parseISO(comment.createdAt), "MMM d, hh:mm a")}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </CardContent>
      <CardFooter className="flex justify-end space-x-2 border-t pt-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={canEdit ? undefined : 0}>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onEdit(task)}
                disabled={!canEdit}
                aria-disabled={!canEdit}
              >
                <Edit3 className="mr-1 h-4 w-4" /> 
                {user?.uid === task.created_by_id ? "Edit" : "Update Status"}
              </Button>
            </span>
          </TooltipTrigger>
          {!canEdit && (
            <TooltipContent>
              <p>You do not have permission to edit this task.</p>
            </TooltipContent>
          )}
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={canDelete ? undefined : 0}> 
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => onDelete(task.id)}
                disabled={!canDelete}
                aria-disabled={!canDelete}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Delete
              </Button>
            </span>
          </TooltipTrigger>
          {!canDelete && (
            <TooltipContent>
              <p>Only the task creator can delete this task.</p>
            </TooltipContent>
          )}
        </Tooltip>
      </CardFooter>
    </Card>
    </TooltipProvider>
  );
}
