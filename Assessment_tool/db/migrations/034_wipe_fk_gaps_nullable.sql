-- 034_wipe_fk_gaps_nullable.sql
-- Found live while running db/scripts/reset-user-data.ts: db/shared/
-- wipe-user-data.ts's FK graph never accounted for four columns that
-- reference core.app_user but live on tables it explicitly does NOT delete
-- (content.*/core.invitation are audit/provenance records, not user-owned
-- data) — a full wipe hit `fk_ai_generation_job_requested_by` immediately
-- (23503, transaction rolled back cleanly, nothing lost). A `pg_constraint`
-- sweep of every FK into core.app_user found three more of the same shape
-- that would have broken the very next attempt: content.import_batch.
-- submitted_by (ON DELETE RESTRICT), content.question_review.
-- reviewer_user_id, core.invitation.invited_by (both ON DELETE NO ACTION).
-- All four were NOT NULL, so there was no way to sever the pointer without
-- this migration first.
--
-- These rows are never deleted (they're valuable audit trail — who
-- requested a generation job, who submitted an import batch, who reviewed a
-- question, who sent an invitation) — only the now-dangling pointer to a
-- removed user is nulled, the same ON DELETE SET NULL semantics this schema
-- already uses for core.user_role_assignment.granted_by (009_core_rbac.sql).

alter table content.ai_generation_job alter column requested_by drop not null;
alter table content.import_batch alter column submitted_by drop not null;
alter table content.question_review alter column reviewer_user_id drop not null;
alter table core.invitation alter column invited_by drop not null;

insert into util.applied_migration (migration_name) values ('034_wipe_fk_gaps_nullable')
on conflict (migration_name) do nothing;
