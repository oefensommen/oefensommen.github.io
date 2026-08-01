-- Oefensommen — Supabase setup
-- Paste this whole file into: Supabase dashboard → SQL Editor → New query → Run.
-- Safe to run more than once.
--
-- Security model: the progress table has RLS enabled and NO policies, so the
-- public anon key cannot read or write it directly. The only way in is through
-- the two functions below, which check the password server-side against a
-- bcrypt hash. The password itself never appears in the website's source code.

-- 1. bcrypt (Supabase keeps extensions in their own schema)
create extension if not exists pgcrypto with schema extensions;

-- 2. one row per account, holding the whole progress blob
create table if not exists public.progress (
  username   text primary key,
  pass_hash  text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 3. lock the table: RLS on, no policies => nothing reaches it directly
alter table public.progress enable row level security;

-- 4. the account (username TAK, password 2026).
--    To change the password later, re-run just this statement with a new value
--    and "do update" instead of "do nothing".
insert into public.progress (username, pass_hash)
values ('tak', extensions.crypt('2026', extensions.gen_salt('bf')))
on conflict (username) do nothing;

-- 5. read progress (verifies the password first)
create or replace function public.load_progress(u text, p text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare r public.progress%rowtype;
begin
  select * into r from public.progress where username = lower(trim(u));
  if not found or r.pass_hash <> extensions.crypt(p, r.pass_hash) then
    raise exception 'invalid credentials' using errcode = '28000';
  end if;
  return r.data;
end;
$$;

-- 6. write progress (verifies the password first)
create or replace function public.save_progress(u text, p text, d jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare r public.progress%rowtype;
begin
  select * into r from public.progress where username = lower(trim(u));
  if not found or r.pass_hash <> extensions.crypt(p, r.pass_hash) then
    raise exception 'invalid credentials' using errcode = '28000';
  end if;
  update public.progress
     set data = d, updated_at = now()
   where username = r.username;
end;
$$;

-- 7. the website (anon key) may call exactly these two functions
grant execute on function public.load_progress(text, text) to anon;
grant execute on function public.save_progress(text, text, jsonb) to anon;
