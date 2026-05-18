-- Category migration — task categories drive bento tile color.
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/rqqzybcqfnetskfqoqgl/sql/new

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category text;

-- Categories: research, action, personal, work, learning, other.
-- Nullable: missing → graphite tile. App-side validation only (no CHECK).

CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
