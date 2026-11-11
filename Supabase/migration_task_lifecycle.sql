-- Better Me 1.5 task lifecycle. Already applied to the Better-Me project on 2026-11-10.
-- Safe to re-run. Backs up the task table first, then:
--   rolled_from becomes text (the app stores the source day as a date key),
--   the status default is 'scheduled', and older status values are mapped to the same vocabulary.
-- Statuses: scheduled, running, waiting_review, done, missed, pushed (enforced by better_me_tasks_status_check).
begin;
create table if not exists public.better_me_tasks_backup_v14 as select * from public.better_me_tasks;
alter table public.better_me_tasks_backup_v14 enable row level security;
alter table public.better_me_tasks alter column rolled_from type text using rolled_from::text;
alter table public.better_me_tasks
  add column if not exists status text not null default 'scheduled',
  add column if not exists end_time text not null default '',
  add column if not exists timer_started_at timestamptz,
  add column if not exists outcome text;
update public.better_me_tasks set status = 'done' where done = true and status <> 'done';
update public.better_me_tasks set status = 'scheduled' where done = false and status not in ('scheduled','running','waiting_review','missed','pushed');
alter table public.better_me_tasks alter column status set default 'scheduled';
commit;
