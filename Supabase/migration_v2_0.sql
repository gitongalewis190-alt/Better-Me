-- Better Me 2.0 — Supabase setup / verification. SAFE TO RE-RUN (idempotent). Project ref: xshpnnanpetrqyjurwji
-- The 2.0 app works WITHOUT this file if the 1.5 tables already exist: every new feature
-- (habits, moods, journal, goals, focus log, task notes/subtasks/priority, usage stats) is stored
-- inside better_me_state.data (jsonb). This file makes sure all tables, policies and indexes are
-- in place and adds performance indexes.

begin;

-- 1. Per-user record (settings, profile, habits, moods, journal, goals, focus log, usage, task meta)
create table if not exists public.better_me_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.better_me_state enable row level security;

-- 2. One row per task
create table if not exists public.better_me_tasks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  day text not null,
  text text not null default '',
  area text not null default '',
  minutes integer not null default 0,
  spent integer not null default 0,
  start_time text not null default '',
  end_time text not null default '',
  done boolean not null default false,
  done_at timestamptz,
  position integer not null default 0,
  rolled_from text,
  status text not null default 'scheduled',
  timer_started_at timestamptz,
  outcome text,
  updated_at timestamptz not null default now()
);
alter table public.better_me_tasks add column if not exists end_time text not null default '';
alter table public.better_me_tasks add column if not exists status text not null default 'scheduled';
alter table public.better_me_tasks add column if not exists timer_started_at timestamptz;
alter table public.better_me_tasks add column if not exists outcome text;
alter table public.better_me_tasks enable row level security;
create index if not exists better_me_tasks_user_day on public.better_me_tasks (user_id, day);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'better_me_tasks_status_check') then
    alter table public.better_me_tasks add constraint better_me_tasks_status_check
      check (status in ('scheduled','running','waiting_review','done','missed','pushed'));
  end if;
end $$;

-- 3. Log of exported reports / prints
create table if not exists public.better_me_prints (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  doc text not null default 'report',
  title text not null default 'Better Me',
  range_from text,
  range_to text,
  options jsonb not null default '{}'::jsonb,
  summary text not null default '',
  created_at timestamptz not null default now()
);
alter table public.better_me_prints enable row level security;
create index if not exists better_me_prints_user on public.better_me_prints (user_id, created_at desc);

-- 4. Row Level Security: each person sees only their own rows (select/insert/update/delete).
do $$
declare t text; op text;
begin
  foreach t in array array['better_me_state','better_me_tasks','better_me_prints'] loop
    foreach op in array array['select','insert','update','delete'] loop
      if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname = 'own ' || op) then
        if op = 'insert' then
          execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', 'own ' || op, t);
        elsif op = 'update' then
          execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', 'own ' || op, t);
        else
          execute format('create policy %I on public.%I for %s to authenticated using ((select auth.uid()) = user_id)', 'own ' || op, t, op);
        end if;
      end if;
    end loop;
  end loop;
end $$;

commit;

-- 5. Verify (should list 3 tables with rls = true, and policies for each)
select tablename, rowsecurity from pg_tables where schemaname='public' and tablename like 'better_me_%' and tablename not like '%backup%';
select tablename, policyname, cmd from pg_policies where schemaname='public' and tablename like 'better_me_%' order by 1,2;
