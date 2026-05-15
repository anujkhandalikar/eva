-- Google Calendar integration migration
-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/rqqzybcqfnetskfqoqgl/sql/new

ALTER TABLE tasks ADD COLUMN calendar_action jsonb;
ALTER TABLE tasks ADD COLUMN calendar_event_id text;
