-- Thought capture migration
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/rqqzybcqfnetskfqoqgl/sql/new

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS entry_type text NOT NULL DEFAULT 'task';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS classification_confidence real;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS promoted_to_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_entry_type ON tasks(entry_type);
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING GIN (tags);
