-- Scheduler: add max_runs + run_count for bounded recurring schedules
-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/rqqzybcqfnetskfqoqgl/sql/new

alter table scheduled_tasks add column if not exists max_runs int;
alter table scheduled_tasks add column if not exists run_count int not null default 0;
