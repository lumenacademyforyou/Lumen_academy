-- 035_test_created_by_nullable.sql
-- Second real gap found live running db/scripts/reset-user-data.ts (after
-- migration 034 fixed the first four): assess.test.created_by is NOT NULL,
-- ON DELETE NO ACTION, and wipeUserOwnedData only ever deletes a user's own
-- source_type='generated' tests (their private, per-session practice
-- papers) — an 'authored'/'pyq' test (a real, shared curriculum paper) is
-- correctly left alone by that logic, but that leaves its created_by
-- pointing at a user a full wipe is about to delete. Same fix shape as 034:
-- the paper itself is shared content and must never be deleted; only the
-- now-dangling attribution is nulled.

alter table assess.test alter column created_by drop not null;

insert into util.applied_migration (migration_name) values ('035_test_created_by_nullable')
on conflict (migration_name) do nothing;
