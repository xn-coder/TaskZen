
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import type { Task, Profile, TaskStatus, TaskPriority } from '@/lib/types'; // Using AppTask as Task
import { TASK_EDITABLE_STATUSES, TASK_PRIORITIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { CalendarIcon, Loader2, ChevronDown } from "lucide-react";
import { format, parseISO, formatISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useMemo } from "react";
import { addTask, updateTask, getProfilesForDropdown } from "@/lib/taskService";
import type { AppUser } from "@/lib/auth"; // Supabase AppUser

const taskFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().optional(),
  due_date: z.date({ required_error: "Due date is required." }),
  priority: z.enum(TASK_PRIORITIES as [TaskPriority, ...TaskPriority[]]),
  status: z.enum(TASK_EDITABLE_STATUSES as [Exclude<TaskStatus, "Overdue">, ...Exclude<TaskStatus, "Overdue">[]]),
  assignee_ids: z.array(z.string()).optional().default([]),
  newCommentText: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  initialData?: Task | null;
  onSubmitSuccess?: (task: Task) => void;
  isEditing?: boolean;
  isCreator?: boolean;
}

export function TaskForm({ initialData = null, onSubmitSuccess, isEditing = false, isCreator = true }: TaskFormProps) {
  const { user: authUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    async function fetchProfiles() {
      try {
        const profiles = await getProfilesForDropdown();
        setAllProfiles(profiles);
      } catch (error) {
        console.error("Failed to fetch profiles for dropdown:", error);
        toast({ title: "Error", description: "Could not load users for assignee field.", variant: "destructive" });
      }
    }
    fetchProfiles();
  }, [toast]);

  const assignableProfiles = useMemo(() => {
    if (!authUser || !authUser.id) return allProfiles;
    return allProfiles.filter(profile => profile.id !== authUser.id);
  }, [allProfiles, authUser]);


  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      due_date: initialData?.due_date ? parseISO(initialData.due_date) : new Date(),
      priority: initialData?.priority || "Medium",
      status: initialData?.status && TASK_EDITABLE_STATUSES.includes(initialData.status as Exclude<TaskStatus, "Overdue">) 
              ? initialData.status as Exclude<TaskStatus, "Overdue"> 
              : "To Do",
      assignee_ids: initialData?.assignee_ids || [],
      newCommentText: "",
    },
  });

  async function onSubmit(values: TaskFormValues) {
    if (!authUser || !authUser.id) { 
      toast({ title: "Error", description: "You must be logged in to perform this action.", variant: "destructive"});
      return;
    }
    setIsSubmitting(true);
    
    try {
      let resultTask: Task;
      if (isEditing && initialData) {
        const taskUpdatesPayload: Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'assignees' | 'created_by' | 'comments'>> = {};
        
        if (isCreator) {
            taskUpdatesPayload.title = values.title;
            taskUpdatesPayload.description = values.description || "";
            taskUpdatesPayload.due_date = formatISO(values.due_date);
            taskUpdatesPayload.priority = values.priority;
            taskUpdatesPayload.status = values.status;
            taskUpdatesPayload.assignee_ids = values.assignee_ids || [];
        } else {
            taskUpdatesPayload.status = values.status;
        }
        
        resultTask = await updateTask(initialData.id, taskUpdatesPayload, values.newCommentText, authUser);

      } else { 
        // Ensure status is of the correct type for new tasks (not "Overdue")
        const validStatus = TASK_EDITABLE_STATUSES.includes(values.status as Exclude<TaskStatus, "Overdue">) 
                            ? values.status as Exclude<TaskStatus, "Overdue">
                            : "To Do";

        const taskCreationPayload = {
            title: values.title,
            description: values.description || "",
            due_date: formatISO(values.due_date),
            priority: values.priority,
            status: validStatus,
            assignee_ids: values.assignee_ids || [],
            created_by_id: authUser.id,
        };
        resultTask = await addTask(taskCreationPayload as Omit<Task, 'id' | 'created_at' | 'updated_at' | 'assignees' | 'created_by' | 'comments'> & { status: Exclude<TaskStatus, "Overdue">; created_by_id: string });
      }

      toast({
        title: `Task ${isEditing ? 'Updated' : 'Created'}`,
        description: `"${resultTask.title}" has been successfully ${isEditing ? 'updated' : 'created'}.`,
      });

      if (onSubmitSuccess) {
        onSubmitSuccess(resultTask);
      } else {
        router.push('/tasks'); 
      }
    } catch (error: any) {
      console.error("Failed to save task:", error);
      toast({
        title: `Failed to ${isEditing ? 'Update' : 'Create'} Task`,
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const canEditCoreFields = !isEditing || isCreator;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="E.g., Finalize project report" {...field} disabled={!canEditCoreFields || isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Add more details about the task..." {...field} value={field.value ?? ""} rows={4} disabled={!canEditCoreFields || isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="due_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Due Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        disabled={!canEditCoreFields || isSubmitting}
                      >
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1))} 
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!canEditCoreFields || isSubmitting}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TASK_PRIORITIES.map(priority => (
                      <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TASK_EDITABLE_STATUSES.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="assignee_ids"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assign To</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal" disabled={!canEditCoreFields || isSubmitting}>
                      {field.value && field.value.length > 0
                        ? `${field.value.length} user(s) selected`
                        : "Select assignees"}
                      <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <ScrollArea className="h-48">
                      <div className="p-2 space-y-1">
                      {assignableProfiles.length === 0 && <p className="text-sm text-muted-foreground p-2 text-center">No other users available to assign.</p>}
                      {assignableProfiles.map((profile) => (
                        <div key={profile.id} className="flex items-center space-x-2 p-1.5 hover:bg-accent rounded-md">
                          <Checkbox
                            id={`assignee-${profile.id}`}
                            checked={field.value?.includes(profile.id)}
                            onCheckedChange={(checked) => {
                              const currentIds = field.value || [];
                              if (checked) {
                                form.setValue("assignee_ids", [...currentIds, profile.id]);
                              } else {
                                form.setValue("assignee_ids", currentIds.filter(id => id !== profile.id));
                              }
                            }}
                            disabled={!canEditCoreFields || isSubmitting}
                          />
                          <Label htmlFor={`assignee-${profile.id}`} className={cn("font-normal flex-1 cursor-pointer text-sm", (!canEditCoreFields || isSubmitting) && "cursor-not-allowed opacity-70")}>
                            {profile.name || 'Unnamed User'} <span className="text-xs text-muted-foreground">({profile.email || 'No email'})</span>
                          </Label>
                        </div>
                      ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                <FormDescription>
                  {canEditCoreFields ? "Choose team members to assign this task to. You cannot assign tasks to yourself." : "Assignees cannot be changed by non-creators."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {isEditing && (
          <FormField
            control={form.control}
            name="newCommentText"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Add a Comment (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Type your comment here..."
                    {...field}
                    value={field.value ?? ""}
                    rows={3}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormDescription>Your comment will be added when you save changes.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Task"}
            </Button>
        </div>
      </form>
    </Form>
  );
}
