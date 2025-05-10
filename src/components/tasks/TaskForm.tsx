
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
import type { Task, Profile, TaskStatus, TaskPriority } from "@/lib/types";
import { TASK_EDITABLE_STATUSES, TASK_PRIORITIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { CalendarIcon, Loader2, ChevronDown } from "lucide-react";
import { format, parseISO, formatISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { addTask, updateTask, getProfilesForDropdown } from "@/lib/taskService";

const taskFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().optional(),
  due_date: z.date({ required_error: "Due date is required." }),
  priority: z.enum(TASK_PRIORITIES as [TaskPriority, ...TaskPriority[]]),
  status: z.enum(TASK_EDITABLE_STATUSES as [Exclude<TaskStatus, "Overdue">, ...Exclude<TaskStatus, "Overdue">[]]),
  assignee_ids: z.array(z.string()).optional().default([]), // Array of assignee IDs
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  initialData?: Task | null;
  onSubmitSuccess?: (task: Task) => void;
  isEditing?: boolean;
}

export function TaskForm({ initialData = null, onSubmitSuccess, isEditing = false }: TaskFormProps) {
  const { user: authUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assigneeProfiles, setAssigneeProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    async function fetchProfiles() {
      try {
        const profiles = await getProfilesForDropdown();
        setAssigneeProfiles(profiles);
      } catch (error) {
        console.error("Failed to fetch profiles for dropdown:", error);
        toast({ title: "Error", description: "Could not load users for assignee field.", variant: "destructive" });
      }
    }
    fetchProfiles();
  }, [toast]);

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
    },
  });

  async function onSubmit(values: TaskFormValues) {
    if (!authUser || !authUser.uid) { 
      toast({ title: "Error", description: "You must be logged in to perform this action.", variant: "destructive"});
      return;
    }
    setIsSubmitting(true);

    const taskPayloadBase = {
      ...values,
      due_date: formatISO(values.due_date), 
      description: values.description || "",
      assignee_ids: values.assignee_ids && values.assignee_ids.length > 0 ? values.assignee_ids : [], // Ensure it's an array, can be empty
    };
    
    try {
      let resultTask: Task;
      if (isEditing && initialData) {
        // Type assertion for updateTask payload is tricky because Omit doesn't play well with deep partials.
        // We ensure all necessary fields are present from `taskPayloadBase`.
        resultTask = await updateTask(initialData.id, taskPayloadBase as Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'assignees' | 'created_by'>>);
      } else {
        const fullPayloadForAdd = {
            ...taskPayloadBase,
            created_by_id: authUser.uid, 
        };
        // Type assertion for addTask. The service handles the structure.
        resultTask = await addTask(fullPayloadForAdd as Omit<Task, 'id' | 'created_at' | 'updated_at' | 'status' | 'assignees' | 'created_by'> & { status: Exclude<TaskStatus, "Overdue"> } & { created_by_id: string });
      }

      toast({
        title: `Task ${isEditing ? 'Updated' : 'Created'}`,
        description: `"${resultTask.title}" has been successfully ${isEditing ? 'updated' : 'created'}.`,
      });

      if (onSubmitSuccess) {
        onSubmitSuccess(resultTask);
      } else {
        router.push('/tasks'); 
        router.refresh(); 
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
                <Input placeholder="E.g., Finalize project report" {...field} />
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
                <Textarea placeholder="Add more details about the task..." {...field} value={field.value ?? ""} rows={4} />
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      {field.value && field.value.length > 0
                        ? `${field.value.length} user(s) selected`
                        : "Select assignees"}
                      <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <ScrollArea className="h-48">
                      <div className="p-2 space-y-1">
                      {assigneeProfiles.length === 0 && <p className="text-sm text-muted-foreground p-2 text-center">No users available.</p>}
                      {assigneeProfiles.map((profile) => (
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
                          />
                          <Label htmlFor={`assignee-${profile.id}`} className="font-normal flex-1 cursor-pointer text-sm">
                            {profile.name} <span className="text-xs text-muted-foreground">({profile.email})</span>
                          </Label>
                        </div>
                      ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                <FormDescription>
                  Choose team members to assign this task to.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Task"}
            </Button>
        </div>
      </form>
    </Form>
  );
}
