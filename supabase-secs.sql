-- Oefensommen — the parent sets how many seconds a question gets
-- Run with ./scripts/db.sh supabase-secs.sql. Safe to run more than once.
--
-- The parent sees the child's rapport and can change the seconds a question
-- gets, per category (tafels, delen, sommen, klok, klokles) and per league
-- (0 kikker, 1 champions, 2 dinozaur). The values are kept in data.secs, and
-- nothing else of the child's record is touched.

create or replace function public.set_secs(u text, p text, secs jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r     public.progress%rowtype;
  uname text := lower(trim(u));
  child text := regexp_replace(lower(trim(u)), '-ouder$', '');
  cur   jsonb;
  cat   text;
  arr   jsonb;
  el    jsonb;
begin
  if uname not like '%-ouder' then
    raise exception 'only a parent may set the seconds' using errcode = '28000';
  end if;

  select * into r from public.progress where username = uname;
  if not found or r.pass_hash <> extensions.crypt(p, r.pass_hash) then
    raise exception 'invalid credentials' using errcode = '28000';
  end if;

  if secs is null or jsonb_typeof(secs) <> 'object' then
    raise exception 'bad seconds' using errcode = '22023';
  end if;

  -- every category given must be known, and each one three values of 1 to 600
  for cat in select jsonb_object_keys(secs) loop
    if cat not in ('tafels', 'delen', 'sommen', 'klok', 'klokles') then
      raise exception 'unknown category %', cat using errcode = '22023';
    end if;
    arr := secs -> cat;
    if jsonb_typeof(arr) <> 'array' or jsonb_array_length(arr) <> 3 then
      raise exception 'bad seconds for %', cat using errcode = '22023';
    end if;
    for el in select jsonb_array_elements(arr) loop
      if jsonb_typeof(el) <> 'number' or (el #>> '{}')::numeric not between 1 and 600 then
        raise exception 'bad value for %', cat using errcode = '22023';
      end if;
    end loop;
  end loop;

  select data into cur from public.progress where username = child;
  if cur is null then
    raise exception 'no such child' using errcode = '28000';
  end if;

  cur := jsonb_set(cur, '{secs}', secs, true);
  cur := jsonb_set(cur, '{rev}', to_jsonb(coalesce((cur->>'rev')::int, 0) + 1), true);

  update public.progress set data = cur, updated_at = now() where username = child;
  return cur;
end;
$$;

grant execute on function public.set_secs(text, text, jsonb) to anon;
