# Database state — measured fact (TE-P0)

Produced by querying the live Supabase Postgres 16 database directly (`npx tsx db/scripts/query.ts`)
on 2026-08-25. Supersedes brief Section 1.6's estimate for everything below. Where this file and
`db/MIGRATION_STATE.md` (prior session, 2026-08-23) disagree, **this file wins** — it was verified
live today; `MIGRATION_STATE.md` describes state that no longer exists (see "Data reality vs
MIGRATION_STATE.md" at the end).

---

## 1. Migration ledger

**No custom migration-ledger table exists.** Checked `information_schema.tables` / `pg_tables`
across every schema for anything named `_migrations`, `schema_migrations`, etc. Found only:

| Table | Belongs to | Notes |
|---|---|---|
| `public._prisma_migrations` | Prisma's own tooling | 4 rows, all `rolled_back_at IS NULL` (see §6) |
| `auth.schema_migrations`, `storage.migrations`, `realtime.schema_migrations` | Supabase platform internals | Not ours, not evidence of our migrations |

The raw-SQL track (`db/migrations/000`–`017`) has **no ledger at all** — "applied" is inferred
purely from live schema shape matching each file's DDL (spot-checked below), exactly as brief
work item 3 anticipates. TE-P1 must create this ledger and backfill it — it does not exist yet.

## 2. Migration files on disk

18 migration files, `000`–`017` (not `000`–`006` as brief §1.6 believed), each with a matching
`db/verify/verify_0NN_*.sql` (18 files, 1:1, plus one extra `verify_content.sql` not tied to a
single numbered migration):

| # | File | Bytes |
|---|---|---|
| 000 | `000_foundation.sql` | 1,994 |
| 001 | `001_catalog.sql` | 7,883 |
| 002 | `002_core.sql` | 6,796 |
| 003 | `003_content.sql` | 9,867 |
| 004 | `004_assess.sql` | 8,936 |
| 005 | `005_learn.sql` | 6,710 |
| 006 | `006_pgvector_index.sql` | 1,412 |
| 007 | `007_core_mobile_nullable.sql` | 1,503 |
| 008 | `008_catalog_taxonomy.sql` | 8,694 |
| 009 | `009_core_rbac.sql` | 7,410 |
| 010 | `010_content_rich.sql` | 12,254 |
| 011 | `011_assess_scope.sql` | 8,682 |
| 012 | `012_domain_checks.sql` | 4,842 |
| 013 | `013_content_import.sql` | 2,077 |
| 014 | `014_core_status_expansion.sql` | 1,384 |
| 015 | `015_core_invitation.sql` | 2,968 |
| 016 | `016_core_rls_lockdown.sql` | 2,730 |
| 017 | `017_core_member_code.sql` | 1,001 |

All 18 verified live against the running database this session (table/column presence, the
`core.app_user.member_code` column and its unique constraint from 017, RLS enabled on every table
in `core/catalog/content/assess/learn` from 016 — spot-checked, see §4/§5). **000–017 are all
applied.** `009_core_rbac.sql`, `011_assess_scope.sql`, `013_content_import.sql` — the three the
brief believed unapplied — are confirmed applied live (their tables/columns/constraints exist,
e.g. `core.role`/`core.permission`/`core.user_role_assignment` from 009 have data; `content.asset`'s
`option_id`/`group_id` columns from 010/011 exist; `content.import_batch`/`content.import_row`
from 013 exist as empty tables). Migration `007` in this repo is `007_core_mobile_nullable.sql`,
**not** a partitioning migration — the brief's "007 = partitioning, deferred" does not describe
anything on disk here; there is no partitioning migration in this repository at all.

## 3. Live table inventory, all 6 schemas

Confirmed via `information_schema.tables`:

| Schema | Base tables | Views | Notes |
|---|---|---|---|
| `util` | **0** | 0 | Schema exists (created by `000_foundation.sql`), never populated. Zero tables, zero functions, zero anything, across all 18 migrations. |
| `catalog` | 11 | 1 (`v_section_marking`) | |
| `core` | 14 | 0 | |
| `content` | 16 | 0 | |
| `assess` | 10 | 0 | |
| `learn` | 9 | 0 | |
| `public` | 28 | 1 (`table_privs`, an unrelated grants-inspection view, not app data) | 2 of the 28 (`part_config`, `part_config_sub`) are `pg_partman` extension bookkeeping tables, not application data and not Prisma models — harmless, not a drift item. |

Brief §"you already know" said 10/11/16/14/9/28 across assess/catalog/content/core/learn/public —
**confirmed exactly right** for base-table counts. `catalog` additionally has 1 view; `public` has
1 unrelated view.

## 4. Full schema definitions — `assess`, `catalog`, `content`, `core`, `learn`

### 4.1 Columns

**assess** (10 tables):
- `attempt`: attempt_id uuid PK default gen_random_uuid(), test_id uuid NOT NULL, user_id uuid NOT NULL, assignment_id uuid, attempt_no smallint NOT NULL, started_at timestamptz, server_deadline timestamptz, submitted_at timestamptz, elapsed_seconds integer, attempt_state text NOT NULL, device_fingerprint text, sync_state text
- `attempt_event`: event_id uuid PK default gen_random_uuid(), attempt_id uuid NOT NULL, event_type text NOT NULL, event_at timestamptz, event_payload jsonb
- `attempt_response`: response_id uuid PK default gen_random_uuid(), attempt_id uuid NOT NULL, test_question_id uuid NOT NULL, option_id uuid, selected_option_label text, numeric_answer numeric, response_state text NOT NULL, time_spent_seconds integer, visit_count smallint, is_correct boolean, marks_awarded numeric
- `scorecard`: scorecard_id uuid PK default gen_random_uuid(), attempt_id uuid NOT NULL, obtained_marks numeric, total_marks numeric, accuracy_percent numeric, percentile numeric, rank_in_cohort integer, generated_at timestamptz
- `section_score`: section_score_id uuid PK default gen_random_uuid(), scorecard_id uuid NOT NULL, test_section_id uuid NOT NULL, obtained_marks numeric, attempted_count smallint, correct_count smallint, average_time_seconds numeric
- `test`: test_id uuid PK default gen_random_uuid(), test_code text NOT NULL, pattern_id uuid NOT NULL, cycle_id uuid, created_by uuid NOT NULL, title text NOT NULL, test_mode text, language_set jsonb NOT NULL DEFAULT '[]', total_marks numeric, duration_minutes smallint, window_opens_at timestamptz, window_closes_at timestamptz, test_status text NOT NULL, exam_id uuid, scope_type text NOT NULL DEFAULT 'custom', source_type text NOT NULL DEFAULT 'authored', source_cycle_id uuid, syllabus_version_id uuid, language_code text NOT NULL DEFAULT 'en', is_public boolean NOT NULL DEFAULT false, generation_seed bigint
- `test_assignment`: assignment_id uuid PK default gen_random_uuid(), test_id uuid NOT NULL, user_id uuid, batch_id uuid, audience_type text, scopes jsonb, assigned_on date, due_on date, assignment_status text NOT NULL
- `test_question`: test_question_id uuid PK default gen_random_uuid(), test_section_id uuid NOT NULL, question_id uuid NOT NULL, sequence_no smallint NOT NULL, marks_override numeric, is_optional boolean NOT NULL DEFAULT false, shuffle_seed bigint, question_revision integer NOT NULL
- `test_scope_node`: test_id uuid NOT NULL, node_id uuid NOT NULL (PK is the pair)
- `test_section`: test_section_id uuid PK default gen_random_uuid(), test_id uuid NOT NULL, pattern_section_id uuid NOT NULL, section_name text NOT NULL, sequence_no smallint NOT NULL, question_count smallint, section_marks numeric

**catalog** (11 tables + 1 view):
- `exam`: exam_id uuid PK, exam_code text NOT NULL, display_name text NOT NULL, conducting_body text, exam_level text, supported_languages jsonb NOT NULL DEFAULT '[]', is_active boolean NOT NULL DEFAULT true, family_id uuid
- `exam_cycle`: cycle_id uuid PK, exam_id uuid NOT NULL, cycle_year smallint NOT NULL, exam_date date, registration_opens_on date, cycle_status text NOT NULL
- `exam_family`: family_id uuid PK, family_code text NOT NULL, family_name text NOT NULL, description text, is_active boolean NOT NULL DEFAULT true, created_at/updated_at timestamptz NOT NULL DEFAULT now()
- `exam_pattern`: pattern_id uuid PK, cycle_id uuid NOT NULL, scheme_id uuid NOT NULL, version_no smallint NOT NULL, effective_from date, total_questions smallint NOT NULL, total_marks numeric NOT NULL, duration_minutes smallint NOT NULL, is_current boolean NOT NULL DEFAULT false
- `marking_scheme`: scheme_id uuid PK, scheme_code text NOT NULL, correct_marks numeric NOT NULL, incorrect_marks numeric NOT NULL, unattempted_marks numeric NOT NULL DEFAULT 0, partial_credit_rule text, numeric_tolerance_pct numeric
- `node_level`: level_id uuid PK, exam_id uuid NOT NULL, level_no smallint NOT NULL, level_code text NOT NULL, level_label text NOT NULL, is_taggable boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
- `node_weightage`: weightage_id uuid PK, pattern_id uuid NOT NULL, node_id uuid NOT NULL, weight_marks numeric, expected_questions smallint, priority_rank smallint
- `pattern_section`: pattern_section_id uuid PK, pattern_id uuid NOT NULL, subject_id uuid NOT NULL, scheme_id uuid, section_name text NOT NULL, sequence_no smallint NOT NULL, question_count smallint NOT NULL, optional_count smallint NOT NULL DEFAULT 0, section_time_limit smallint
- `subject`: subject_id uuid PK, exam_id uuid NOT NULL, subject_code text NOT NULL, subject_name text NOT NULL, stream text, display_order smallint, colour_key text
- `syllabus_node`: node_id uuid PK, syllabus_version_id uuid NOT NULL, subject_id uuid NOT NULL, parent_node_id uuid, tag_code text NOT NULL, node_type text NOT NULL, title text NOT NULL, class_level text, depth smallint NOT NULL DEFAULT 0, display_order smallint, level_no smallint, node_code text, node_path text, sort_order integer NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true
- `syllabus_version`: syllabus_version_id uuid PK, exam_id uuid NOT NULL, board_name text, effective_year smallint, source_workbook text, version_status text NOT NULL
- `v_section_marking` (VIEW): pattern_section_id uuid, pattern_id uuid, effective_scheme_id uuid — resolves each pattern_section to its effective marking scheme (falls back from section-level `scheme_id` to the pattern's).

**content** (16 tables). Note the absence of any `concept`, `question_concept`, or
`question_exam_usage` table — see §6 and `docs/OPEN_ITEMS.md`:
- `ai_generation_job`: job_id uuid PK, requested_by uuid NOT NULL, job_type text NOT NULL, provider_name text, model_name text, prompt_version text, input_tokens/output_tokens integer, cost_estimate numeric, job_status text NOT NULL
- `asset`: asset_id uuid PK, question_id uuid, document_id uuid, asset_type text NOT NULL DEFAULT 'image', storage_uri text, alt_text text, render_hint text, option_id uuid, group_id uuid, target_role text NOT NULL DEFAULT 'stem', mime_type text, inline_payload text, width_px/height_px integer, byte_size bigint, checksum_sha256 text, display_order smallint NOT NULL DEFAULT 0
- `document_chunk`: chunk_id uuid PK, document_id uuid NOT NULL, chunk_seq smallint NOT NULL, page_from/page_to integer, chunk_text text NOT NULL, embedding vector, token_count integer, content_checksum bytea (pgvector column — see OPEN_ITEMS, brief §3.2 says pgvector is out of scope for this build but the column/HNSW index already exist from migration 006)
- `import_batch`: batch_id uuid PK, batch_label text NOT NULL, exam_id uuid NOT NULL, syllabus_version_id uuid NOT NULL, source_file text NOT NULL, file_checksum text NOT NULL, submitted_by uuid NOT NULL, batch_status text NOT NULL DEFAULT 'received', row_count/accepted_count/rejected_count integer NOT NULL DEFAULT 0, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
- `import_row`: row_id uuid PK, batch_id uuid NOT NULL, row_no integer NOT NULL, external_ref text NOT NULL, raw_payload jsonb NOT NULL, row_status text NOT NULL DEFAULT 'pending', question_id uuid, error_code/error_detail text
- `node_resource_ref`: ref_id uuid PK, node_id uuid NOT NULL, resource_type text NOT NULL, document_id uuid, page_from/page_to integer, video_uri/video_provider text, duration_sec integer, title text NOT NULL, display_order smallint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
- `question`: question_id uuid PK, question_uid text NOT NULL, primary_node_id uuid NOT NULL, job_id uuid NOT NULL, question_type text, difficulty_band text, stem_text text NOT NULL, numeric_answer/answer_tolerance numeric, origin_year smallint, usage_count integer NOT NULL DEFAULT 0, lifecycle_status text NOT NULL, group_id uuid, group_sequence smallint, stem_format text NOT NULL DEFAULT 'latex', solution_text text, solution_format text NOT NULL DEFAULT 'latex', has_image/has_table/has_math boolean NOT NULL DEFAULT false, revision_no integer NOT NULL DEFAULT 1, external_ref text — **`question_uid` is a free-text unique column, not the `LMN-PHY-ROTMO-000001` generated identifier the brief describes; there is no generator function (§6)**
- `question_chunk_ref`: question_id uuid, chunk_id uuid (composite PK)
- `question_group`: group_id uuid PK, group_type text NOT NULL, stem_text text, stem_format text NOT NULL DEFAULT 'latex', primary_node_id uuid, language_code text NOT NULL DEFAULT 'en', created_at/updated_at timestamptz NOT NULL DEFAULT now()
- `question_node_map`: question_id uuid, node_id uuid (composite PK), relevance_rank smallint, tagged_by uuid, tagged_at timestamptz — **this is the actual question→syllabus mapping in this repo; it maps straight to `catalog.syllabus_node`, bypassing the concept-tree indirection the brief's §1.4 describes as settled**
- `question_option`: option_id uuid PK, question_id uuid NOT NULL, option_label text NOT NULL, option_text text NOT NULL, is_correct boolean NOT NULL DEFAULT false, display_order smallint
- `question_review`: review_id uuid PK, question_id uuid NOT NULL, reviewer_user_id uuid NOT NULL, job_id uuid NOT NULL, reviewer_type text, verdict text NOT NULL, issue_codes jsonb, reviewer_note text, reviewed_at timestamptz
- `question_solution`: solution_id uuid PK, question_id uuid NOT NULL, explanation_text text NOT NULL, step_sequence jsonb, formula_reference text, expected_solve_seconds integer
- `question_source`: question_id uuid PK, source_type text NOT NULL, exam_id/cycle_id uuid, paper_code/shift_code text, sitting_date date, question_no smallint, source_note text
- `question_translation`: translation_id uuid PK, question_id uuid NOT NULL, language_code text NOT NULL, stem_text text NOT NULL, option_texts jsonb, translated_by uuid, review_status text NOT NULL
- `source_document`: document_id uuid PK, subject_id uuid NOT NULL, syllabus_version_id uuid NOT NULL, title text NOT NULL, document_type text, publisher text, edition_year smallint, storage_uri text, page_count integer, ingest_status text NOT NULL

**core** (14 tables):
- `app_user`: user_id uuid PK, institution_id uuid, auth_user_id uuid NOT NULL, email text NOT NULL, mobile_number text, full_name text NOT NULL, user_role text NOT NULL, preferred_language text, status text NOT NULL, last_login_at timestamptz, member_code text (added by 017)
- `batch`: batch_id uuid PK, institution_id uuid NOT NULL, cycle_id uuid NOT NULL, batch_code text NOT NULL, batch_name text NOT NULL, academic_year text, start_date/end_date date
- `batch_member`: batch_id uuid, user_id uuid (composite PK), joined_on/left_on date, member_status text
- `educator_profile`: user_id uuid PK, specialisation text, may_author/may_approve boolean NOT NULL DEFAULT false, assigned_subjects jsonb NOT NULL DEFAULT '[]'
- `enrollment`: enrollment_id uuid PK, user_id uuid NOT NULL, cycle_id uuid NOT NULL, enrolled_on date, target_score numeric, preferred_language text, enrollment_status text NOT NULL
- `institution`: institution_id uuid PK, institution_code text NOT NULL, name text NOT NULL, institution_type text, default_locale text, status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
- `invitation`: invitation_id uuid PK, email text NOT NULL, role_code text NOT NULL, institution_id uuid, invited_by uuid NOT NULL, invited_auth_user_id uuid, status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, accepted_at/revoked_at timestamptz, resend_count smallint NOT NULL DEFAULT 0, last_sent_at timestamptz NOT NULL DEFAULT now()
- `permission`: permission_id uuid PK, permission_code text NOT NULL, description text NOT NULL
- `role`: role_id uuid PK, role_code text NOT NULL, role_name text NOT NULL, scope_level text NOT NULL, is_system boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
- `role_permission`: role_id uuid, permission_id uuid (composite PK)
- `student_profile`: user_id uuid PK, target_year smallint, class_level text, guardian_contact text, daily_study_minutes smallint, onboarding_state text
- `subscription`: subscription_id uuid PK, user_id uuid NOT NULL, plan_id uuid NOT NULL, started_on/expires_on date, payment_reference text, subscription_status text NOT NULL
- `subscription_plan`: plan_id uuid PK, tier_code text NOT NULL, tier_name text NOT NULL, feature_matrix jsonb NOT NULL DEFAULT '{}', language_access jsonb NOT NULL DEFAULT '[]', price_amount numeric, duration_days smallint
- `user_role_assignment`: assignment_id uuid PK, user_id uuid NOT NULL, role_id uuid NOT NULL, institution_id uuid, granted_by uuid, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz

**learn** (9 tables):
- `audit_log`: audit_id uuid PK, actor_user_id uuid, actor_type text, action_name text NOT NULL, entity_name text NOT NULL, entity_key text, change_payload jsonb, occurred_at timestamptz
- `error_log`: error_log_id uuid PK, user_id uuid NOT NULL, response_id uuid NOT NULL, node_id uuid NOT NULL, error_type text NOT NULL, learner_note text, is_resolved boolean NOT NULL DEFAULT false, logged_at timestamptz
- `flashcard`: flashcard_id uuid PK, user_id uuid NOT NULL, node_id uuid, question_id uuid, front_text/back_text text NOT NULL, card_type text, created_from text
- `flashcard_review`: flashcard_review_id uuid PK, flashcard_id uuid NOT NULL, reviewed_at timestamptz, recall_grade smallint, ease_factor numeric, interval_days integer, next_due_on date
- `notification`: notification_id uuid PK, user_id uuid NOT NULL, channel text, template_key text, payload jsonb, sent_at/read_at timestamptz
- `plan_task`: task_id uuid PK, plan_id uuid NOT NULL, node_id uuid NOT NULL, scheduled_date date, activity_type text, planned_minutes smallint, task_status text NOT NULL, completed_at timestamptz
- `study_plan`: plan_id uuid PK, user_id uuid NOT NULL, cycle_id uuid NOT NULL, plan_title text NOT NULL, target_exam_date date, daily_minutes smallint, start_date date, plan_strategy text, plan_status text NOT NULL
- `study_session`: session_id uuid PK, task_id uuid NOT NULL, user_id uuid NOT NULL, started_at/ended_at timestamptz, focus_minutes smallint, capture_source text
- `topic_mastery`: mastery_id uuid PK, user_id uuid NOT NULL, node_id uuid NOT NULL, mastery_score numeric, attempt_count integer, correct_ratio numeric, average_time_seconds numeric, last_practised_at timestamptz, trend_direction text

### 4.2 Primary key / unique constraints

96 total across the 5 schemas — every table has exactly one PK (single-column `uuid` PK by
convention, or a composite PK on link tables: `assess.test_scope_node`, `content.question_chunk_ref`,
`content.question_node_map`, `core.batch_member`, `core.role_permission`). Notable UNIQUEs:
`assess.attempt (test_id, user_id, attempt_no)`, `assess.attempt_response (attempt_id, test_question_id)`,
`assess.scorecard (attempt_id)`, `assess.test_question (test_section_id, question_id)` and
`(test_section_id, sequence_no)`, `content.question (question_uid)`, `content.question_option
(question_id, option_label)`, `content.question_solution (question_id)`, `core.app_user
(auth_user_id)`/`(email)`/`(member_code)`, `core.invitation` has no plain unique (see partial index
below), `catalog.syllabus_node (syllabus_version_id, tag_code)`.

### 4.3 Foreign keys and delete behaviour

109 FKs across the 5 schemas. **The overwhelming majority (~100 of 109) are `ON DELETE NO ACTION`**
— i.e. deleting a parent row is blocked by Postgres's default FK enforcement unless the delete order
respects dependents. Only a small, deliberate set cascade or restrict/set-null explicitly:

| Table.column | → Ref | On delete |
|---|---|---|
| `assess.test.exam_id` → `catalog.exam` | RESTRICT |
| `assess.test.source_cycle_id` → `catalog.exam_cycle` | RESTRICT |
| `assess.test.syllabus_version_id` → `catalog.syllabus_version` | RESTRICT |
| `assess.test_scope_node.test_id` → `assess.test` | CASCADE |
| `assess.test_scope_node.node_id` → `catalog.syllabus_node` | RESTRICT |
| `catalog.exam.family_id` → `catalog.exam_family` | RESTRICT |
| `catalog.node_level.exam_id` → `catalog.exam` | CASCADE |
| `content.asset.group_id` → `content.question_group` | CASCADE |
| `content.asset.option_id` → `content.question_option` | CASCADE |
| `content.import_batch.exam_id/submitted_by/syllabus_version_id` | RESTRICT |
| `content.import_row.batch_id` → `content.import_batch` | CASCADE |
| `content.import_row.question_id` → `content.question` | SET NULL |
| `content.node_resource_ref.document_id/node_id` | CASCADE |
| `content.question.group_id` → `content.question_group` | RESTRICT |
| `content.question_group.primary_node_id` → `catalog.syllabus_node` | RESTRICT |
| `content.question_source.question_id` → `content.question` | CASCADE |
| `content.question_source.exam_id/cycle_id` | RESTRICT |
| `core.role_permission.*` (both FKs) | CASCADE |
| `core.user_role_assignment.granted_by` | SET NULL |
| `core.user_role_assignment.institution_id` | CASCADE |
| `core.user_role_assignment.role_id` | RESTRICT |
| `core.user_role_assignment.user_id` | CASCADE |

Everything else (all of `assess.attempt*`/`test*` back to `core.app_user`/`catalog.exam_pattern`,
all of `content.question_option`/`question_node_map`/`question_translation`/`question_review`/
`question_solution`/`document_chunk`/`ai_generation_job` back to their parents, all of `learn.*` back
to `core.app_user`/`catalog.syllabus_node`, most of `core.*`) is `NO ACTION`. This means, for
example, deleting a `content.question` row that has responses recorded against it in
`assess.attempt_response` (via `test_question`→`question`) is **not automatically cascaded or
blocked at the FK on the response table itself** in the same statement — ordinary delete-parent
attempts will fail with a raw FK-violation error unless the caller deletes children first. This is
current behaviour, not a defect to fix in TE-P0 — noted for TE-P1 migration authors per R-4
("explicit `on delete` behaviour on every foreign key").

### 4.4 Check constraints

58 total. Full list with expressions is in the raw query output captured this session; the
recurring pattern is a text column constrained to an explicit `= ANY (ARRAY[...])` enum-in-text.
Representative ones relevant to the test engine:
- `assess.attempt.ck_attempt_state`: `attempt_state = ANY (ARRAY['in_progress','submitted','scored','abandoned'])` — **no `paused` state exists in the live check constraint**, contradicting brief TE-P4's state machine (`IN_PROGRESS ⇄ PAUSED`). See OPEN_ITEMS.
- `assess.test.ck_test_status`: `draft|ready|published|archived`
- `assess.attempt_response.ck_attempt_response_state`: `not_visited|answered|skipped|marked_for_review`
- `content.question.ck_question_lifecycle`: `draft|in_review|approved|published|retired`
- `content.question.ck_question_numeric_answer`: numeric_answer IS NOT NULL iff question_type IN ('integer','numeric')
- `core.app_user.ck_app_user_status`: `awaiting_verification|active|suspended|locked|deleted`
- `core.app_user.ck_app_user_user_role` / `core.role.ck_role_code`: both constrained to the same
  8-value role-code enum (`super_admin, platform_admin, content_admin, content_reviewer,
  institution_admin, educator, student, system`)

### 4.5 Non-constraint indexes

16 indexes beyond the PK/UNIQUE-backed ones, notably:
- `content.document_chunk`: `hnsw_document_chunk_embedding` — an HNSW pgvector index, live, from
  migration 006, despite brief §3.2 listing pgvector as explicitly out of scope for this build.
- `catalog.syllabus_node`: a trigram GIN index on `node_path` plus two partial/composite unique
  indexes enforcing path and code-under-parent uniqueness.
- `core.app_user`: a partial unique index on `mobile_number` (nulls allowed, non-null must be unique).
- `core.invitation`: a partial unique index enforcing one pending invitation per (email, role).
- **No index exists on any FK column that isn't already the leading column of a PK/unique** — e.g.
  `assess.attempt.test_id`, `assess.attempt.user_id`, `assess.attempt_response.attempt_id`,
  `content.question_node_map.node_id` have no standalone index. TE-P1's "candidate-pool query,
  attempt-response upsert, seen-ledger exclusion, attempt history listing" indexes (its own work
  item) are genuinely not present yet — this is real, not already covered.

### 4.6 Triggers

10 triggers, all `BEFORE`/`AFTER` row-level, all backed by a `plpgsql` function named `trg_*` in the
same schema as the table. Full list in the raw output; the one directly relevant to TE-P0 work item
9 is quoted verbatim in `docs/ENGINE_STATE.md` (`assess.trg_attempt_response_option_guard`).

## 5. Row counts, all 6 schemas (60 tables custom + 28 public)

Queried live via `count(*)` on every base table, this session:

| Schema | Non-empty tables | Empty tables |
|---|---|---|
| `assess` | **none — all 10 tables are 0 rows** | attempt, attempt_event, attempt_response, scorecard, section_score, test, test_assignment, test_question, test_scope_node, test_section |
| `catalog` | exam (1), exam_cycle (1), exam_pattern (1), marking_scheme (1), pattern_section (4), subject (4), syllabus_node (38), syllabus_version (1) | exam_family (0), node_level (0), node_weightage (0) |
| `content` | **none — all 16 tables are 0 rows** | ai_generation_job, asset, document_chunk, import_batch, import_row, node_resource_ref, question, question_chunk_ref, question_group, question_node_map, question_option, question_review, question_solution, question_source, question_translation, source_document |
| `core` | app_user (1), permission (5), role (8), role_permission (12), student_profile (1), user_role_assignment (1) | batch, batch_member, educator_profile, enrollment, institution, invitation, subscription, subscription_plan |
| `learn` | audit_log (32), notification (1) | error_log, flashcard, flashcard_review, plan_task, study_plan, study_session, topic_mastery |
| `public` | `_prisma_migrations` (4), `users` (1) | every other public table: ai_cache, ai_usage, attempt_answers, attempt_questions, attempt_section_states, bookmarks, chapters, exam_calendar_events, exam_pattern_sections, exam_patterns, mock_test_questions, mock_tests, notes, notifications, question_assets, question_options, question_revisions, questions, scoring_rules, subjects, test_attempts, topics, units, user_daily_activity |

**The live database is, as of this session, almost entirely empty of application data.**
`content.question` (the entire question bank, both tracks) is 0 rows. `assess.*` (the entire raw-SQL
attempt track) is 0 rows. `public.questions`/`public.test_attempts`/`public.mock_tests` (the entire
Prisma attempt track) are 0 rows. The one populated real-user row is `core.app_user` /
`public.users`, containing exactly the account signed in as this session's operator
(`lumenacademyforyou@gmail.com`, member_code `LALU948461`). `catalog.*` holds a small
hand-entered NEET scratch pattern (4 subjects, 1 marking scheme 4/-1/0, 1 pattern of 20 questions /
80 marks / 60 minutes across 4 sections — **not** the real NEET UG pattern of ~200 questions / 720
marks / 180 minutes; I-12 is still needed). `learn.audit_log` has 32 rows (identity/RBAC actions
logged by the core layer) and 1 stray `learn.notification`.

## 6. Function / view existence check (work item 6)

Searched `information_schema.routines` and `information_schema.views` across every schema, and by
name pattern across the whole database (not just the five custom schemas), for each named object:

| Object the brief names | Exists? | What's actually there instead |
|---|---|---|
| `content.v_question_eligibility` | **No** | No view or function with "eligibility" in its name exists anywhere in the database. `content` has no equivalent — question→exam/syllabus resolution would have to be written from scratch against `content.question_node_map` (which maps a question straight to one `catalog.syllabus_node`, not to a concept tree) and `content.question` directly; there is no concept of exam-scoped difficulty registration (`question_exam_usage`) at all. |
| `content.next_lumen_id()` | **No** | No function with "lumen_id" in its name exists. `content.question.question_uid` is a plain unique `text` column with no default/sequence/generator attached — nothing populates it automatically; whatever writes a `content.question` row must supply its own `question_uid` today. |
| `util.*` helpers | **No — `util` schema is completely empty** | 0 tables, 0 functions, 0 views. Created by `000_foundation.sql`, never touched since. |
| `upsert_concept` | **No** | No function by this name anywhere. No `content.concept` table exists either, so there is nothing to upsert into — the whole concept-tree layer the brief's §1.4 describes as settled is not present in this schema at all. |
| `upsert_syllabus_node` | **No** | No function by this name. `catalog.syllabus_node` rows exist (38 of them) but were evidently inserted by something else (a seed script or hand-written SQL), not through a named upsert helper. |
| `map_node_concept` | **No** | No function by this name, and (as above) no concept table to map a node to. |

All 10 functions that do exist in the five custom schemas are `plpgsql` trigger functions
(`trg_*`), one per trigger listed in §4.6 — there are **zero** standalone/callable helper or
business-logic functions anywhere in `util`/`catalog`/`core`/`content`/`assess`/`learn`. This is a
substantially bigger gap than "unverified" — none of these six named objects, or any evident
renamed equivalent, exist under any name. TE-P1 is building all of this from nothing, not
verifying/renaming something already there.

## 7. Prisma track — artefacts and live state

- `prisma/schema.prisma` — 30 `model` blocks, 6 `enum` blocks, targets `public` schema only.
- `prisma/migrations/`: 4 folders — `20260807095708_init`, `20260807162258_supabase_auth`,
  `20260820140818_schema_audit_upgrade`, `20260820142154_exam_pattern_model` (brief and
  `MIGRATION_STATE.md` both only discuss the latter two; the first two are older and pre-date this
  repo's audit trail — all 4 show `finished_at` set and `rolled_back_at` null in
  `public._prisma_migrations`, i.e. **all 4 are applied**, not 2).
- Generated client: `backend/generated/prisma/` (checked into the tree, not gitignored — confirm
  intentional).
- `public` has 28 base tables; 2 of them (`part_config`, `part_config_sub`) are `pg_partman`
  extension bookkeeping tables with no corresponding Prisma model — not application drift, just an
  artefact of a Postgres extension installed with `public` as its default schema. Every one of the
  other 26 has a matching Prisma model.
- `backend/db.ts` instantiates one process-wide `PrismaClient`, imported as `prisma` from
  `backend/db.js` by `backend/routes/api.ts` (health check only) and `backend/services/attempt.service.ts`
  (the entire legacy `/api/tests/*` attempt flow — see `docs/ENGINE_STATE.md` §"Attempt path trace").

## 8. Data reality vs `db/MIGRATION_STATE.md`

`MIGRATION_STATE.md` (2026-08-23, prior session) is accurate about **schema/DDL state** — every
migration+verify pair it lists as applied is confirmed still applied today, and its Prisma-track
account matches (modulo the two older migrations it didn't mention). It is **not accurate about
data** as of this session, two days later:

| MIGRATION_STATE.md claimed | Live database now shows |
|---|---|
| `core.role`/`core.permission`/`core.user_role_assignment` seeded (8 roles, 5 permissions, backfilled assignments) | Still true — role(8), permission(5), role_permission(12), user_role_assignment(1) all present. |
| A `super_admin` account and one institution (`LUMEN-PILOT-001`) created by `02_core_lifecycle_fixture.ts`, "left live/persistent" | **Not present.** `core.institution` is 0 rows. `core.app_user` has exactly 1 row, and it is not a super_admin fixture — it is `lumenacademyforyou@gmail.com`, role `student`. No institution, no fixture super_admin, no fixture accounts of any type exist live today. |
| Two disposable seed/test accounts with attempt/scorecard history (`demo.student@lumenacademy.dev`: 8 attempts/6 scorecards; `e2e-test-student@lumen.internal`: 2 attempts/1 scorecard) | **Not present.** `assess.attempt` and `assess.scorecard` are both 0 rows. Neither account exists in `core.app_user`. |

Per R-2, the database is the authority: treat every fixture/seed claim in `MIGRATION_STATE.md` as
stale. Its schema/DDL claims stand; its data claims do not. This file does not speculate on why
(a database reset, a different DB target, or the fixtures being intentionally cleaned up are all
consistent with what's observed) — see `docs/OPEN_ITEMS.md`.

## 9. TE-P1 delta (2026-08-25) — schema completion applied

`db/migrations/018_test_engine.sql` applied and verified live (`node db/scripts/run-migration.mjs
018_test_engine`, both DO blocks in `verify_018_test_engine.sql` passed — structural checks and a
functional constraint-rejection proof built on a fixture chain that force-rolled-back, same pattern
as `verify_011_assess_scope.sql`). Substitutions used instead of duplicating an existing equivalent
(brief TE-P1 work item 2 / R-3): `assess.test.source_type` (`'generated'` = BLUEPRINT, else FIXED)
stands in for a new `assembly_mode` column; `assess.attempt.server_deadline` stands in for
`deadline_at`; `catalog.subject` (already exam-scoped via `subject.exam_id`) stands in for a
separate "exam_subject" entity; the brief's `ux_test_question_unique` was already present as a
unique index on `(test_section_id, question_id)` and was not re-added.

- **New:** `util.applied_migration` (migration-ledger table, backfilled with all 18 raw-SQL
  migrations `000`–`018` — `applied_at` for `000`–`017` is this migration's run time, not the true
  original apply time, which is unrecoverable).
- **New tables in `assess`:** `user_question_seen` (D-2 anti-repetition ledger), `attempt_pause`
  (D-1/R-10 pause ledger, one-open-pause-per-attempt enforced by a partial unique index),
  `idempotency_key` (D-7), `test_blueprint` (D-1 BLUEPRINT-mode definition, `subject_id` →
  `catalog.subject`, `syllabus_node_id` → `catalog.syllabus_node.node_id`, `question_format`
  constrained to the same value set as `content.question.question_type`).
- **New columns on `assess.attempt`:** `paused_ms_total` (bigint, default 0), `attempt_seq`
  (integer, nullable — the student's lifetime completed-attempt counter, distinct from the existing
  per-test `attempt_no`), `submitted_reason` (text, check `student|expiry|admin|sweeper`).
- **Widened:** `assess.attempt`'s `ck_attempt_state` now allows `paused` in addition to the existing
  `in_progress|submitted|scored|abandoned` (table was 0 rows live, so dropped and re-added directly
  — nothing to backfill).
- **New indexes:** `ix_user_question_seen_user_seq`, `ix_attempt_user_started` (attempt-history
  listing), `ix_question_node_map_node` (candidate-pool join — `content.question_node_map.node_id`
  had no standalone index per §4.5), `ix_question_lifecycle_published` (partial index on
  `content.question.lifecycle_status = 'published'`), plus one on `test_blueprint.test_id`.
- **Row counts unchanged** — all four new tables are 0 rows (the verify script's fixture inserts
  were rolled back, not committed); `assess`/`content` remain otherwise empty per §5.

Live table count in the five custom schemas is now 64 (60 + `util.applied_migration` + the four new
`assess` tables), pending independent re-confirmation in a future full re-audit.
