
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
import type { Task, User } from "@/lib/types";
import { TASK_EDITABLE_STATUSES, TASK_PRIORITIES } from "@/lib/constants";
import { mockUsers } from "@/lib/store"; // For assignee dropdown
import { cn } from "@/lib/utils";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

const taskFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().optional(),
  dueDate: z.date({ required_error: "Due date is required." }),
  priority: z.enum(TASK_PRIORITIES as [string, ...string[]], { // Type assertion for Zod
    required_error: "Priority is required.",
  }),
  status: z.enum(TASK_EDITABLE_STATUSES as [string, ...string[]], {
    required_error: "Status is required.",
  }),
  assigneeId: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  initialData?: Task | null;
  onSubmitSuccess?: (task: Task) => void;
  isEditing?: boolean;
}

export function TaskForm({ initialData = null, onSubmitSuccess, isEditing = false }: TaskFormProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      dueDate: initialData?.dueDate ? parseISO(initialData.dueDate) : new Date(),
      priority: initialData?.priority || "Medium",
      status: initialData?.status === "Overdue" ? "To Do" : initialData?.status || "To Do", // Default to "To Do" if Overdue
      assigneeId: initialData?.assigneeId || undefined,
    },
  });

  async function onSubmit(values: TaskFormValues) {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive"});
      return;
    }
    setIsLoading(true);

    const taskData = {
      ...values,
      dueDate: format(values.dueDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"), // Ensure ISO 8601 format
      createdById: isEditing && initialData ? initialData.createdById : user.id,
      // If editing, retain original createdById, else use current user's ID.
      // id, createdAt, updatedAt will be handled by mock store functions
    };
    
    try {
      // In a real app, this would be an API call. Using mock store functions for now.
      // Simulating API call to store functions (which are not async currently)
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
      
      let resultTask: Task;
      if (isEditing && initialData) {
        const updatedTaskData = { ...initialData, ...taskData };
        // resultTask = updateTask(updatedTaskData); // Assuming updateTask in store.ts
        // For mock, just use the data. In real app, use store.updateTask
        resultTask = { ...updatedTaskData, updatedAt: new Date().toISOString() } as Task; 
        // Update mockTasks array manually for demo
        const taskIndex = mockTasks.findIndex(t => t.id === initialData.id);
        if (taskIndex > -1) mockTasks[taskIndex] = resultTask;

      } else {
        // resultTask = addTask(taskData); // Assuming addTask in store.ts
        // For mock, just use the data. In real app, use store.addTask
        resultTask = { 
          ...taskData, 
          id: `task${Date.now()}`, 
          createdAt: new Date().toISOString(), 
          updatedAt: new Date().toISOString()
        } as Task;
        mockTasks.push(resultTask); // Add to mockTasks array manually for demo
      }

      toast({
        title: `Task ${isEditing ? 'Updated' : 'Created'}`,
        description: `"${resultTask.title}" has been successfully ${isEditing ? 'updated' : 'created'}.`,
      });

      if (onSubmitSuccess) {
        onSubmitSuccess(resultTask);
      } else {
        router.push('/tasks'); // Default redirect
      }
    } catch (error) {
      console.error("Failed to save task:", error);
      toast({
        title: `Failed to ${isEditing ? 'Update' : 'Create'} Task`,
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }
  const [usersForDropdown] = useState<User[]>(mockUsers);


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
                <Textarea placeholder="Add more details about the task..." {...field} rows={4} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="dueDate"
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
                      disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1))} // Disable past dates
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
            name="assigneeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assign To (Optional)</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {usersForDropdown.map(usr => (
                      <SelectItem key={usr.id} value={usr.id}>{usr.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Choose a team member to assign this task to.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Task"}
            </Button>
        </div>
      </form>
    </Form>
  );
}
