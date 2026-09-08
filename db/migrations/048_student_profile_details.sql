-- 048 — core.student_profile: institution, study stage/year, and date of birth.
--
-- LA-UX-REFRESH-001 F2 (docs/ux-refresh-prompt.md). The profile form only
-- ever collected target year, class level, guardian contact and daily study
-- minutes; the app now asks for where the student actually studies (school /
-- college / university / coaching centre, its name and location), what stage
-- and year/course they are in, and their date of birth.
--
-- All six columns are nullable with no default: every existing row is a real
-- student profile that simply predates these questions, and a NULL here means
-- "not answered yet" — which is exactly what the UI shows. Nothing is
-- backfilled and no existing value is touched.
--
-- daily_study_minutes is deliberately NOT replaced. The UI stops offering a
-- free-text minutes box and offers fixed time tags (30/45/60/90/120/180)
-- instead, but the stored unit stays minutes so values recorded before this
-- change remain directly comparable with the ones recorded after it.
--
-- The two CHECK constraints allow NULL explicitly (an unanswered question is
-- not an invalid answer) and follow the same vocabulary style as
-- 012_domain_checks.sql's ck_institution_type.

begin;

alter table core.student_profile
  add column if not exists institution_kind      text,
  add column if not exists institution_name      text,
  add column if not exists institution_location  text,
  add column if not exists study_stage           text,
  add column if not exists study_year            text,
  add column if not exists date_of_birth         date;

alter table core.student_profile
  drop constraint if exists ck_student_profile_institution_kind;
alter table core.student_profile
  add constraint ck_student_profile_institution_kind
  check (institution_kind is null or institution_kind in
    ('school', 'college', 'university', 'coaching_centre', 'other'));

alter table core.student_profile
  drop constraint if exists ck_student_profile_study_stage;
alter table core.student_profile
  add constraint ck_student_profile_study_stage
  check (study_stage is null or study_stage in
    ('secondary', 'higher_secondary', 'undergraduate', 'postgraduate', 'dropper', 'other'));

-- A date of birth in the future, or one implying an age no student could
-- have, is a data-entry error rather than a fact worth storing. 1900 is the
-- floor purely because it is unambiguously wrong below that.
alter table core.student_profile
  drop constraint if exists ck_student_profile_date_of_birth;
alter table core.student_profile
  add constraint ck_student_profile_date_of_birth
  check (date_of_birth is null or (date_of_birth > date '1900-01-01' and date_of_birth < current_date));

commit;
