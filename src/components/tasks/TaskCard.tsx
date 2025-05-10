
"use client";

import * as React from 'react'; 
import type { Task } from "@/lib/types";
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
import { CalendarDays, Edit3, Trash2, Users, AlertTriangle, CheckCircle2, Zap } from "lucide-react"; 
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

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


const TaskCardComponent = ({ task, onEdit, onDelete, className }: TaskCardProps) => {
  const { user } = useAuth();
  const router = useRouter();
  const StatusIcon = statusIcons[task.status] || Zap;

  const creatorName = task.created_by?.name || "Unknown Creator";
  
  const getAvatarFallback = (name: string | undefined) => {
    return name ? name.charAt(0).toUpperCase() : 'U';
  }

  const canDelete = user?.uid === task.created_by_id;
  const canEditTaskDetails = user?.uid === task.created_by_id; 

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent navigation if a button inside the card was clicked
    if ((e.target as HTMLElement).closest('button, a[href]')) {
      return;
    }
    router.push(`/tasks/${task.id}`);
  };

  return (
    <TooltipProvider>
    <Card 
        className={cn("flex flex-col shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer", className)}
        onClick={handleCardClick}
        role="link" // Make it announceable as a link
        tabIndex={0} // Make it focusable
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(e as any); }} // Keyboard navigation
    >
      <CardHeader className="p-4">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-md sm:text-lg font-semibold leading-tight flex-1">{task.title}</CardTitle>
          <Badge variant="secondary" className={cn("text-xs text-white shrink-0", priorityColors[task.priority])}>
            {task.priority}
          </Badge>
        </div>
        {task.description && (
          <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">
            {task.description}
          </CardDescription>
        )}
         {!task.description && (
           <CardDescription className="text-xs sm:text-sm text-muted-foreground/70 italic mt-1">
            No description.
           </CardDescription>
         )}
      </CardHeader>
      <CardContent className="flex-grow space-y-2 sm:space-y-3 p-4 pt-0">
        <div className="flex items-center text-xs sm:text-sm text-muted-foreground">
          <CalendarDays className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>Due: {task.due_date ? format(parseISO(task.due_date), "MMM d, yyyy") : 'N/A'}</span>
        </div>
        
        <div className="flex items-center text-xs sm:text-sm">
           <StatusIcon className={cn("mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4", 
            task.status === "Done" ? "text-green-500" :
            task.status === "Overdue" ? "text-orange-500" :
            task.status === "In Progress" ? "text-sky-500" :
            "text-muted-foreground"
          )} />
          <Badge variant="outline" className={cn("text-xs",
              task.status === "Done" ? "border-green-500 text-green-600" :
              task.status === "Overdue" ? "border-orange-500 text-orange-600" :
              task.status === "In Progress" ? "border-sky-500 text-sky-600" :
              ""
            )}>
            {task.status}
          </Badge>
        </div>

        {task.assignees && task.assignees.length > 0 && (
          <div className="flex items-center text-xs sm:text-sm text-muted-foreground">
            <Users className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Assigned:</span>
            <div className="ml-1.5 sm:ml-2 flex -space-x-1 sm:-space-x-2 overflow-hidden">
              {task.assignees.slice(0, 3).map(assignee => (
                <Tooltip key={assignee.id}>
                  <TooltipTrigger asChild>
                    <Avatar className="h-5 w-5 sm:h-6 sm:w-6 border-2 border-card hover:z-10">
                      <AvatarImage 
                        src={assignee.avatar_url || `https://avatar.vercel.sh/${assignee.email || assignee.id}.png`} 
                        alt={assignee.name} data-ai-hint="profile avatar"/>
                      <AvatarFallback className="text-xs">{getAvatarFallback(assignee.name)}</AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent><p>{assignee.name}</p></TooltipContent>
                </Tooltip>
              ))}
              {task.assignees.length > 3 && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Avatar className="h-5 w-5 sm:h-6 sm:w-6 border-2 border-card">
                            <AvatarFallback className="text-xs">+{task.assignees.length - 3}</AvatarFallback>
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
            <span>By: {creatorName}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end space-x-2 border-t pt-3 pb-3 px-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={canEditTaskDetails ? undefined : -1}> {/* Use -1 if not focusable by user */}
              <Button 
                variant="outline" 
                size="sm" 
                className="px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm"
                onClick={(e) => { e.stopPropagation(); onEdit(task);}} 
                disabled={!canEditTaskDetails}
                aria-disabled={!canEditTaskDetails}
              >
                <Edit3 className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> 
                Edit
              </Button>
            </span>
          </TooltipTrigger>
          {!canEditTaskDetails && (
            <TooltipContent>
              <p>Only the task creator can edit core details.</p>
            </TooltipContent>
          )}
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={canDelete ? undefined : -1}> 
              <Button 
                variant="destructive" 
                size="sm" 
                className="px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm"
                onClick={(e) => { e.stopPropagation(); onDelete(task.id);}} 
                disabled={!canDelete}
                aria-disabled={!canDelete}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Delete
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
};

export const TaskCard = React.memo(TaskCardComponent);
