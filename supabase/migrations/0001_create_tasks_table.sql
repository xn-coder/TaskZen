-- Create the tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')),
  status TEXT NOT NULL CHECK (status IN ('To Do', 'In Progress', 'Done')), -- "Overdue" is a client-side calculated status
  assignee_ids UUID[], -- Array of user UUIDs
  created_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  comments JSONB DEFAULT '[]'::jsonb -- Store comments as an array of JSON objects
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX idx_tasks_created_by_id ON public.tasks(created_by_id);
CREATE INDEX idx_tasks_assignee_ids ON public.tasks USING GIN (assignee_ids); -- GIN index for array operations
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_priority ON public.tasks(priority);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);


-- Function to automatically update `updated_at` timestamp
CREATE OR REPLACE FUNCTION public.handle_task_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update `updated_at` on task update
CREATE TRIGGER on_task_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_task_updated_at();

-- Policies for tasks
CREATE POLICY "Users can create tasks."
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = created_by_id);

CREATE POLICY "Users can read tasks they created or are assigned to."
  ON public.tasks FOR SELECT
  USING (
    auth.uid() = created_by_id OR
    auth.uid() = ANY(assignee_ids)
  );

CREATE POLICY "Task creators can update their tasks."
  ON public.tasks FOR UPDATE
  USING (auth.uid() = created_by_id)
  WITH CHECK (auth.uid() = created_by_id);
  -- More granular update checks (e.g., only creator can change title) can be added in WITH CHECK if needed,
  -- or handled by application logic. For RLS, this allows the creator to update any field.

CREATE POLICY "Task assignees can update status and comments of their assigned tasks."
  ON public.tasks FOR UPDATE
  USING (auth.uid() = ANY(assignee_ids))
  WITH CHECK (
    auth.uid() = ANY(assignee_ids) AND
    -- This check ensures assignees can only modify specific fields.
    -- The actual fields allowed to be updated by assignees (e.g. 'status', 'comments')
    -- should ideally be enforced by a PostgreSQL function or application logic,
    -- as RLS 'WITH CHECK' for specific column updates is complex.
    -- For now, this policy allows update if user is an assignee.
    -- Application logic must ensure only 'status' and 'comments' are changed by assignees.
    true -- Placeholder for more complex column-level checks if implemented in DB.
  );


CREATE POLICY "Task creators can delete their tasks."
  ON public.tasks FOR DELETE
  USING (auth.uid() = created_by_id);

-- Enable Realtime on the tasks table
-- This step is done in Supabase Dashboard under Database > Replication
-- Or by running:
-- BEGIN;
--   DROP PUBLICATION IF EXISTS supabase_realtime;
--   CREATE PUBLICATION supabase_realtime FOR TABLE public.tasks;
-- COMMIT;
-- However, it's better to manage this via the dashboard or ensure it's part of the default Supabase setup.
-- For this migration, we focus on table structure and RLS.
-- The `ALTER TABLE public.tasks REPLICA IDENTITY FULL;` might be needed for realtime updates with row data.
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
