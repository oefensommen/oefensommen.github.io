-- Oefensommen — the parent may colour a day and leave a note on it
-- Paste into: Supabase dashboard → SQL Editor, or ./scripts/db.sh supabase-daymark.sql
-- Safe to run more than once. Run supabase-setup.sql and supabase-live.sql first.
--
-- Not every day of oefenen happens in this app. A day worked out of the book,
-- or at school, or with a parent at the kitchen table, still counts — but the
-- app cannot know about it, so it shows the day as missed. The parent can now
-- say otherwise: set the colour by hand and write down why.
--
-- The parent side has never been allowed to write history and still is not.
-- This function can only reach data.marks — one colour and one short note per
-- day. Everything the child actually did stays exactly as the child left it.

create or replace function public.set_day_mark(u text, p text, d text, colour text, note text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r      public.progress%rowtype;
  uname  text := lower(trim(u));
  child  text := regexp_replace(lower(trim(u)), '-ouder$', '');
  cur    jsonb;
  mark   jsonb;
begin
  if uname not like '%-ouder' then
    raise exception 'only a parent may mark a day' using errcode = '28000';
  end if;

  select * into r from public.progress where username = uname;
  if not found or r.pass_hash <> extensions.crypt(p, r.pass_hash) then
    raise exception 'invalid credentials' using errcode = '28000';
  end if;

  if d !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'bad date' using errcode = '22007';
  end if;
  if colour is not null and colour not in ('done', 'partial', 'miss') then
    raise exception 'bad colour' using errcode = '22023';
  end if;

  select data into cur from public.progress where username = child;
  if cur is null then
    raise exception 'no such child' using errcode = '28000';
  end if;

  -- jsonb_set cannot reach into a key that is not there yet, and would quietly
  -- do nothing at all, so make sure the container exists first
  if cur->'marks' is null then
    cur := jsonb_set(cur, '{marks}', '{}'::jsonb, true);
  end if;

  if colour is null and (note is null or btrim(note) = '') then
    cur := cur #- array['marks', d];                 -- back to what the app knows
  else
    mark := jsonb_strip_nulls(jsonb_build_object(
      'c',    colour,
      'note', nullif(btrim(left(coalesce(note, ''), 140)), ''),
      'by',   uname,
      'at',   (extract(epoch from now()) * 1000)::bigint
    ));
    cur := jsonb_set(cur, array['marks', d], mark, true);
  end if;

  -- one record, and the revision decides who is right: step it so the child's
  -- devices take this in rather than argue with it
  cur := jsonb_set(cur, '{rev}',
                   to_jsonb(coalesce((cur->>'rev')::int, 0) + 1), true);

  update public.progress set data = cur, updated_at = now() where username = child;
  return cur;
end;
$$;

grant execute on function public.set_day_mark(text, text, text, text, text) to anon;
