-- Thought capture migration
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/rqqzybcqfnetskfqoqgl/sql/new

ALTER TABLE tasks ADD COLUMN entry_type text NOT NULL DEFAULT 'task';
ALTER TABLE tasks ADD COLUMN tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN classification_confidence real;
ALTER TABLE tasks ADD COLUMN promoted_to_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_entry_type ON tasks(entry_type);
CREATE INDEX idx_tasks_tags ON tasks USING GIN (tags);
