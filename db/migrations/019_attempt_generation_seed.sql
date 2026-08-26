-- 019_attempt_generation_seed.sql
-- TE-P3 — assess.attempt needs its own generation seed. assess.test already
-- has generation_seed (bigint), but that's one value per test definition,
-- not per attempt; TE-P3's BLUEPRINT assembly ("Randomisation is seeded per
-- attempt and the seed is stored on the attempt row, so a paper can be
-- reconstructed exactly for dispute resolution") needs a value unique to
-- each attempt. docs/DB_STATE.md confirmed no equivalent column exists on
-- assess.attempt — genuinely missing, not a rename.

alter table assess.attempt
    add column if not exists generation_seed bigint;

insert into util.applied_migration (migration_name) values ('019_attempt_generation_seed')
on conflict (migration_name) do nothing;
