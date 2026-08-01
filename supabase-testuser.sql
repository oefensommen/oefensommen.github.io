-- A throwaway account for trying things out, completely separate from TAK.
-- Only ever touches the rows named below; TAK's history is never referenced.
--
--   test        / 2026   (child)
--   test-ouder  / 2020   (parent of "test", by the same <child>-ouder rule)

insert into public.progress (username, pass_hash, data)
values ('test', extensions.crypt('2026', extensions.gen_salt('bf')), '{}'::jsonb)
on conflict (username) do update
  set pass_hash = excluded.pass_hash;      -- keeps whatever progress it has

insert into public.progress (username, pass_hash, data)
values ('test-ouder', extensions.crypt('2020', extensions.gen_salt('bf')), '{}'::jsonb)
on conflict (username) do update
  set pass_hash = excluded.pass_hash;
