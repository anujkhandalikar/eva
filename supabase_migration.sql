-- Blinkit integration migration
-- Run this in the Supabase SQL editor: https://supabase.com/dashboard/project/rqqzybcqfnetskfqoqgl/sql/new

ALTER TABLE tasks ADD COLUMN task_type text NOT NULL DEFAULT 'research';
ALTER TABLE tasks ADD COLUMN proposed_cart jsonb;
