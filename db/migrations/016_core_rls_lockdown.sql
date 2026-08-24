-- 016_core_rls_lockdown.sql
-- Security fix, triggered by Supabase's own Security Advisor (reported live
-- by the user) flagging RLS-disabled on core.* tables. Checked live before
-- writing this and found it goes further than reported: every table in
-- core, catalog, content, assess and learn — not just the tables the
-- Advisor named — has row-level security disabled. This whole schema group
-- was always meant to sit outside PostgREST's reach entirely (see
-- backend/supabaseAdmin.ts's header comment and this document's own ground
-- rule 5), but the live project's "exposed schemas" setting evidently
-- includes at least core (the Advisor only flags RLS on schemas PostgREST
-- can actually serve, so its warning is itself proof of exposure CL-P0
-- could never confirm from the repo alone) — and if core is exposed, the
-- same dashboard setting plausibly exposes its siblings too, added as one
-- block. Without RLS, anyone holding the publishable key (public by
-- design, embedded in the frontend bundle) can read or write these tables
-- directly over the REST API — including assess.attempt, real students'
-- actual test-taking data — bypassing every permission/tenancy/audit check
-- the Express backend enforces.
--
-- Fix: enable RLS on every table in these five schemas, with NO policies
-- attached. In Postgres, RLS-enabled-with-zero-policies means default-deny
-- for every role except the table owner and roles with the BYPASSRLS
-- attribute. Confirmed live before writing this: the backend's own DB
-- connection (DATABASE_URL, role 'postgres') has bypassrls = true, and
-- Supabase's service_role key bypasses RLS the same way at the PostgREST
-- layer — so this changes nothing for the backend or for admin/seed/e2e
-- scripts, and only blocks the anon/authenticated roles PostgREST actually
-- uses for browser-originated requests. This is a deliberate full lockout,
-- not a partial one: no self-access policies are added, because the
-- intended access path for every one of these schemas is exclusively
-- through the backend, which already re-implements every scoping rule RLS
-- policies would otherwise need to express a second time. A dynamic loop
-- is used rather than an explicit ALTER TABLE per table specifically so a
-- table added later in these schemas is never silently missed.
do $$
declare
  t record;
begin
  for t in
    select schemaname, tablename
      from pg_tables
     where schemaname in ('core', 'catalog', 'content', 'assess', 'learn')
       and rowsecurity = false
  loop
    execute format('alter table %I.%I enable row level security', t.schemaname, t.tablename);
    raise notice 'enabled RLS on %.%', t.schemaname, t.tablename;
  end loop;
end $$;
