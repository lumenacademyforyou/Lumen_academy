-- 045_audit_outlives_question — let content.question_identity_audit survive the
-- hard deletion of the question it describes.
--
-- WHY THIS IS NEEDED
-- ------------------
-- The 866 duplicate_archived rows are soft-deleted duplicates that earlier
-- passes retired but never physically removed. Removing them for real runs
-- into one blocker:
--
--     question_identity_audit.question_id  NOT NULL, ON DELETE NO ACTION
--
-- 933 audit rows point at those questions. With that FK, deleting a question
-- forces deleting the audit row that records what happened to it — the audit
-- trail would be destroyed by the very operation it exists to document.
--
-- An audit row must outlive its subject. So:
--
--   * question_id becomes NULLABLE with ON DELETE SET NULL, and
--   * question_uid is added, carrying the human identity as TEXT, which no
--     foreign key can null out.
--
-- After a purge the audit row still says "LMN-ZOO-ZOO09-000012 was retired
-- into <survivor> by run <id>, and here is its full content", with
-- payload_json holding the question, its options, solution and translations.
-- That is what makes the deletion recoverable.
--
-- content.import_row already does the right thing (ON DELETE SET NULL) and is
-- left alone: its rows record "this line of this import file produced a
-- question", which stays true after the question is gone.
--
-- Idempotent. Safe to re-run.

begin;

alter table content.question_identity_audit
  add column if not exists question_uid text;

comment on column content.question_identity_audit.question_uid is
  'The question''s LMN-... identity, carried as text so the audit row remains meaningful after the question row is hard-deleted and question_id is nulled by the FK.';

-- Backfill from the live rows before anything is deleted.
update content.question_identity_audit a
   set question_uid = q.question_uid
  from content.question q
 where q.question_id = a.question_id
   and a.question_uid is null;

-- Drop NOT NULL, then swap the FK for ON DELETE SET NULL.
alter table content.question_identity_audit
  alter column question_id drop not null;

do $$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'content.question_identity_audit'::regclass
       and conname = 'question_identity_audit_question_id_fkey'
       and confdeltype <> 'n'   -- 'n' = SET NULL
  ) then
    alter table content.question_identity_audit
      drop constraint question_identity_audit_question_id_fkey;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'content.question_identity_audit'::regclass
       and conname = 'question_identity_audit_question_id_fkey'
  ) then
    alter table content.question_identity_audit
      add constraint question_identity_audit_question_id_fkey
      foreign key (question_id) references content.question(question_id)
      on delete set null;
  end if;
end $$;

create index if not exists ix_question_identity_audit_uid
  on content.question_identity_audit (question_uid);

commit;
