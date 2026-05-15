-- WhatsApp integration migration
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/rqqzybcqfnetskfqoqgl/sql/new

ALTER TABLE tasks ADD COLUMN proposed_message jsonb;
