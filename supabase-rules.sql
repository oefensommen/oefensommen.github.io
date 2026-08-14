-- Oefensommen — the parent decides what the bank is allowed to ask
-- Run with ./scripts/db.sh supabase-rules.sql. Safe to run more than once.
--
-- Tuning says how HARD a som may be. This says whether it may be asked at all.
-- A parent watching the sommen go by sees things the app cannot judge for
-- itself: this soort som is not what school is doing, those prices with a
-- comma in them are not on the programme yet, that remainder business only
-- confuses. So the parent switches it off, and the engine stops building it.
--
-- Two shapes, both under data.rules, both meaning "blocked":
--   rules.tpl.<template-id>   one particular soort som
--   rules.trait.<trait>       everything with that property, wherever it lives
--
-- And data.notes.<template-id> keeps what the parent actually wrote, in their
-- own words, because not every objection fits in a switch.
--
-- Like set_tuning, the parent writes to exactly these two places in the
-- child's blob and nowhere else. The history stays the child's.

create or replace function public.set_rule(u text, p text, kind text, key text, blocked boolean)
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
begin
  if uname not like '%-ouder' then
    raise exception 'only a parent may set a rule' using errcode = '28000';
  end if;

  select * into r from public.progress where username = uname;
  if not found or r.pass_hash <> extensions.crypt(p, r.pass_hash) then
    raise exception 'invalid credentials' using errcode = '28000';
  end if;

  if kind not in ('tpl', 'trait') then
    raise exception 'bad rule kind' using errcode = '22023';
  end if;
  if key is null or btrim(key) = '' or length(key) > 60 then
    raise exception 'bad rule key' using errcode = '22023';
  end if;

  select data into cur from public.progress where username = child;
  if cur is null then
    raise exception 'no such child' using errcode = '28000';
  end if;

  if cur->'rules' is null then
    cur := jsonb_set(cur, '{rules}', '{}'::jsonb, true);
  end if;
  if cur->'rules'->kind is null then
    cur := jsonb_set(cur, array['rules', kind], '{}'::jsonb, true);
  end if;

  if blocked then
    cur := jsonb_set(cur, array['rules', kind, key], jsonb_build_object(
      'by', uname,
      'at', (extract(epoch from now()) * 1000)::bigint), true);
  else
    cur := cur #- array['rules', kind, key];          -- allowed again
  end if;

  cur := jsonb_set(cur, '{rev}', to_jsonb(coalesce((cur->>'rev')::int, 0) + 1), true);
  update public.progress set data = cur, updated_at = now() where username = child;
  return cur;
end;
$$;

grant execute on function public.set_rule(text, text, text, text, boolean) to anon;


-- A note in the parent's own words, hung on the soort som it is about. Passing
-- null wipes the notes on that template again.
create or replace function public.add_note(u text, p text, tpl text, note text)
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
  list  jsonb;
begin
  if uname not like '%-ouder' then
    raise exception 'only a parent may leave a note' using errcode = '28000';
  end if;

  select * into r from public.progress where username = uname;
  if not found or r.pass_hash <> extensions.crypt(p, r.pass_hash) then
    raise exception 'invalid credentials' using errcode = '28000';
  end if;

  if tpl is null or btrim(tpl) = '' or length(tpl) > 60 then
    raise exception 'bad template' using errcode = '22023';
  end if;
  if note is not null and length(note) > 400 then
    raise exception 'note too long' using errcode = '22023';
  end if;

  select data into cur from public.progress where username = child;
  if cur is null then
    raise exception 'no such child' using errcode = '28000';
  end if;

  if cur->'notes' is null then
    cur := jsonb_set(cur, '{notes}', '{}'::jsonb, true);
  end if;

  if note is null or btrim(note) = '' then
    cur := cur #- array['notes', tpl];
  else
    list := coalesce(cur->'notes'->tpl, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'text', btrim(note),
        'by',   uname,
        'at',   (extract(epoch from now()) * 1000)::bigint));
    -- keep the last five; a note is a reminder, not a diary
    if jsonb_array_length(list) > 5 then
      list := (select jsonb_agg(x) from (
                 select x from jsonb_array_elements(list) with ordinality t(x, i)
                 order by i desc limit 5) s(x));
      list := (select jsonb_agg(x) from (
                 select x from jsonb_array_elements(list) with ordinality t(x, i)
                 order by i desc) s(x));
    end if;
    cur := jsonb_set(cur, array['notes', tpl], list, true);
  end if;

  cur := jsonb_set(cur, '{rev}', to_jsonb(coalesce((cur->>'rev')::int, 0) + 1), true);
  update public.progress set data = cur, updated_at = now() where username = child;
  return cur;
end;
$$;

grant execute on function public.add_note(text, text, text, text) to anon;
