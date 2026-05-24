-- Scheduler: add scheduled_for column for retry-within-EOD
-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/rqqzybcqfnetskfqoqgl/sql/new
--
-- scheduled_for tracks the original target fire time. next_run_at can be bumped
-- forward by 1 min during retries, but scheduled_for stays put so the
-- end-of-IST-day cutoff remains anchored.

alter table scheduled_tasks add column if not exists scheduled_for timestamptz;
update scheduled_tasks
  set scheduled_for = next_run_at
  where scheduled_for is null and next_run_at is not null;
