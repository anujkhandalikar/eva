-- Scheduler: scheduled_tasks table
-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/rqqzybcqfnetskfqoqgl/sql/new

create table if not exists scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  enabled boolean not null default true,
  run_once boolean not null default false,
  cron_expr text,
  action_type text not null,
  payload jsonb not null,
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_status text,
  last_error text
);

create index if not exists scheduled_tasks_due_idx
  on scheduled_tasks (enabled, next_run_at);
