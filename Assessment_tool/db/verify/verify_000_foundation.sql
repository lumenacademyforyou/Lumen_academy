-- verify_000_foundation.sql
-- Asserts every object created by db/migrations/000_foundation.sql exists.
-- A migration is not done until this passes (CLAUDE.md migration rule 3).

do $$
declare
  missing text[] := array[]::text[];
  s text;
  e text;
begin
  foreach s in array array['catalog', 'core', 'content', 'assess', 'learn', 'util'] loop
    if not exists (select 1 from information_schema.schemata where schema_name = s) then
      missing := array_append(missing, 'schema:' || s);
    end if;
  end loop;

  foreach e in array array['pgcrypto', 'pg_trgm', 'vector', 'pg_partman'] loop
    if not exists (select 1 from pg_extension where extname = e) then
      missing := array_append(missing, 'extension:' || e);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception 'verify_000_foundation FAILED — missing: %', array_to_string(missing, ', ');
  end if;

  raise notice 'verify_000_foundation: OK — 6 schemas, 4 extensions present';
end $$;
