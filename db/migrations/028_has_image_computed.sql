-- 028_has_image_computed.sql
-- Test-layer hardening E2 (docs/test-layer-hardening-prompt.md,
-- docs/BUGS.md#E2, docs/AUDIT.md). content.question.has_image
-- (010_content_rich.sql) is a plain boolean with a static default, never a
-- generated/computed value — the real import path
-- (db/scripts/import/import-content.ts) never references it at all
-- (confirmed by grep: zero matches), so every imported question defaults to
-- false regardless of whether a content.asset row is created for it. The
-- only writer anywhere was a manual, human-run script
-- (db/scripts/manual/verify-image-assets.ts --fix); two more manual scripts
-- exist purely to detect this exact drift after the fact
-- (audit-image-assets.ts, verify-image-serving.ts) — their existence is
-- direct evidence this was already a live, recurring problem.
--
-- Approach (b) from BUGS.md#E2's proposed fix (keep the denormalized column,
-- maintain it via a trigger) rather than (a) (drop the column, replace every
-- reader with a join) — has_image has exactly one live reader today
-- (backend/src/controllers/questionController.ts), so (a)'s full blast
-- radius isn't justified, but the recommended default (b) still gives a
-- hard guarantee the column can never drift again.
--
-- The predicate mirrors db/assess/test/attempt/envelope.ts's own real
-- "does this question show an image" ground truth exactly — content.asset
-- rows for the question with target_role in ('stem','option') (the two
-- roles envelope.ts's own imagesByQuestion query reads; 'solution'/'hint'/
-- 'passage'/'explanation' assets are not shown during the exam and must not
-- flip has_image), with no asset_type filter, since envelope.ts's own query
-- applies none either — has_image must track exactly what actually renders,
-- not a stricter definition invented here that could itself drift from the
-- real behavior.

-- One-time backfill: correct any existing drift immediately on apply (the
-- same fix verify-image-assets.ts --fix applies manually, now automatic and
-- exhaustive rather than opt-in).
update content.question q
   set has_image = exists (
         select 1 from content.asset a
          where a.question_id = q.question_id and a.target_role in ('stem', 'option')
       )
 where has_image is distinct from exists (
         select 1 from content.asset a
          where a.question_id = q.question_id and a.target_role in ('stem', 'option')
       );

-- Keeps has_image correct going forward regardless of write path — an
-- insert/update/delete on content.asset recomputes has_image for every
-- question_id it could have affected. Scoped to question_id (not
-- group_id) — no live content.asset row targets a question_group yet
-- (E6/the group concept is forward-looking, not built), so extending this
-- trigger to groups now would be speculative; revisit when that concept is
-- actually built rather than guessing its shape here.
create or replace function content.trg_asset_sync_has_image() returns trigger as $$
begin
  if TG_OP in ('INSERT', 'UPDATE') and new.question_id is not null then
    update content.question
       set has_image = exists (
             select 1 from content.asset a
              where a.question_id = new.question_id and a.target_role in ('stem', 'option')
           )
     where question_id = new.question_id;
  end if;
  if TG_OP in ('DELETE', 'UPDATE') and old.question_id is not null
     and (TG_OP = 'DELETE' or old.question_id is distinct from new.question_id) then
    update content.question
       set has_image = exists (
             select 1 from content.asset a
              where a.question_id = old.question_id and a.target_role in ('stem', 'option')
           )
     where question_id = old.question_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql;

drop trigger if exists trg_asset_sync_has_image on content.asset;
create trigger trg_asset_sync_has_image
  after insert or delete or update of question_id, target_role on content.asset
  for each row execute function content.trg_asset_sync_has_image();

insert into util.applied_migration (migration_name) values ('028_has_image_computed')
on conflict (migration_name) do nothing;
