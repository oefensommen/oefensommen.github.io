-- Oefensommen — the parent tells the app which sommen are too hard or too easy
-- Run with ./scripts/db.sh supabase-tuning.sql. Safe to run more than once.
--
-- The app can see THAT a som went wrong; it cannot see why. A parent sitting
-- next to the child can: this soort som is still too much, that one is beneath
-- them now. Each verdict nudges that template one step easier or one step
-- harder, for good, until the parent says otherwise.
--
-- Like set_day_mark, this is the parent side writing to exactly one place —
-- data.tuning — and nothing else. The history stays the child's.

create or replace function public.set_tuning(u text, p text, tpl text, verdict text)
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
  adj   int;
begin
  if uname not like '%-ouder' then
    raise exception 'only a parent may tune a som' using errcode = '28000';
  end if;

  select * into r from public.progress where username = uname;
  if not found or r.pass_hash <> extensions.crypt(p, r.pass_hash) then
    raise exception 'invalid credentials' using errcode = '28000';
  end if;

  if tpl is null or btrim(tpl) = '' or length(tpl) > 60 then
    raise exception 'bad template' using errcode = '22023';
  end if;
  if verdict is not null and verdict not in ('hard', 'easy') then
    raise exception 'bad verdict' using errcode = '22023';
  end if;

  select data into cur from public.progress where username = child;
  if cur is null then
    raise exception 'no such child' using errcode = '28000';
  end if;

  if cur->'tuning' is null then
    cur := jsonb_set(cur, '{tuning}', '{}'::jsonb, true);
  end if;

  adj := coalesce((cur->'tuning'->tpl->>'adj')::int, 0);

  if verdict is null then
    cur := cur #- array['tuning', tpl];             -- back to normal
  else
    -- "too hard" walks the som down, "too easy" walks it up, two steps either
    -- way. Two steps is enough to change a som's character without turning a
    -- groep 5 som into a groep 3 one.
    adj := greatest(-2, least(2, adj + case verdict when 'easy' then 1 else -1 end));
    if adj = 0 then
      cur := cur #- array['tuning', tpl];
    else
      cur := jsonb_set(cur, array['tuning', tpl], jsonb_build_object(
        'adj', adj,
        'by',  uname,
        'at',  (extract(epoch from now()) * 1000)::bigint), true);
    end if;
  end if;

  -- step the revision so the child's devices take this in without arguing
  cur := jsonb_set(cur, '{rev}', to_jsonb(coalesce((cur->>'rev')::int, 0) + 1), true);

  update public.progress set data = cur, updated_at = now() where username = child;
  return cur;
end;
$$;

grant execute on function public.set_tuning(text, text, text, text) to anon;
