-- Oefensommen — daily backup of the progress table
-- Paste into: Supabase dashboard → SQL Editor → New query → Run,
-- or run it with ./scripts/db.sh supabase-backup.sql. Safe to run more than once.
--
-- Why this exists: there is one copy of the child's history and it lives in
-- public.progress. A mistake in the app, a bad merge or a wrong hand at the SQL
-- editor can overwrite it, and until now nothing would have brought it back.
-- Every night a snapshot of every account is written to a second table, and
-- three months of those snapshots are kept.
--
-- The snapshot lives inside the same database, so it protects against losing
-- the DATA. It does not protect against losing the PROJECT — for that there is
-- ./scripts/backup.sh, which pulls the same rows down to a file.

-- 1. the scheduler (runs inside Postgres; no laptop has to be awake)
create extension if not exists pg_cron;

-- 2. one snapshot per account per day
create table if not exists public.progress_backup (
  username  text        not null,
  taken_on  date        not null,
  data      jsonb       not null,
  taken_at  timestamptz not null default now(),
  primary key (username, taken_on)
);

-- locked like the table it protects: RLS on, no policies, so the anon key the
-- website ships with cannot read or write a single row of it
alter table public.progress_backup enable row level security;

create index if not exists progress_backup_taken_on_idx
  on public.progress_backup (taken_on desc);

-- 3. take the snapshot. Running it twice on one day refreshes that day rather
--    than failing, so it is safe to call by hand whenever you want one.
create or replace function public.snapshot_progress()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  insert into public.progress_backup (username, taken_on, data)
  select p.username, current_date, p.data from public.progress p
  on conflict (username, taken_on)
    do update set data = excluded.data, taken_at = now();
  get diagnostics n = row_count;

  -- three months of daily snapshots is plenty to notice and undo a mistake,
  -- and small enough to forget about
  delete from public.progress_backup where taken_on < current_date - interval '90 days';
  return n;
end;
$$;

-- the website must never be able to call this; only the owner of the database
revoke execute on function public.snapshot_progress() from public, anon, authenticated;

-- 4. every night at 02:15 UTC (04:15 Amsterdam in summer) — nobody is
--    practising then, so the snapshot is always of a settled day
select cron.unschedule('oefensommen-daily-backup')
 where exists (select 1 from cron.job where jobname = 'oefensommen-daily-backup');

select cron.schedule('oefensommen-daily-backup', '15 2 * * *',
                     $$select public.snapshot_progress()$$);

-- 5. and one right now, so there is a floor under today
select public.snapshot_progress() as accounts_backed_up;

-- ----------------------------------------------------------------------------
-- Looking at what is kept:
--
--   select username, taken_on, pg_size_pretty(length(data::text)::bigint) as size
--     from public.progress_backup order by taken_on desc, username;
--
-- Putting a day back (deliberate, one account, no guessing):
--
--   update public.progress p
--      set data = b.data, updated_at = now()
--     from public.progress_backup b
--    where p.username = 'tak' and b.username = 'tak'
--      and b.taken_on = date '2026-08-06';
--
-- Putting back only ONE day out of the history, leaving the rest alone:
--
--   update public.progress p
--      set data = jsonb_set(p.data, '{days,2026-08-06}',
--                           b.data->'days'->'2026-08-06', true)
--     from public.progress_backup b
--    where p.username = 'tak' and b.username = 'tak'
--      and b.taken_on = date '2026-08-07';
-- ----------------------------------------------------------------------------
