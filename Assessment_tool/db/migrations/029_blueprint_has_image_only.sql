-- 029_blueprint_has_image_only.sql
-- Image-based test type (docs/BUGS.md#E1-E3, user ask: "build a test for
-- image based test in the whole application system"). A blueprint line can
-- already filter by difficulty_band/question_format (018_test_engine.sql);
-- this adds the same shape of optional filter for "only questions that
-- carry an image" — has_image is now reliably trigger-maintained
-- (028_has_image_computed.sql), so this is safe to build on.
--
-- Deliberately a boolean flag on the line, not a new test_type — an
-- image-based practice test is still assembled the same BLUEPRINT way as
-- any subject-wise/custom test, just with this one extra eligibility
-- predicate; it doesn't need its own taxonomy entry (F4's own config-
-- consolidation lesson: don't add a new dimension where an existing one
-- already fits).
alter table assess.test_blueprint
  add column if not exists has_image_only boolean not null default false;

insert into util.applied_migration (migration_name) values ('029_blueprint_has_image_only')
on conflict (migration_name) do nothing;
