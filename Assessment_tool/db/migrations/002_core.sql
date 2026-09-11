-- 002_core.sql
-- Lumen Academy — core schema: 9 relations.
--
-- Sources: docs/db/SCHEMA_SPEC.md (keys, FK edge list),
-- docs/design/03_conceptual_er_low_level_revA.md (descriptive attribute names).
-- Depends on: 000_foundation.sql, 001_catalog.sql (batch/enrollment FK to
-- catalog.exam_cycle).
--
-- D-1 identity model (resolved with the user this turn, per CLAUDE.md's
-- explicit "do not resolve alone" flag): Supabase Auth, not app-owned
-- password_hash. app_user.auth_user_id references auth.users(id) instead of
-- the password_hash column the low-level ER's attribute list names — matches
-- what backend/supabaseClient.ts already assumes (verifies via auth.getUser).
--
-- NOTE on app_user.institution_id nullability: made nullable because
-- docs/design/02_conceptual_er_high_level_revA.md states explicitly
-- "APP_USER belongs to at most one institution" (0..1 cardinality on that end)
-- — not inferred, it's the documented cardinality.
--
-- NOTE on batch_member's PK: the low-level conceptual ER shows a surrogate
-- batch_member_id, but SCHEMA_SPEC.md (logical phase) gives it a composite PK
-- (batch_id, user_id), and 04_logical_relational_schema.md's mapping rule R3
-- says exactly this: "every M:N relationship becomes an associative relation
-- whose primary key is the pair of migrated keys — ... batch_member ...".
-- The logical model supersedes the conceptual placeholder per that rule.

-- --------------------------------------------------------------- core.institution
create table if not exists core.institution (
  institution_id     uuid primary key default gen_random_uuid(),
  institution_code   text not null,
  name               text not null,
  institution_type   text,
  default_locale     text,
  status             text not null,
  created_at         timestamptz not null default now(),
  constraint uq_institution_institution_code unique (institution_code)
);

-- ------------------------------------------------------------ core.subscription_plan
create table if not exists core.subscription_plan (
  plan_id            uuid primary key default gen_random_uuid(),
  tier_code          text not null,
  tier_name          text not null,
  feature_matrix     jsonb not null default '{}'::jsonb,
  language_access    jsonb not null default '[]'::jsonb,
  price_amount       numeric,
  duration_days      smallint,
  constraint uq_subscription_plan_tier_code unique (tier_code)
);

-- --------------------------------------------------------------------- core.app_user
create table if not exists core.app_user (
  user_id               uuid primary key default gen_random_uuid(),
  institution_id        uuid,
  auth_user_id          uuid not null,
  email                 text not null,
  mobile_number         text not null,
  full_name             text not null,
  user_role             text not null,
  preferred_language    text,
  status                text not null,
  last_login_at         timestamptz,
  constraint fk_app_user_institution_id foreign key (institution_id) references core.institution (institution_id),
  constraint fk_app_user_auth_user_id foreign key (auth_user_id) references auth.users (id),
  constraint uq_app_user_auth_user_id unique (auth_user_id),
  constraint uq_app_user_email unique (email),
  constraint uq_app_user_mobile_number unique (mobile_number)
);

-- ---------------------------------------------------------------- core.student_profile
create table if not exists core.student_profile (
  user_id                 uuid primary key,
  target_year             smallint,
  class_level             text,
  guardian_contact        text,
  daily_study_minutes     smallint,
  onboarding_state        text,
  constraint fk_student_profile_user_id foreign key (user_id) references core.app_user (user_id)
);

-- --------------------------------------------------------------- core.educator_profile
create table if not exists core.educator_profile (
  user_id               uuid primary key,
  specialisation        text,
  may_author            boolean not null default false,
  may_approve           boolean not null default false,
  assigned_subjects     jsonb not null default '[]'::jsonb,
  constraint fk_educator_profile_user_id foreign key (user_id) references core.app_user (user_id)
);

-- ------------------------------------------------------------------------ core.batch
create table if not exists core.batch (
  batch_id           uuid primary key default gen_random_uuid(),
  institution_id     uuid not null,
  cycle_id           uuid not null,
  batch_code         text not null,
  batch_name         text not null,
  academic_year      text,
  start_date         date,
  end_date           date,
  constraint fk_batch_institution_id foreign key (institution_id) references core.institution (institution_id),
  constraint fk_batch_cycle_id foreign key (cycle_id) references catalog.exam_cycle (cycle_id),
  constraint uq_batch_batch_code unique (batch_code)
);

-- ----------------------------------------------------------------- core.batch_member
create table if not exists core.batch_member (
  batch_id         uuid not null,
  user_id          uuid not null,
  joined_on        date,
  left_on          date,
  member_status    text,
  constraint pk_batch_member primary key (batch_id, user_id),
  constraint fk_batch_member_batch_id foreign key (batch_id) references core.batch (batch_id),
  constraint fk_batch_member_user_id foreign key (user_id) references core.app_user (user_id)
);

-- ------------------------------------------------------------------ core.subscription
create table if not exists core.subscription (
  subscription_id       uuid primary key default gen_random_uuid(),
  user_id               uuid not null,
  plan_id               uuid not null,
  started_on            date,
  expires_on            date,
  payment_reference     text,
  subscription_status   text not null,
  constraint fk_subscription_user_id foreign key (user_id) references core.app_user (user_id),
  constraint fk_subscription_plan_id foreign key (plan_id) references core.subscription_plan (plan_id)
);

-- -------------------------------------------------------------------- core.enrollment
create table if not exists core.enrollment (
  enrollment_id          uuid primary key default gen_random_uuid(),
  user_id                uuid not null,
  cycle_id               uuid not null,
  enrolled_on            date,
  target_score           numeric,
  preferred_language     text,
  enrollment_status      text not null,
  constraint fk_enrollment_user_id foreign key (user_id) references core.app_user (user_id),
  constraint fk_enrollment_cycle_id foreign key (cycle_id) references catalog.exam_cycle (cycle_id),
  constraint uq_enrollment_user_id_cycle_id unique (user_id, cycle_id)
);
