-- Oefensommen — parent account + live mirroring
-- Paste into: Supabase dashboard → SQL Editor → New query → Run.
-- Safe to run more than once. Run supabase-setup.sql first.
--
-- Accounts follow one rule: "<child>-ouder" is the parent of "<child>".
-- So tak-ouder watches tak, and any future kid works the same way with no
-- extra configuration.

-- 1. the parent account (username TAK-OUDER, password 2020)
insert into public.progress (username, pass_hash)
values ('tak-ouder', extensions.crypt('2020', extensions.gen_salt('bf')))
on conflict (username) do update set pass_hash = excluded.pass_hash;

-- 2. what the child is doing right now (one row per child, overwritten)
create table if not exists public.live (
  username   text primary key,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.live enable row level security;   -- no policies: functions only

-- 3. sign in and learn which side of the app you get
create or replace function public.login_account(u text, p text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r         public.progress%rowtype;
  uname     text    := lower(trim(u));
  is_parent boolean := uname like '%-ouder';
  child     text    := regexp_replace(uname, '-ouder$', '');
begin
  select * into r from public.progress where username = uname;
  if not found or r.pass_hash <> extensions.crypt(p, r.pass_hash) then
    raise exception 'invalid credentials' using errcode = '28000';
  end if;
  -- a parent has no progress of its own: it reads the child's
  return jsonb_build_object(
    'role',    case when is_parent then 'parent' else 'child' end,
    'watches', case when is_parent then child else null end,
    'data',    case when is_parent
                 then coalesce((select data from public.progress where username = child), '{}'::jsonb)
                 else r.data end
  );
end;
$$;

-- 3b. the same rule for the ongoing sync: a parent always reads the child's
-- progress, and can never write over it.
create or replace function public.load_progress(u text, p text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r     public.progress%rowtype;
  uname text := lower(trim(u));
  child text := regexp_replace(uname, '-ouder$', '');
begin
  select * into r from public.progress where username = uname;
  if not found or r.pass_hash <> extensions.crypt(p, r.pass_hash) then
    raise exception 'invalid credentials' using errcode = '28000';
  end if;
  if uname like '%-ouder' then
    return coalesce((select data from public.progress where username = child), '{}'::jsonb);
  end if;
  return r.data;
end;
$$;

create or replace function public.save_progress(u text, p text, d jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare r public.progress%rowtype; uname text := lower(trim(u));
begin
  select * into r from public.progress where username = uname;
  if not found or r.pass_hash <> extensions.crypt(p, r.pass_hash) then
    raise exception 'invalid credentials' using errcode = '28000';
  end if;
  if uname like '%-ouder' then
    return;   -- watching only; never let the parent side rewrite history
  end if;
  update public.progress set data = d, updated_at = now() where username = uname;
end;
$$;

-- 4. the child publishes what is on screen
create or replace function public.push_live(u text, p text, s jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare r public.progress%rowtype; uname text := lower(trim(u));
begin
  select * into r from public.progress where username = uname;
  if not found or r.pass_hash <> extensions.crypt(p, r.pass_hash) then
    raise exception 'invalid credentials' using errcode = '28000';
  end if;
  insert into public.live (username, state, updated_at)
  values (uname, s, now())
  on conflict (username) do update set state = excluded.state, updated_at = now();
end;
$$;

-- 5. the parent reads it (only ever of the child in its own username)
create or replace function public.read_live(u text, p text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r     public.progress%rowtype;
  l     public.live%rowtype;
  uname text := lower(trim(u));
  child text := regexp_replace(uname, '-ouder$', '');
begin
  if uname not like '%-ouder' then
    raise exception 'not a parent account' using errcode = '28000';
  end if;
  select * into r from public.progress where username = uname;
  if not found or r.pass_hash <> extensions.crypt(p, r.pass_hash) then
    raise exception 'invalid credentials' using errcode = '28000';
  end if;
  select * into l from public.live where username = child;
  if not found then
    return jsonb_build_object('state', '{}'::jsonb, 'age', 99999);
  end if;
  return jsonb_build_object(
    'state', l.state,
    'age',   floor(extract(epoch from now() - l.updated_at))
  );
end;
$$;

-- 6. the website may call these
grant execute on function public.login_account(text, text) to anon;
grant execute on function public.push_live(text, text, jsonb) to anon;
grant execute on function public.read_live(text, text) to anon;
