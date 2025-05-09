-- Create tasks table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
    status TEXT NOT NULL DEFAULT 'To Do' CHECK (status IN ('To Do', 'In Progress', 'Done')),
    assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security for tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policies for tasks table

-- Users can see tasks they created or are assigned to
CREATE POLICY "Users can view their own or assigned tasks" ON tasks
    FOR SELECT
    USING (
        auth.uid() = created_by_id OR auth.uid() = assignee_id
    );

-- Users can insert tasks where they are the creator
CREATE POLICY "Users can insert their own tasks" ON tasks
    FOR INSERT
    WITH CHECK (
        auth.uid() = created_by_id
    );

-- Users can update tasks they created or are assigned to
CREATE POLICY "Users can update their created or assigned tasks" ON tasks
    FOR UPDATE
    USING (
        auth.uid() = created_by_id OR auth.uid() = assignee_id
    )
    WITH CHECK (
      auth.uid() = created_by_id OR auth.uid() = assignee_id
    );

-- Users can delete tasks they created
CREATE POLICY "Users can delete their own tasks" ON tasks
    FOR DELETE
    USING (
        auth.uid() = created_by_id
    );

-- Trigger for tasks updated_at
-- This assumes the trigger_set_timestamp function is created by 0001_setup_profiles.sql
CREATE TRIGGER set_tasks_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Optional: Add indexes for frequently queried columns
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX idx_tasks_created_by_id ON tasks(created_by_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
