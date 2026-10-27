-- The parent's own words, kept out of the child's way.
--
-- `save_progress` takes the blob the child's device hands it and makes it the
-- record, whole. Every one of the parent's tools writes through its own
-- function, bumps the revision and hands the new record back — to the PARENT's
-- device. The child's device knows nothing about it, and the next som it
-- answers is pushed about a second later with a blob that never had the
-- parent's verdict in it. The verdict is gone, and the parent's own screen
-- still shows it as set.
--
-- The child never writes these four keys, so there is nothing to merge and
-- nothing to argue about: whatever the record already holds for `marks`,
-- `rules`, `tuning` and `notes` is kept, and the rest of the blob is taken as
-- it comes.
--
-- Run this once against the project. It replaces save_progress and nothing
-- else; the grant below is the same one it already has.

create or replace function public.save_progress(u text, p text, d jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r   public.progress%rowtype;
  mine jsonb;
begin
  select * into r from public.progress where username = lower(trim(u));
  if not found or r.pass_hash <> extensions.crypt(p, r.pass_hash) then
    raise exception 'invalid credentials' using errcode = '28000';
  end if;

  -- the four the parent owns, as the record holds them now
  mine := coalesce(r.data, '{}'::jsonb);
  mine := jsonb_strip_nulls(jsonb_build_object(
            'marks',  mine -> 'marks',
            'rules',  mine -> 'rules',
            'tuning', mine -> 'tuning',
            'notes',  mine -> 'notes'));

  update public.progress
     set data = coalesce(d, '{}'::jsonb) || mine,   -- the parent's keys win
         updated_at = now()
   where username = r.username;
end;
$$;

grant execute on function public.save_progress(text, text, jsonb) to anon;
