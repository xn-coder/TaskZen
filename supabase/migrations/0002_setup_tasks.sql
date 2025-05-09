
-- Define ENUM types for task priority and status if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority_enum') THEN
        CREATE TYPE public.task_priority_enum AS ENUM ('Low', 'Medium', 'High');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status_enum') THEN
        CREATE TYPE public.task_status_enum AS ENUM ('To Do', 'In Progress', 'Done'); -- 'Overdue' is a derived status, not stored in DB
    END IF;
END$$;

-- Create the tasks table
CREATE TABLE public.tasks (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  priority public.task_priority_enum NOT NULL DEFAULT 'Medium',
  status public.task_status_enum NOT NULL DEFAULT 'To Do',
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for frequently queried columns
CREATE INDEX idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX idx_tasks_created_by_id ON public.tasks(created_by_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_priority ON public.tasks(priority);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);

-- Enable Row Level Security for the tasks table
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks:
-- 1. Users can see tasks they created.
CREATE POLICY "Users can view tasks they created"
ON public.tasks FOR SELECT
USING (auth.uid() = created_by_id);

-- 2. Users can see tasks assigned to them.
CREATE POLICY "Users can view tasks assigned to them"
ON public.tasks FOR SELECT
USING (auth.uid() = assignee_id);

-- 3. Users can insert new tasks, automatically setting created_by_id.
CREATE POLICY "Users can insert new tasks"
ON public.tasks FOR INSERT
WITH CHECK (auth.uid() = created_by_id);

-- 4. Users can update tasks they created.
CREATE POLICY "Users can update tasks they created"
ON public.tasks FOR UPDATE
USING (auth.uid() = created_by_id)
WITH CHECK (auth.uid() = created_by_id);

-- 5. Users can update tasks assigned to them (e.g., to change status).
--    Be cautious with this; you might want more granular control on what fields assignees can update.
--    For example, an assignee might only be allowed to update 'status'.
CREATE POLICY "Users can update tasks assigned to them"
ON public.tasks FOR UPDATE
USING (auth.uid() = assignee_id)
WITH CHECK (auth.uid() = assignee_id);


-- 6. Users can delete tasks they created.
CREATE POLICY "Users can delete tasks they created"
ON public.tasks FOR DELETE
USING (auth.uid() = created_by_id);


-- Function to automatically update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update 'updated_at' on any row update
CREATE TRIGGER handle_task_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE PROCEDURE public.update_modified_column();
