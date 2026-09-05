/** Sections 8-13: API, Database, Data Architecture, Workflows, AuthN/AuthZ, Security. */
const { H, P, B, N, T, TBL, FIG, CODE, NOTE, PB } = require("./helpers.cjs");

const c = [];
const add = (...x) => x.forEach((y) => (Array.isArray(y) ? c.push(...y) : c.push(y)));

/* ========================= 8. API SPECIFICATION ========================= */
add(PB(), H(1, "8. API Specification"));

add(H(2, "8.1 Conventions"));
add(
  T(
    ["Aspect", "Contract"],
    [
      ["Base path", "/api. In production the same origin also serves the SPA; every non-/api path resolves to index.html."],
      ["Transport", "HTTPS only in every deployed environment. JSON request and response bodies; UTF-8."],
      ["Success envelope", "Single resources and collections are returned as { \"data\": ... }. A few purpose-built endpoints return a domain-shaped object at the top level; those are marked in their own specification."],
      ["Error envelope", "{ \"error\": { \"code\": \"<STABLE_CODE>\", \"message\": \"<human readable>\" } }. Structured errors add named fields alongside code and message (see 8.9)."],
      ["Authentication", "Authorization: Bearer <Supabase access token>. Absent or invalid produces 401 UNAUTHORIZED; a lapsed application session produces 401 SESSION_EXPIRED."],
      ["Authorisation", "Permission codes are asserted by middleware (for example users:invite, content:publish, admin:stats). Ownership-scoped routes resolve the owner from the row, and answer 404 rather than 403 when a row exists but is not the caller's."],
      ["Validation", "Zod schemas validate body and query on write routes; a schema failure returns 400. Where no schema is declared, PostgreSQL constraint violations are translated to 400 INVALID_INPUT."],
      ["Versioning", "The path is unversioned (/api, not /api/v1). Retired endpoints answer 410 GONE rather than disappearing. A future breaking change requires either a versioned prefix or an additive-only migration; this is an open decision (ADR-009)."],
      ["Idempotency", "Attempt start and attempt submission both accept an optional idempotencyKey in the request body, recorded in assess.idempotency_key; reusing a key with different content returns 409 IDEMPOTENCY_CONFLICT. Submission is additionally idempotent per attempt without any key, guarded by a row lock and the attempt state machine. No endpoint uses an Idempotency-Key header."],
      ["Pagination", "Not implemented. Collection endpoints return the full result set for the caller's scope. Introducing pagination is required before any collection can grow unbounded (TBD-05)."],
      ["Rate limiting", "Not implemented in the application. [TO BE DEFINED] at the hosting edge (TBD-06)."],
      ["Timeouts", "No explicit server-side request timeout is configured; the client sets none either. [TBD]."],
      ["Retries", "The client does not retry automatically. A 401 triggers sign-out rather than a retry, because the identity SDK has already exhausted its own refresh path."],
      ["Audit", "Administrative and content-lifecycle actions are recorded in their own tables (content.question_review, content.question_identity_audit, learn.audit_log). Read access is not audited."],
    ],
    [1, 4.2]
  ),
  TBL("API conventions")
);

add(H(2, "8.2 Endpoint inventory"));
add(
  P(
    "API identifiers (API-nnn) are stable and are referenced by the traceability matrix in Section 31. Auth column values: none (open), auth (any authenticated caller), own (authenticated and ownership-checked), perm (authenticated and permission-gated)."
  )
);
add(
  T(
    ["API ID", "Method and path", "Purpose", "Auth"],
    [
      ["API-001", "GET /api/health", "Liveness and database reachability", "none"],
      ["API-002", "GET /api/me", "Full profile of the signed-in user", "auth"],
      ["API-003", "PATCH /api/me", "Partial profile update", "auth"],
      ["API-004", "DELETE /api/me", "Account deletion. Deliberately gated on a user-management permission so an ordinary caller receives a clean 403 rather than a 404; defers conceptually to the administrative status transition to deleted. Requires a recent OTP re-authentication.", "perm"],
      ["API-005", "GET /api/auth/session", "Current application session status", "auth"],
      ["API-006", "POST /api/auth/session/heartbeat", "Extend the idle window", "auth"],
      ["API-007", "POST /api/auth/session/logout", "Terminate the application session", "auth"],
      ["API-008", "POST /api/auth/demo/reset", "Reset the demonstration account's data", "auth"],
      ["API-010", "GET /api/questions", "Published question bank filtered by subject", "none"],
      ["API-011", "GET /api/questions/count", "Count under identical filter semantics to API-010", "none"],
      ["API-012", "GET /api/syllabus", "Syllabus projection for the client", "none"],
      ["API-013", "GET /api/catalog/tree", "Exam, subject and syllabus-node tree", "none"],
      ["API-014", "GET /api/catalog/{exams|subjects|syllabus-nodes|exam-cycles|exam-patterns|pattern-sections|syllabus-versions|marking-schemes|node-weightages}/:id", "Catalog reference reads", "none"],
      ["API-015", "POST, PATCH, DELETE on the same catalog collections", "Catalog reference writes", "auth"],
      ["API-020", "GET /api/content/questions", "Content-side question read by syllabus node. The projection depends on the caller: a holder of any content:* permission sees every lifecycle status, anyone else sees published items only", "auth"],
      ["API-021", "GET /api/content/questions/:id/review-history", "Review history for one question", "perm"],
      ["API-022", "POST /api/content/questions/:id/submit-review", "draft to in_review", "perm content:submit_review"],
      ["API-023", "POST /api/content/questions/:id/review-decision", "in_review to approved or back to draft", "perm content:review_decide"],
      ["API-024", "POST /api/content/questions/:id/publish", "approved to published", "perm content:publish"],
      ["API-025", "POST /api/content/questions/:id/retire", "published to retired", "perm content:publish"],
      ["API-026", "GET /api/content/content-health", "Content health report", "perm"],
      ["API-027", "GET /api/content/{questions|question-options|question-solutions|question-translations|question-reviews|assets|document-chunks|source-documents|ai-generation-jobs}/:id", "Read-only content reads", "auth"],
      ["API-030", "POST /api/assess/availability", "Pre-flight pool availability for a configuration", "auth"],
      ["API-031", "POST /api/assess/sessions", "Create, publish and start a test in one call", "auth"],
      ["API-032", "POST /api/assess/tests/practice", "Create a single-scope practice test", "auth"],
      ["API-033", "GET /api/assess/attempts", "List the caller's own attempts", "own"],
      ["API-034", "GET /api/assess/attempts/:id", "Read one owned attempt", "own"],
      ["API-035", "POST /api/assess/attempts/start", "Start an attempt for an existing test", "auth"],
      ["API-036", "GET /api/assess/attempts/:attemptId/envelope", "Served paper, server clock and remaining time", "own"],
      ["API-037", "GET /api/assess/attempts/:attemptId/paper", "Served paper projection", "own"],
      ["API-038", "GET /api/assess/attempts/:attemptId/responses", "Saved responses", "own"],
      ["API-039", "PATCH /api/assess/attempts/:attemptId/responses/:questionId", "Save one response", "own"],
      ["API-040", "PATCH /api/assess/attempts/:attemptId/responses", "Batched autosave of responses", "own"],
      ["API-041", "GET, POST /api/assess/attempts/:attemptId/events", "Attempt event stream (read and append)", "own"],
      ["API-042", "POST /api/assess/attempts/:attemptId/pause", "Pause an in-progress attempt", "own"],
      ["API-043", "POST /api/assess/attempts/:attemptId/resume", "Resume a paused attempt", "own"],
      ["API-044", "POST /api/assess/attempts/:attemptId/submit", "Submit and score", "own"],
      ["API-045", "GET /api/assess/attempts/:attemptId/scorecard", "Scorecard with section scores", "own"],
      ["API-046", "GET /api/assess/attempts/:attemptId/review", "Post-scoring per-question review", "own"],
      ["API-047", "GET /api/assess/attempts/:attemptId/irt", "Ability estimate report", "own"],
      ["API-048", "GET /api/assess/attempts/:attemptId/cohort", "Cohort comparison", "own"],
      ["API-050", "GET /api/analytics/dashboard", "Candidate dashboard analytics", "auth"],
      ["API-051", "GET /api/admin/stats", "Platform statistics", "perm admin:stats"],
      ["API-060", "GET, POST /api/learn/study-plans/me; POST /api/learn/study-plans/reset", "Active study plan for the caller", "own"],
      ["API-061", "GET, POST /api/learn/study-plans/:planId/goals; PATCH, DELETE .../goals/:goalId", "Plan goals", "own"],
      ["API-062", "GET /api/learn/study-plans/:planId/tasks; PATCH .../tasks/:taskId", "Plan tasks and task status", "own"],
      ["API-063", "CRUD /api/learn/{study-sessions|topic-mastery|flashcards|error-log|notifications|custom-tasks|revision-notes|pomodoro-sessions}", "Per-user learning artefacts", "own"],
      ["API-064", "GET, POST /api/learn/flashcards/:flashcardId/reviews", "Flashcard review records", "own"],
      ["API-065", "PATCH /api/learn/notifications/read-all; DELETE /api/learn/notifications", "Bulk notification operations", "own"],
      ["API-066", "GET /api/learn/unit-materials/by-tag-codes; /unit/:unitId; /:materialId/download", "Unit study materials and download redirect", "auth"],
      ["API-070", "GET, POST /api/admin/invitations; DELETE /api/admin/invitations/:id; POST /api/admin/invitations/:id/resend", "Invitation lifecycle", "perm users:invite"],
      ["API-071", "GET /api/admin/users; GET /api/admin/users/:id; PATCH /api/admin/users/:id", "User administration, tenancy-narrowed", "perm users:manage_*"],
      ["API-072", "POST /api/admin/users/:id/status; POST /api/admin/users/:id/roles; DELETE /api/admin/users/:id/roles/:roleCode", "Status transitions and role assignment", "perm users:manage_*"],
      ["API-073", "POST /api/admin/users/:id/force-sign-out; POST /api/admin/users/:id/force-password-reset", "Forced account actions", "perm users:manage_*"],
      ["API-080", "CRUD /api/core/{subscriptions|enrollments}", "User-owned core records", "own"],
      ["API-090", "POST /api/submit-attempt", "Retired — answers 410 GONE", "none"],
      ["API-091", "POST /api/ai/study-plan; /api/ai/evaluate-attempt; /api/ai/explain", "Retired — answer 410 GONE", "none"],
    ],
    [0.8, 3.4, 3, 1]
  ),
  TBL("API endpoint inventory")
);

add(H(2, "8.3 API-031 — POST /api/assess/sessions"));
add(
  T(
    ["Attribute", "Specification"],
    [
      ["Purpose", "Create a test definition from a mode-specific configuration, publish it, and start the caller's attempt against it, in one round trip."],
      ["Authentication", "Required. Bearer token."],
      ["Authorisation", "Any authenticated caller may create a session for themselves. No content permission is required, because this creates an assessment definition, not content."],
      ["Headers", "Authorization: Bearer <token>; Content-Type: application/json."],
      ["Path parameters", "None."],
      ["Query parameters", "None."],
      ["Request body", "A discriminated union on mode: subject-wise, full-mock, custom, image-practice. See the schema and example below."],
      ["Validation", "Zod discriminated union. UUID fields must be well-formed UUIDs; pickCount and durationMinutes must be positive integers; custom mode requires at least one line."],
      ["Response body", "An attempt envelope ready to render: the attempt identifier, the served questions in order, the server's current time and the remaining seconds."],
      ["Status codes", "201 or 200 on success; 400 on schema failure; 401 unauthenticated or session expired; 409 ACTIVE_ATTEMPT_EXISTS; 422 POOL_INSUFFICIENT; 500 on unexpected failure."],
      ["Error responses", "ACTIVE_ATTEMPT_EXISTS carries existingAttemptId and existingTestId. POOL_INSUFFICIENT carries blueprintId, testSectionId, requested and available."],
      ["Rate limits", "None in the application. [TBD] at the edge."],
      ["Pagination", "Not applicable."],
      ["Idempotency", "Not idempotent: each successful call creates a new test and attempt. The active-attempt guard is what prevents accidental duplication."],
      ["Timeout and retry", "No server timeout configured. The client must not retry blindly on timeout; it should first call API-033 to discover whether an attempt was created."],
      ["Versioning", "Unversioned path; additive fields only."],
      ["Audit", "The created attempt, its served item set and its generation seed are persisted, which constitutes the audit record for the paper."],
    ],
    [1, 4.2]
  ),
  TBL("API-031 specification")
);
add(
  CODE([
    "POST /api/assess/sessions",
    "Authorization: Bearer <token>",
    "Content-Type: application/json",
    "",
    "{",
    "  \"mode\": \"subject-wise\",",
    "  \"title\": \"[TITLE]\",",
    "  \"durationMinutes\": 60,",
    "  \"subjectId\": \"[UUID]\",",
    "  \"syllabusNodeId\": \"[UUID]\",",
    "  \"includeDescendants\": true,",
    "  \"hasImageOnly\": false,",
    "  \"pickCount\": 45",
    "}",
    "",
    "200 OK",
    "{",
    "  \"attemptId\": \"[UUID]\",",
    "  \"testId\": \"[UUID]\",",
    "  \"attemptState\": \"in_progress\",",
    "  \"serverNow\": \"[ISO-8601 TIMESTAMP]\",",
    "  \"remainingSeconds\": 3600,",
    "  \"sections\": [",
    "    {",
    "      \"sectionName\": \"[SECTION]\",",
    "      \"questions\": [",
    "        {",
    "          \"questionId\": \"[UUID]\",",
    "          \"displayOrder\": 1,",
    "          \"stemText\": \"[STEM]\",",
    "          \"stemTextTa\": \"[TAMIL STEM or null]\",",
    "          \"hasImage\": false,",
    "          \"images\": [],",
    "          \"options\": [",
    "            { \"optionId\": \"[UUID]\", \"optionLabel\": \"A\", \"optionText\": \"[TEXT]\" }",
    "          ]",
    "        }",
    "      ]",
    "    }",
    "  ]",
    "}",
    "",
    "409 Conflict",
    "{ \"error\": { \"code\": \"ACTIVE_ATTEMPT_EXISTS\",",
    "              \"message\": \"An attempt is already in progress.\",",
    "              \"existingAttemptId\": \"[UUID]\", \"existingTestId\": \"[UUID]\" } }",
  ]),
  FIG("API-031 request and response examples")
);
add(NOTE("Answer-key discipline", "No pre-submission payload — envelope, paper or question read — may contain is_correct, solution text, explanation text, or an asset whose role is solution, hint or explanation. This is asserted by contract test, not left to reviewer vigilance."));

add(H(2, "8.4 API-039 and API-040 — response saving"));
add(
  T(
    ["Attribute", "Specification"],
    [
      ["Purpose", "Persist the candidate's answer to one question (API-039) or to several at once during autosave (API-040)."],
      ["Authentication and authorisation", "Bearer token; ownership of the attempt resolved once per request from :attemptId."],
      ["Path parameters", "attemptId (UUID); questionId (UUID, API-039 only)."],
      ["Request body", "API-039: the selected option identifier, selected option identifiers for multiple-response items, or a numeric answer. API-040: an array of the same shape keyed by question."],
      ["Validation", "The question must belong to the attempt's served set (422 QUESTION_NOT_IN_ATTEMPT). A selected option must belong to that question — enforced by a database trigger that raises a dedicated SQLSTATE, mapped to 422 RESPONSE_OPTION_MISMATCH. A numeric answer must parse (422 INVALID_NUMERIC_ANSWER)."],
      ["Response body", "{ \"data\": { \"saved\": <count>, \"attemptState\": \"in_progress\" } }."],
      ["Status codes", "200; 401; 404 when the attempt is not the caller's; 409 when the attempt is no longer in progress; 422 for the validation cases above."],
      ["Idempotency", "Idempotent per (attempt, question): the write is an upsert against a unique constraint on that pair, so a repeated autosave is safe."],
      ["Rate limits", "None. The client flushes on a 12-second interval."],
      ["Audit", "Attempt events may be appended separately through API-041; response writes themselves are not separately audited."],
    ],
    [1, 4.2]
  ),
  TBL("API-039 and API-040 specification")
);

add(H(2, "8.5 API-044 — POST /api/assess/attempts/:attemptId/submit"));
add(
  T(
    ["Attribute", "Specification"],
    [
      ["Purpose", "Close the attempt, score it against the stored marking scheme, and persist the scorecard and section scores."],
      ["Authentication and authorisation", "Bearer token; ownership resolved from :attemptId."],
      ["Request body", "Empty, or a submission reason for system-initiated submission (student, expiry, admin, sweeper)."],
      ["Concurrency", "The attempt row is locked for the duration of the scoring transaction. A concurrent second submission observes the scored state and does not re-score."],
      ["Response body", "{ \"data\": { \"attemptId\": \"[UUID]\", \"attemptState\": \"scored\", \"scorecard\": { \"totalMarks\": \"[DECIMAL]\", \"maxMarks\": \"[DECIMAL]\", \"sections\": [ ... ] } } }. All marks are decimal strings, never floating-point numbers."],
      ["Status codes", "200; 401; 404; 409 INVALID_STATE_TRANSITION when the attempt is not submittable; 500 SCORING_RULE_MISSING when marking-scheme data is absent."],
      ["Idempotency", "Idempotent per attempt, with or without an idempotencyKey in the body; a key reused with different content returns 409 IDEMPOTENCY_CONFLICT."],
      ["Timeout and retry", "A client that times out should re-read the attempt (API-034) before retrying; a retry is safe but unnecessary."],
      ["Audit", "The scorecard and section scores are the durable record; the attempt records submitted_at and the submission reason."],
    ],
    [1, 4.2]
  ),
  TBL("API-044 specification")
);

add(H(2, "8.6 API-010 and API-011 — question bank reads"));
add(
  P(
    "Both endpoints are open (no authentication) and share one literal SQL filter fragment and one subject enum, so they are structurally incapable of disagreeing: the count is the length of the list for every accepted filter. The response carries hasImage and a resolved images array for each question, restricted to stem and option asset roles."
  )
);
add(
  CODE([
    "GET /api/questions?subject=physics",
    "",
    "200 OK",
    "{",
    "  \"data\": [",
    "    { \"questionId\": \"[UUID]\", \"questionUid\": \"[UID]\", \"stemText\": \"[STEM]\",",
    "      \"difficultyBand\": \"medium\", \"hasImage\": true,",
    "      \"images\": [ { \"assetId\": \"[UUID]\", \"role\": \"stem\", \"url\": \"[PUBLIC URL]\" } ],",
    "      \"options\": [ { \"optionId\": \"[UUID]\", \"optionLabel\": \"A\", \"optionText\": \"[TEXT]\" } ] }",
    "  ]",
    "}",
    "",
    "GET /api/questions/count?subject=physics   ->  { \"data\": { \"count\": 365 } }",
    "GET /api/questions?subject=biology         ->  400 { \"error\": { \"code\": \"INVALID_INPUT\", ... } }",
  ]),
  FIG("API-010 and API-011 request and response examples")
);
add(NOTE("Contract", "subject accepts the four NEET subject codes the catalog defines (physics, chemistry, botany, zoology) and rejects aggregate values such as biology with 400 — this is asserted by an end-to-end negative test."));

add(H(2, "8.7 Administrative endpoints (API-070 to API-073)"));
add(
  P(
    "Every invitation route is gated on the single permission users:invite, because creation, listing, revocation and resend are the same authority question. The user-lifecycle routes accept either users:manage_platform or users:manage_institution; which rows the caller can actually reach is then narrowed inside the service layer by tenancy, not by which permission was held. This separation is deliberate: permission answers whether the caller may perform the verb, tenancy answers which rows the verb may touch."
  )
);
add(
  T(
    ["API ID", "Endpoint", "Permission", "Tenancy narrowing"],
    [
      ["API-070", "POST, GET /admin/invitations; DELETE /:id; POST /:id/resend", "users:invite", "Invitations are scoped to the caller's institution where the caller is institution-scoped"],
      ["API-071", "GET /admin/users; GET /admin/users/:id; PATCH /admin/users/:id", "users:manage_platform or users:manage_institution", "Service filters to the caller's institution unless platform-scoped"],
      ["API-072", "POST /admin/users/:id/status; POST /:id/roles; DELETE /:id/roles/:roleCode", "users:manage_platform or users:manage_institution", "As above; role grants are validated against role scope"],
      ["API-073", "POST /admin/users/:id/force-sign-out; POST /:id/force-password-reset", "users:manage_platform or users:manage_institution", "As above; executed through the identity provider's admin API using the service-role credential"],
    ],
    [0.7, 3, 1.9, 2.4]
  ),
  TBL("Administrative endpoint authorisation")
);

add(H(2, "8.8 Retired endpoints"));
add(
  P(
    "POST /api/submit-attempt and the three /api/ai/* endpoints are retired. They remain routable and answer 410 GONE with a stable code, so that an old client receives a definitive answer instead of a 404 that could be mistaken for a deployment fault. They must not be reinstated: the AI subsystem is out of scope by directive, and attempt submission is served by API-044."
  )
);

add(H(2, "8.9 Error responses"));
add(
  P(
    "The complete error-code catalogue, including the structured errors that carry additional fields, is specified once in Section 18.2 and referenced from here rather than duplicated."
  )
);

/* ========================= 9. DATABASE DESIGN ========================= */
add(PB(), H(1, "9. Database Design"));

add(H(2, "9.1 Database technology"));
add(
  P(
    "PostgreSQL, hosted by Supabase, reached through the session-mode pooler on port 5432. Session mode rather than transaction mode is required because the same connection path is used for DDL when migrations are applied. The application connects with the node-postgres driver through a pool capped at four connections per process; a second, smaller pool exists for the residual Prisma client. TLS is enabled for the managed host."
  )
);

add(H(2, "9.2 Database architecture"));
add(
  B([
    "Six schemas: catalog (reference data), core (tenancy, identity, RBAC, sessions, subscriptions), content (question bank and provenance), assess (tests, attempts, scoring), learn (per-user learning artefacts), util (migration ledger).",
    "Schema authority is db/migrations: numbered, forward-only SQL files, applied in order by db/scripts/run-migration.mjs, which runs the migration and then its paired assertion script from db/verify.",
    "An applied-migration ledger lives in util.applied_migration. The Prisma migration table in the public schema belongs solely to the residual legacy track and must not be used for domain schema changes.",
    "Migration files are never edited after they have been applied. Corrections are new migrations; three rollback scripts exist for specific reversible changes.",
    "Row-level security is applied to core tables by migration 016 (core RLS lockdown).",
  ])
);

add(H(2, "9.3 Entity model"));
add(
  T(
    ["Schema", "Entities"],
    [
      ["catalog", "exam_family, exam, exam_cycle, exam_pattern, pattern_section, subject, syllabus_version, syllabus_node, node_level, node_weightage, marking_scheme (plus the v_section_marking view)"],
      ["core", "institution, app_user, student_profile, educator_profile, batch, batch_member, enrollment, role, permission, role_permission, user_role_assignment, invitation, subscription_plan, subscription, user_session"],
      ["content", "question, question_option, question_solution, question_translation, question_node_map, question_group, question_source, question_review, question_usage, question_chunk_ref, question_identity_audit, question_dedup_repoint, question_duplicate_candidate, asset, asset_archive, asset_rename_log, source_document, document_chunk, node_resource_ref, import_batch, import_row, ai_generation_job"],
      ["assess", "test, test_blueprint, test_section, test_question, test_scope_node, test_assignment, attempt, attempt_question, attempt_response, attempt_event, attempt_pause, scorecard, section_score, user_question_seen, unit_recycle_log, idempotency_key"],
      ["learn", "study_plan, study_plan_goal, plan_task, custom_task, study_session, pomodoro_session, topic_mastery, flashcard, flashcard_review, revision_note, error_log, notification, syllabus, unit_material, audit_log"],
      ["util", "applied_migration"],
    ],
    [0.7, 5]
  ),
  TBL("Entity inventory by schema")
);
add(NOTE("Design fact", "There is no concept-tree indirection in this model. A question maps directly to one primary catalog.syllabus_node, with additional mappings in content.question_node_map. Earlier design documents that describe a content.concept layer describe a different design that was never built here."));

add(H(2, "9.4 ER model"));
add(
  CODE([
    "  catalog.exam ---< catalog.exam_pattern ---< catalog.pattern_section",
    "        |                                            |",
    "        +---< catalog.subject ---< catalog.syllabus_node (self-referencing tree)",
    "                                        |        ^",
    "                                        |        | primary_node_id",
    "                                        |   +----+------------------+",
    "                                        |   | content.question      |",
    "        content.question_node_map >-----+   |  question_uid (uq)    |",
    "                                            |  stem_text            |",
    "                                            |  lifecycle_status     |",
    "                                            |  difficulty_band      |",
    "                                            |  numeric_answer       |",
    "                                            +--+-----+-----+--------+",
    "                                               |     |     |",
    "               content.question_option <-------+     |     +---> content.question_translation",
    "                 (is_correct, display_order)         |            (language_code, option_texts)",
    "                                                     +---------> content.question_solution",
    "                                                     +---------> content.asset (role: stem|option|...)",
    "",
    "  core.institution ---< core.app_user ---< core.user_role_assignment >--- core.role",
    "                              |                                             |",
    "                              |                                    core.role_permission",
    "                              |                                             |",
    "                              |                                      core.permission",
    "                              +---< core.user_session",
    "                              +---< core.subscription >--- core.subscription_plan",
    "",
    "  assess.test ---< assess.test_section ---< assess.test_question >--- content.question",
    "       |    ^                                        ^",
    "       |    +--- assess.test_blueprint               |",
    "       |                                             |",
    "       +---< assess.attempt (user_id -> core.app_user)|",
    "                  |  attempt_no (uq per test+user)   |",
    "                  |  server_deadline, attempt_state  |",
    "                  +---< assess.attempt_question -----+",
    "                  +---< assess.attempt_response >--- content.question_option",
    "                  +---< assess.attempt_event",
    "                  +---< assess.attempt_pause",
    "                  +---1 assess.scorecard ---< assess.section_score",
    "",
    "  core.app_user ---< assess.user_question_seen >--- content.question   (exposure ledger)",
    "  core.app_user ---< learn.* (study_plan, flashcard, revision_note, error_log, ...)",
    "",
    "  Legend:  ---<  one-to-many      >---  many-to-one      ---1  one-to-one",
  ]),
  FIG("Entity-relationship model — principal entities and relationships")
);

add(H(2, "9.5 Table specifications"));
add(
  P(
    "The tables below are specified in full because they carry the product's core invariants. The remaining entities follow the same conventions: a UUID primary key defaulted by gen_random_uuid(), explicit foreign-key constraints named fk_<table>_<column>, and unique constraints named uq_<table>_<columns>."
  )
);

add(H(3, "9.5.1 content.question"));
add(
  T(
    ["Column", "Type", "Null", "Default", "Key", "Description"],
    [
      ["question_id", "uuid", "no", "gen_random_uuid()", "PK", "Surrogate identity"],
      ["question_uid", "text", "no", "—", "UQ", "Human-readable identifier supplied by the writer; no generator function exists in the database"],
      ["primary_node_id", "uuid", "no", "—", "FK catalog.syllabus_node", "The question's primary syllabus placement"],
      ["job_id", "uuid", "no", "—", "FK content.ai_generation_job", "Provenance record; retained as history for the retired generation subsystem"],
      ["question_type", "text", "yes", "—", "—", "Item format (single-response, multiple-response, numeric)"],
      ["difficulty_band", "text", "yes", "—", "—", "easy, medium or hard"],
      ["stem_text", "text", "no", "—", "—", "The question stem; a stem_format discriminator governs its markup"],
      ["numeric_answer", "numeric", "yes", "—", "—", "Expected value for numeric items"],
      ["answer_tolerance", "numeric", "yes", "—", "—", "Accepted tolerance for numeric items"],
      ["origin_year", "smallint", "yes", "—", "—", "Source examination year where known"],
      ["usage_count", "integer", "no", "0", "—", "Denormalised service count"],
      ["lifecycle_status", "text", "no", "—", "—", "draft, in_review, approved, published or retired"],
      ["has_image", "boolean", "no", "false", "—", "Computed by migration 028; true when an image asset is attached"],
      ["content_fp, skeleton_fp", "bytea", "yes", "—", "Indexed", "Fingerprints from migration 030, used for duplicate detection"],
    ],
    [1.3, 0.8, 0.5, 1.1, 1.3, 3]
  ),
  TBL("content.question")
);
add(NOTE("Integrity", "The answer key lives in content.question_option.is_correct (and in numeric_answer for numeric items). It is never projected into a pre-submission payload."));

add(H(3, "9.5.2 content.question_option"));
add(
  T(
    ["Column", "Type", "Null", "Default", "Key", "Description"],
    [
      ["option_id", "uuid", "no", "gen_random_uuid()", "PK", "Stable option identity — responses reference this, never a positional index"],
      ["question_id", "uuid", "no", "—", "FK content.question", "Owning question"],
      ["option_label", "text", "no", "—", "UQ with question_id", "Displayed label (A, B, C, D)"],
      ["option_text", "text", "no", "—", "—", "Option body"],
      ["is_correct", "boolean", "no", "false", "—", "Answer key. Confidential before submission"],
      ["display_order", "smallint", "yes", "—", "—", "Presentation order before any per-attempt shuffle"],
    ],
    [1.3, 0.8, 0.5, 1.1, 1.3, 3]
  ),
  TBL("content.question_option")
);

add(H(3, "9.5.3 assess.attempt"));
add(
  T(
    ["Column", "Type", "Null", "Default", "Key", "Description"],
    [
      ["attempt_id", "uuid", "no", "gen_random_uuid()", "PK", "Attempt identity"],
      ["test_id", "uuid", "no", "—", "FK assess.test", "The test being attempted"],
      ["user_id", "uuid", "no", "—", "FK core.app_user", "Owner. Every read path filters on this column"],
      ["assignment_id", "uuid", "yes", "—", "FK assess.test_assignment", "Set when the attempt originates from an assignment"],
      ["attempt_no", "smallint", "no", "—", "UQ (test_id, user_id, attempt_no)", "Sequence number of this user's attempts at this test"],
      ["started_at", "timestamptz", "yes", "—", "—", "Server clock at start"],
      ["server_deadline", "timestamptz", "yes", "—", "—", "Authoritative deadline: start plus test duration, computed by the database"],
      ["submitted_at", "timestamptz", "yes", "—", "—", "Server clock at submission"],
      ["elapsed_seconds", "integer", "yes", "—", "—", "Elapsed time at submission"],
      ["attempt_state", "text", "no", "—", "Check", "in_progress, paused, submitted, scored or abandoned"],
      ["paused_ms_total", "bigint", "no", "0", "—", "Accumulated paused time (migration 018)"],
      ["attempt_seq", "integer", "yes", "—", "—", "Generation sequence (migration 018)"],
      ["submitted_reason", "text", "yes", "—", "Check", "student, expiry, admin or sweeper"],
      ["device_fingerprint, sync_state", "text", "yes", "—", "—", "Client context captured at start"],
    ],
    [1.3, 0.8, 0.5, 1.1, 1.3, 3]
  ),
  TBL("assess.attempt")
);
add(
  NOTE(
    "Invariant",
    "Only in_progress, paused and scored are written by live code paths; submitted and abandoned are permitted by the check constraint but reserved. Attempts are not exposed through the generic CRUD router precisely because a generic write would let an owner set attempt_state or server_deadline directly."
  )
);

add(H(3, "9.5.4 assess.attempt_response"));
add(
  T(
    ["Column", "Type", "Null", "Key", "Description"],
    [
      ["attempt_id", "uuid", "no", "FK assess.attempt; UQ with test_question_id", "Owning attempt"],
      ["test_question_id", "uuid", "no", "FK assess.test_question", "The served item this response answers"],
      ["option_id", "uuid", "yes", "FK content.question_option", "Selected option; validated against the question by a database trigger raising SQLSTATE LM001"],
      ["numeric_value", "numeric", "yes", "—", "Supplied value for numeric items"],
      ["response_state", "text", "no", "—", "answered, unattempted, marked-for-review or void"],
      ["updated_at", "timestamptz", "no", "—", "Last write; the unique constraint makes the save path an upsert"],
    ],
    [1.4, 0.9, 0.5, 2, 3]
  ),
  TBL("assess.attempt_response (principal columns)")
);

add(H(3, "9.5.5 core.app_user and core.user_session"));
add(
  T(
    ["Table", "Purpose", "Key columns and constraints"],
    [
      ["core.app_user", "Canonical application identity, provisioned from the verified identity-provider subject on first authenticated request", "user_id (PK), institution_id (FK), email, status (expanded by migration 014), member_code (migration 017), mobile (nullable by migration 007)"],
      ["core.user_session", "Application session record backing idle-timeout and absolute-cap enforcement, keyed by the token's session claim so a background refresh is not a new session", "session_id (PK), user_id (FK), issued_at, last_seen_at, terminated_at (migration 022)"],
      ["core.role, core.permission, core.role_permission, core.user_role_assignment", "Persisted RBAC. Roles carry a platform or institution scope", "Seeded by db/scripts/seed/00_core_roles.ts; role codes listed in Section 12.4"],
      ["core.invitation", "Invitation lifecycle for administrator-initiated onboarding", "Introduced by migration 015"],
    ],
    [1.4, 2.6, 3.2]
  ),
  TBL("Identity and session tables")
);

add(H(2, "9.6 Relationships and normalisation"));
add(
  P(
    "The model is in third normal form with three deliberate, documented denormalisations: content.question.usage_count (a service counter maintained alongside content.question_usage), content.question.has_image (a computed flag introduced by migration 028 so that image-only blueprint lines can filter without a join), and the fingerprint columns used by duplicate detection. Each exists to keep a hot read path from joining, and each has a defined source of truth that can regenerate it."
  )
);

add(H(2, "9.7 Transactions and concurrency"));
add(
  B([
    "Attempt start runs in one transaction: create the attempt, persist the served item set in a single batched insert, and compute the deadline from the database clock.",
    "Submission runs in one transaction under a row lock on the attempt, so concurrent submissions serialise and the second observes a scored attempt.",
    "Response saves are single-statement upserts against the unique constraint on (attempt_id, test_question_id).",
    "A unique constraint on (test_id, user_id, attempt_no) prevents duplicate attempt numbering under a race; the resulting unique violation is translated to 409 DUPLICATE_KEY.",
    "Every query issued inside a transaction must use that transaction's checked-out client. Issuing it on the shared pool while holding a client is the defect recorded as RISK-01.",
  ])
);

add(H(2, "9.8 Data integrity"));
add(
  B([
    "Referential integrity is enforced by foreign keys throughout; violations surface as 409 FK_VIOLATION.",
    "Domain constraints are enforced by check constraints (attempt state, submission reason, and the domain checks added by migration 012).",
    "A trigger guards that a selected option belongs to the question actually served in that attempt, raising a dedicated SQLSTATE mapped to 422 RESPONSE_OPTION_MISMATCH rather than a generic failure.",
    "Uniqueness is enforced at the database rather than in application code: question_uid, (question_id, option_label), (attempt_id, test_question_id), (test_id, user_id, attempt_no), one open pause per attempt, and cross-section question uniqueness within a test (migration 027).",
    "Audit rows are designed to outlive the entity they describe (migration 045).",
  ])
);

add(H(2, "9.9 Migration, seeding and operational data management"));
add(
  T(
    ["Concern", "Specification"],
    [
      ["Migration strategy", "Numbered forward-only SQL under db/migrations, each with a paired assertion script under db/verify. Applied one at a time with db/scripts/run-migration.mjs, which fails the run if the verification script's assertions do not hold. Applied files are never edited."],
      ["Rollback", "Only where a reversal script exists (three today, for the question-identity, asset-identity and dedup-toolkit changes). Otherwise a correction is a new forward migration."],
      ["Seeding", "Four ordered, idempotent seed scripts: core roles and permissions, catalog reference data, a core lifecycle fixture, then an assessment fixture. Each accepts a dry-run flag and is safe to re-run."],
      ["Content loading", "Question content enters through import batches, not seeds; publication runs through the lifecycle state machine, never a direct status update."],
      ["Backup", "Provided by the managed platform. Frequency, retention and point-in-time recovery window are [TO BE DEFINED] (TBD-02)."],
      ["Restore", "Platform restore procedure; the application requires no coordination beyond a restart. Restore has not been rehearsed (RISK-04)."],
      ["Archival", "content.asset_archive exists for withdrawn assets. No attempt or scorecard archival process exists; the retention period is [TBD]."],
      ["Retention", "[TO BE DEFINED] per data class — see Section 10.7 and TBD-03."],
      ["Deletion", "Account deletion erases or anonymises the user's data through db/shared/wipe-user-data, with audit rows retained by design. Migration 034 made the foreign keys involved nullable so that deletion does not cascade into audit history."],
    ],
    [1, 4.2]
  ),
  TBL("Migration, seeding, backup and retention")
);

/* ========================= 10. DATA ARCHITECTURE ========================= */
add(PB(), H(1, "10. Data Architecture"));

add(H(2, "10.1 Sources, ingestion and processing"));
add(
  CODE([
    "  Authoring (external)          Import pipeline                  Serving",
    "  --------------------          ---------------                  -------",
    "  batch JSON + images   ---> schemas/ contract validation",
    "  (db/content/                        |",
    "   content-batches/)                  v",
    "                            db/scripts/import/import-content.ts",
    "                                      |",
    "                    +-----------------+------------------+",
    "                    v                                    v",
    "          content.import_batch                   Supabase Storage",
    "          content.import_row                     (asset objects)",
    "                    |                                    |",
    "                    v                                    v",
    "          content.question (draft)  <---- content.asset (role, url)",
    "                    |",
    "                    |  fingerprint (content_fp, skeleton_fp)",
    "                    v",
    "          dedup detection -> question_duplicate_candidate",
    "                           -> question_dedup_repoint / _quarantine",
    "                    |",
    "                    |  lifecycle state machine (permission-gated)",
    "                    v",
    "          draft -> in_review -> approved -> published -> retired",
    "                    |",
    "                    v",
    "          assembler (read-only)  ---> assess.attempt_question (served set)",
    "                    |                        |",
    "                    |                        v",
    "                    |               assess.attempt_response",
    "                    |                        |",
    "                    |                        v",
    "                    +---> assess.user_question_seen     assess.scorecard",
    "                          content.question_usage        assess.section_score",
    "                          (exposure ledgers)                    |",
    "                                                                v",
    "                                                    analytics (dashboard, IRT,",
    "                                                    cohort), learn.topic_mastery",
  ]),
  FIG("Data flow — from authored batch to served item, response and analytics")
);

add(H(2, "10.2 Data transformation"));
add(
  B([
    "Stem normalisation folds whitespace, dashes and multi-word topic markers before fingerprinting, so that cosmetically different duplicates collapse to the same key.",
    "Answer-key normalisation (migration 038) reconciles imported key representations onto option identifiers.",
    "Template artefact stripping (migrations 036 and 047) removes import-template residue and requires an explicit artefact marker.",
    "Image assets are perceptually hashed to support asset-level duplicate detection.",
    "Marks are computed as scaled integers and rendered as decimal strings; they are never converted to floating point at any stage, including in API payloads.",
  ])
);

add(H(2, "10.3 Storage, synchronisation and distribution"));
add(
  P(
    "PostgreSQL is the single system of record. Image assets live in object storage with the database holding the reference; the two are reconciled by a verification script that reports orphaned rows and missing objects. There is no replication, no secondary store, no cache and no data warehouse in this baseline, so there is no synchronisation problem to solve and no eventual-consistency window to reason about. Client-side state is a projection only and is authoritative for nothing."
  )
);

add(H(2, "10.4 Data lifecycle and ownership"));
add(
  T(
    ["Data class", "Owner", "Lifecycle", "Classification"],
    [
      ["Catalog reference data", "Content administration", "Seeded, then amended by permitted writes; effectively permanent", "Internal"],
      ["Question content and assets", "Content administration", "Imported as draft, reviewed, published, retired; duplicates quarantined and repointed", "Confidential (the answer key in particular)"],
      ["Candidate identity and profile", "The candidate; platform as processor", "Provisioned on first sign-in; erased or anonymised on account deletion", "Personal data"],
      ["Attempts, responses, scorecards", "The candidate; platform as processor", "Created per attempt; retention [TBD]; erased with the account", "Personal data"],
      ["Exposure ledgers (user_question_seen, question_usage)", "Platform", "Appended as items are served; required for anti-repeat", "Personal data (linked to a user)"],
      ["Learning artefacts (plans, flashcards, notes, error log)", "The candidate", "User-managed; erased with the account", "Personal data"],
      ["Sessions", "Platform", "Created on sign-in, terminated on logout, expiry or forced sign-out", "Personal data"],
      ["Audit records", "Platform", "Append-only; retained deliberately beyond the entity they describe", "Internal"],
      ["Operational logs", "Platform", "Process stdout and stderr; no retention configured", "Internal"],
    ],
    [1.7, 1.2, 3, 1.3]
  ),
  TBL("Data classification, ownership and lifecycle")
);
add(NOTE("Open item", "Retention periods for attempts, scorecards, exposure ledgers, sessions and logs are [TO BE DEFINED] (TBD-03). No archival tier exists; deletion today is limited to account deletion."));

/* ========================= 11. WORKFLOWS ========================= */
add(PB(), H(1, "11. End-to-End Workflows"));
add(
  P(
    "Each workflow is specified with the same fields: objective, trigger, preconditions, main flow, alternate flows, failure flows, postconditions, and the components, APIs, database entities, integrations, logging and security considerations it involves."
  )
);

function workflow(id, name, rows) {
  add(H(2, id + " " + name));
  add(T(["Aspect", "Specification"], rows, [1, 4.2]), TBL("Workflow — " + name));
}

workflow("11.1", "Authentication and session establishment", [
  ["Objective", "Establish an authenticated caller with a valid application session."],
  ["Trigger", "The user signs in on the landing view, or an existing token is presented to any authenticated endpoint."],
  ["Preconditions", "The Supabase project is reachable and the client holds the publishable key."],
  ["Main flow", "1. The browser authenticates directly with Supabase Auth (password, Google OAuth redirect or One Tap). 2. The SDK stores and refreshes the session. 3. The client attaches the access token to every API call. 4. requireAuth verifies the token with the provider, provisions or resolves the canonical user, derives the session identity from the token's session claim, and applies the idle and absolute policy. 5. Attempt lockdown is evaluated. 6. The handler runs."],
  ["Alternate flows", "A background token refresh yields a new access token with the same session claim, which is not treated as a new session. A demonstration sign-in uses a fixed shared account."],
  ["Failure flows", "No token: 401 UNAUTHORIZED. Invalid or expired token: 401 UNAUTHORIZED. Application session lapsed: 401 SESSION_EXPIRED, on which the client signs out and returns to the landing route. Provider unreachable: all authenticated routes fail closed."],
  ["Postconditions", "req.user, req.accessToken and req.sessionInfo are populated; the session's last-seen timestamp is touched."],
  ["Components", "Web client, API edge, authentication chain, core schema."],
  ["APIs", "API-005, API-006, API-007; every authenticated endpoint."],
  ["Database", "core.app_user, core.user_session, core.user_role_assignment, core.role, core.role_permission."],
  ["Integrations", "Supabase Auth; optionally Google Identity Services."],
  ["Logging", "Request timing per request. Authentication failure logging is [TBD]."],
  ["Security", "No local signing secret exists. Fails closed at every step. Session policy is enforced independently of the provider's own, much longer, token expiry."],
]);

add(
  CODE([
    "  Browser            Supabase Auth        API (requireAuth)        PostgreSQL",
    "     |                     |                      |                     |",
    "     |  sign in            |                      |                     |",
    "     |-------------------->|                      |                     |",
    "     |  access token       |                      |                     |",
    "     |<--------------------|                      |                     |",
    "     |                                            |                     |",
    "     |  GET /api/... + Bearer token                |                     |",
    "     |-------------------------------------------->                     |",
    "     |                     |  auth.getUser(token) |                     |",
    "     |                     |<---------------------|                     |",
    "     |                     |  user (or error)     |                     |",
    "     |                     |--------------------->|                     |",
    "     |                                            | provision/resolve   |",
    "     |                                            |  core.app_user      |",
    "     |                                            |-------------------->|",
    "     |                                            | session policy      |",
    "     |                                            |  check + touch      |",
    "     |                                            |-------------------->|",
    "     |                                            | attempt lockdown    |",
    "     |                                            |-------------------->|",
    "     |  200 data  /  401 UNAUTHORIZED | SESSION_EXPIRED                  |",
    "     |<--------------------------------------------                     |",
  ]),
  FIG("Sequence — authentication, session policy and lockdown on every request")
);

workflow("11.2", "Test configuration and availability check", [
  ["Objective", "Let a candidate configure a test and know, before committing, whether the published pool can satisfy it."],
  ["Trigger", "The candidate changes a configuration field on the test-configuration screen, or presses Start."],
  ["Preconditions", "Authenticated; catalog tree loaded; published content exists."],
  ["Main flow", "1. The client debounces configuration changes and calls API-030 with the same configuration shape it would submit. 2. The server maps the mode to blueprint lines through the same mapping used by session creation. 3. Availability is computed per line against the published pool and the candidate's exposure history. 4. The client renders feasibility; Start runs the same check as a final blocking gate."],
  ["Alternate flows", "Full-mock mode uses the exam pattern's own line structure rather than a user-supplied one; image-practice mode adds an image-only filter."],
  ["Failure flows", "An infeasible configuration is reported before any attempt row exists. If it is nevertheless started, assembly raises 422 POOL_INSUFFICIENT carrying blueprint, section, requested and available counts."],
  ["Postconditions", "No state is written; the check is read-only."],
  ["Components", "Web client, API edge, assessment engine (availability), content pool."],
  ["APIs", "API-030, then API-031."],
  ["Database", "content.question, content.question_node_map, catalog.syllabus_node, assess.user_question_seen."],
  ["Integrations", "None."],
  ["Logging", "None specific. A pool-insufficiency rate metric is [TBD]."],
  ["Security", "Reveals only counts, never item identities."],
]);

workflow("11.3", "Attempt lifecycle", [
  ["Objective", "Administer a test attempt under server authority from start to closure."],
  ["Trigger", "The candidate starts a session (API-031) or an attempt against an existing test (API-035)."],
  ["Preconditions", "Authenticated; no other attempt is active for this candidate; the pool satisfies the blueprint."],
  ["Main flow", "1. The active-attempt guard runs. 2. Assembly selects items per blueprint line, excluding items already picked in this paper and preferring unseen items. 3. A transaction creates the attempt, persists the served set and order in one batched insert, and computes server_deadline from the database clock. 4. The envelope is returned with serverNow and remainingSeconds. 5. The client renders and counts down from the server's reading. 6. Answers are saved per question and flushed on a 12-second interval. 7. Pause and resume accumulate paused time. 8. The candidate submits, or the sweeper closes the attempt after the deadline."],
  ["Alternate flows", "Resume of an existing active attempt instead of creating a new one. Pause and resume any number of times, subject to one open pause row per attempt."],
  ["Failure flows", "409 ACTIVE_ATTEMPT_EXISTS with the existing identifiers so the client can offer resume or submit. 422 POOL_INSUFFICIENT. 422 QUESTION_NOT_IN_ATTEMPT or RESPONSE_OPTION_MISMATCH on an invalid save. Client disappearance is handled by the sweeper, which records submitted_reason sweeper."],
  ["Postconditions", "The attempt is scored (or abandoned) and its served set, responses, events and pauses are persisted."],
  ["Components", "Web client, API edge, assessment engine, scoring engine, expiry sweeper."],
  ["APIs", "API-031, API-033 to API-044."],
  ["Database", "assess.attempt, attempt_question, attempt_response, attempt_event, attempt_pause, user_question_seen; content.question and question_option."],
  ["Integrations", "Supabase Storage for image assets referenced by served items."],
  ["Logging", "Sweeper closures are logged with found, scored and abandoned counts."],
  ["Security", "The envelope excludes answer keys, solutions and answer-key-adjacent assets. Lockdown blocks non-attempt routes while an attempt is active. Ownership is enforced on every sub-route."],
]);

add(
  CODE([
    "  Client                 API                Assembler          PostgreSQL",
    "    |                     |                     |                   |",
    "    | POST /assess/sessions                     |                   |",
    "    |-------------------->|                     |                   |",
    "    |                     | active-attempt guard|                   |",
    "    |                     |-------------------------------------->  |",
    "    |                     | assembleForAttempt  |                   |",
    "    |                     |-------------------->| one query per     |",
    "    |                     |                     | blueprint line    |",
    "    |                     |                     |------------------>|",
    "    |                     |  served set + seed  |                   |",
    "    |                     |<--------------------|                   |",
    "    |                     | BEGIN; insert attempt; batched insert of |",
    "    |                     | served questions; deadline = now()+dur;  |",
    "    |                     | COMMIT                                   |",
    "    |                     |----------------------------------------->|",
    "    | envelope (serverNow, remainingSeconds, items without keys)     |",
    "    |<--------------------|                     |                   |",
    "    | PATCH responses (autosave, every 12 s)    |                   |",
    "    |-------------------->|--------------------------------------->  |",
    "    | POST submit         |                     |                   |",
    "    |-------------------->| BEGIN; SELECT ... FOR UPDATE; evaluate;  |",
    "    |                     | aggregate; write scorecard; COMMIT       |",
    "    |                     |----------------------------------------->|",
    "    | scorecard           |                     |                   |",
    "    |<--------------------|                     |                   |",
  ]),
  FIG("Sequence — start, answer and submit an attempt")
);

workflow("11.4", "Submission and scoring", [
  ["Objective", "Produce an authoritative, reproducible score for a closed attempt."],
  ["Trigger", "Candidate submission (API-044) or sweeper closure."],
  ["Preconditions", "The attempt is in_progress or paused and belongs to the caller (or the caller is the sweeper)."],
  ["Main flow", "1. Open a transaction and lock the attempt row. 2. Load the served items with their keys and the applicable scoring rules using the transaction's client. 3. Evaluate each response as correct, incorrect, unattempted, void or partial, in exact decimal. 4. Aggregate per section and for the attempt. 5. Persist the scorecard and section scores; set state to scored with a submission reason. 6. Commit."],
  ["Alternate flows", "Multiple-response items apply the marking scheme's partial-credit strategy. Voided items apply the disposition recorded on the rule, not an assumed one."],
  ["Failure flows", "A concurrent submission observes the scored state and returns without re-scoring. A missing scoring rule is logged loudly and returned as 500 SCORING_RULE_MISSING rather than defaulted."],
  ["Postconditions", "Exactly one scorecard per attempt; section scores sum to the attempt total in exact decimal."],
  ["Components", "Assessment engine, scoring engine."],
  ["APIs", "API-044, then API-045."],
  ["Database", "assess.attempt, attempt_response, scorecard, section_score; catalog.marking_scheme."],
  ["Integrations", "None."],
  ["Logging", "Scoring-rule data defects only."],
  ["Security", "Scoring inputs come exclusively from the database; nothing the client sends influences marks beyond the recorded response."],
]);

workflow("11.5", "Review and analytics", [
  ["Objective", "Give the candidate a defensible account of their performance."],
  ["Trigger", "The candidate opens review, results or the dashboard."],
  ["Preconditions", "For attempt-scoped reports, the attempt is scored and owned by the caller."],
  ["Main flow", "1. Review returns each served item with the candidate's response, the correct answer, the solution and all assets. 2. The scorecard returns section aggregates. 3. The dashboard aggregates the candidate's attempt history into counts, accuracy, subject and topic performance and trends. 4. Ability and cohort reports are available per scored attempt."],
  ["Alternate flows", "Client-side PDF export of a result."],
  ["Failure flows", "A report requested before scoring returns 409 REVIEW_NOT_AVAILABLE."],
  ["Postconditions", "None; all reads."],
  ["Components", "Analytics component, web client."],
  ["APIs", "API-045 to API-048, API-050."],
  ["Database", "assess.attempt, attempt_response, attempt_question, scorecard, section_score; catalog.syllabus_node; learn.topic_mastery."],
  ["Integrations", "Supabase Storage for review assets."],
  ["Logging", "None specific."],
  ["Security", "Post-scoring disclosure is deliberately unrestricted for the owner. Cohort comparison discloses aggregates only."],
]);

workflow("11.6", "Content ingestion and publication", [
  ["Objective", "Move authored content into the published pool with review and provenance."],
  ["Trigger", "An operator runs the import script against a batch directory."],
  ["Preconditions", "The batch validates against the schema contract; the referenced syllabus nodes exist; storage is configured."],
  ["Main flow", "1. Validate the batch. 2. Record the batch and each row. 3. Insert questions as draft with options, solutions, translations and node mappings; upload and register assets. 4. Compute fingerprints; detect duplicate candidates. 5. Submit for review, decide, publish through the permission-gated state machine."],
  ["Alternate flows", "Duplicate collapse repoints references rather than deleting rows. Bulk publication runs the same state machine, not a direct status update."],
  ["Failure flows", "A contract violation rejects the row and records it. An invalid transition returns 409 INVALID_STATE_TRANSITION."],
  ["Postconditions", "Published, deduplicated, reviewable content with a batch and row provenance trail."],
  ["Components", "Content pipeline, domain layer, object storage."],
  ["APIs", "API-020 to API-027 for the HTTP surface; import and dedup run as scripts."],
  ["Database", "content.* in full; catalog.syllabus_node."],
  ["Integrations", "Supabase Storage."],
  ["Logging", "Per-batch and per-row outcomes; asset renames recorded in their own log table."],
  ["Security", "Every write transition requires a content permission; imports run with operator credentials outside the request path."],
]);

workflow("11.7", "User invitation and administration", [
  ["Objective", "Onboard and administer users without cross-tenant exposure."],
  ["Trigger", "An administrator creates an invitation or acts on a user."],
  ["Preconditions", "The caller holds users:invite, users:manage_institution or users:manage_platform."],
  ["Main flow", "1. Permission is asserted by middleware. 2. The service narrows the reachable rows by tenancy. 3. The action is applied — invitation created, resent or revoked; user updated; status transitioned; role granted or revoked; sign-out or password reset forced through the identity provider's admin API."],
  ["Alternate flows", "Platform-scoped administrators are not narrowed by institution."],
  ["Failure flows", "403 FORBIDDEN without the permission; 404 NOT_FOUND for a row outside the caller's tenancy, so tenancy membership is not disclosed."],
  ["Postconditions", "The user or invitation record reflects the action; forced actions take effect at the identity provider."],
  ["Components", "API edge, administrative services, identity provider admin client."],
  ["APIs", "API-070 to API-073."],
  ["Database", "core.app_user, core.invitation, core.user_role_assignment, core.role."],
  ["Integrations", "Supabase Auth admin API using the service-role credential, server-side only."],
  ["Logging", "[TBD] — administrative actions are not currently written to a dedicated audit log."],
  ["Security", "Permission answers the verb; tenancy answers the rows. The service-role key never leaves the server."],
]);

/* ========================= 12. AUTHENTICATION AND AUTHORISATION ========================= */
add(PB(), H(1, "12. Authentication and Authorisation"));

add(H(2, "12.1 Authentication mechanism"));
add(
  P(
    "Authentication is delegated in full to Supabase Auth. The browser authenticates directly and receives an access token; the API verifies that token on every request by calling the provider's user endpoint. The API holds no signing secret and cannot mint a token, which removes an entire class of key-management risk and makes the design indifferent to whether the project signs with a shared secret or asymmetric keys."
  )
);
add(
  CODE([
    "  +---------+      1. credentials / OAuth / One Tap      +---------------+",
    "  | Browser |------------------------------------------->| Supabase Auth |",
    "  |         |<-------------------------------------------|               |",
    "  +----+----+      2. access token (+ refresh, in SDK)   +-------+-------+",
    "       |                                                          ^",
    "       | 3. API call with Authorization: Bearer <token>           |",
    "       v                                                          |",
    "  +---------------------------+   4. verify token (auth.getUser)  |",
    "  |  API: requireAuth         |-----------------------------------+",
    "  |                           |",
    "  |  5. provision/resolve core.app_user      -> appUserId",
    "  |  6. session_id claim -> core.user_session",
    "  |     idle > 30 min?  absolute > 12 h?     -> 401 SESSION_EXPIRED",
    "  |  7. attempt lockdown                     -> blocked if attempt active",
    "  |  8. requirePermission(code) / ownership  -> 403 / 404",
    "  +-------------+-------------+",
    "                |",
    "                v",
    "        handler executes",
  ]),
  FIG("Authentication and authorisation flow")
);

add(H(2, "12.2 Session management and token lifecycle"));
add(
  T(
    ["Aspect", "Specification"],
    [
      ["Token issuance and refresh", "By the identity provider, in the browser. The SDK refreshes in the background; a refresh produces a new access token with the same session claim."],
      ["Session identity", "The token's session claim, so a refresh is not mistaken for a new sign-in. If the claim is ever absent the implementation degrades to one tracked session per user rather than failing."],
      ["Idle timeout", "30 minutes by default, configurable through SESSION_IDLE_TIMEOUT_MINUTES. Enforced on every authenticated request and refreshed by the heartbeat endpoint."],
      ["Absolute cap", "12 hours by default, configurable through SESSION_ABSOLUTE_HOURS. Not extendable by activity."],
      ["Client-side guard", "useIdleSessionGuard warns and then signs the user out client-side; the server remains the authority."],
      ["Logout", "POST /api/auth/session/logout terminates the application session record; the client also signs out of the identity provider."],
      ["Revocation", "Forced sign-out (API-073) terminates sessions through the provider's admin API. There is no application-side token blocklist; the application session record is the local revocation point."],
      ["Password policy and MFA", "Owned by the identity provider's project configuration; the application does not implement either. Current settings are [TO BE DEFINED] (TBD-08)."],
      ["Account recovery", "Provider-hosted password reset; administrators may force a reset. Account deletion additionally requires a recent one-time-password re-authentication, verified from the token's authentication-methods claim."],
      ["Service-to-service", "Only the service-role credential, used server-side by administrative paths and operational scripts. It is never present in a client bundle."],
    ],
    [1, 4.2]
  ),
  TBL("Session and token lifecycle")
);

add(H(2, "12.3 Authorisation model"));
add(
  P(
    "Authorisation combines three independent mechanisms, each answering a different question. Permission checks answer whether the caller may perform the verb, and read persisted role-permission data. Ownership checks answer whether the caller may touch the row, and are expressed as query predicates on the owner column; for attempt sub-resources ownership is resolved once per request from the parent attempt rather than per child row. Tenancy narrowing answers which population an administrator may act on, and lives in the service layer. A route may require all three."
  )
);
add(
  T(
    ["Mechanism", "Implemented by", "Failure response", "Example"],
    [
      ["Permission (RBAC)", "requirePermission(code) reading core.role_permission", "403 FORBIDDEN", "content:publish on API-024"],
      ["Ownership (direct)", "makeOwnedCrudRouter owner-column filter", "404 NOT_FOUND", "learn.revision_note by user_id"],
      ["Ownership (transitive)", "requireAttemptOwnership() resolving :attemptId once", "404 NOT_FOUND", "attempt responses, events, scorecard"],
      ["Tenancy", "Institution narrowing inside administrative services", "404 NOT_FOUND", "API-071 for an institution administrator"],
      ["Lockdown", "enforceAttemptLockdown inside requireAuth", "Blocked with an explicit code", "Non-attempt routes during an active attempt"],
    ],
    [1.2, 2.3, 1.1, 2.4]
  ),
  TBL("Authorisation mechanisms")
);
add(NOTE("Rationale", "Ownership failures answer 404 rather than 403 so that the existence of another user's row is not disclosed. This is intentional and should not be 'corrected' to 403."));

add(H(2, "12.4 Roles and permissions"));
add(
  T(
    ["Role code", "Name", "Scope"],
    [
      ["super_admin", "Super Administrator", "platform"],
      ["platform_admin", "Platform Administrator", "platform"],
      ["content_admin", "Content Administrator", "platform"],
      ["content_reviewer", "Content Reviewer", "platform"],
      ["institution_admin", "Institution Administrator", "institution"],
      ["educator", "Educator", "institution"],
      ["student", "Student", "platform"],
      ["system", "System / Automation Account", "platform"],
    ],
    [1.2, 2, 1]
  ),
  TBL("Seeded roles")
);
add(
  T(
    ["Permission code", "Grants"],
    [
      ["catalog:write", "Create, update or delete catalog reference data (exams, patterns, syllabus, marking schemes)"],
      ["admin:stats", "View platform-wide administrative statistics"],
      ["users:invite", "Invite a new user by email"],
      ["users:manage_platform", "List, read, update and change the status of any user platform-wide"],
      ["users:manage_institution", "The same, restricted to the caller's own institution"],
      ["content:submit_review", "Submit a draft question for review (draft to in_review)"],
      ["content:review_decide", "Approve or reject a question under review"],
      ["content:publish", "Publish an approved question or retire a published one"],
    ],
    [1.4, 4]
  ),
  TBL("Seeded permissions")
);
add(NOTE("Open item", "The complete role-to-permission assignment matrix is held as seeded data. Reproducing it here would duplicate a source of truth that can change; the authoritative mapping is core.role_permission, populated by db/scripts/seed/00_core_roles.ts. A rendered snapshot per release is [TBD] (TBD-09)."));

/* ========================= 13. SECURITY ARCHITECTURE ========================= */
add(PB(), H(1, "13. Security Architecture"));

add(H(2, "13.1 Threat model and attack surface"));
add(
  T(
    ["ID", "Threat", "Asset at risk", "Control"],
    [
      ["THR-01", "A candidate reads the answer key before submitting", "Assessment integrity", "Answer keys, solutions and answer-key-adjacent assets are excluded from every pre-submission projection; asserted by contract test"],
      ["THR-02", "A candidate manipulates the timer or the deadline", "Assessment integrity", "The deadline is computed and stored by the database; the envelope carries a server clock reading; the sweeper closes attempts independently of the client"],
      ["THR-03", "A candidate writes attempt state directly", "Assessment integrity", "Attempts are excluded from the generic CRUD router; only purpose-built transitions exist"],
      ["THR-04", "A candidate reads another candidate's attempt or results", "Personal data", "Ownership predicates on every read; transitive ownership for attempt children; 404 rather than 403"],
      ["THR-05", "An institution administrator reaches another institution's users", "Personal data", "Tenancy narrowing in the service layer, independent of permission"],
      ["THR-06", "Stolen or replayed access token", "Account", "Provider verification per request; application idle and absolute session policy; forced sign-out available"],
      ["THR-07", "Cross-site scripting leading to token theft", "Account", "React escaping by default; Helmet CSP restricting connect-src and img-src to self and the project's Supabase origin"],
      ["THR-08", "SQL injection", "All data", "Parameterised queries throughout; no string interpolation of user input into SQL"],
      ["THR-09", "Secret disclosure through the client bundle or the repository", "Platform", "Only VITE_-prefixed variables reach the browser; the service-role key is server-only; .env is untracked and .env.example carries no real values"],
      ["THR-10", "Denial of service by request volume", "Availability", "Not mitigated in the application; edge rate limiting is [TBD] (TBD-06)"],
      ["THR-11", "Malicious or oversized upload", "Platform", "1 MB JSON body limit; content ingestion is an operator-run script, not a public upload path"],
      ["THR-12", "Dependency compromise", "Platform", "Pinned dependency ranges and a lockfile; automated vulnerability scanning is [TBD] (TBD-10)"],
    ],
    [0.7, 2.6, 1.3, 4]
  ),
  TBL("Threat model")
);

add(H(2, "13.2 Controls"));
add(
  T(
    ["Control area", "Specification"],
    [
      ["Encryption in transit", "HTTPS for all browser and server traffic; TLS to the managed database. Certificate management belongs to the hosting platform ([TBD])."],
      ["Encryption at rest", "Provided by the managed platform for database and object storage. Application-level field encryption is not used."],
      ["Key and secret management", "Environment variables in each environment; GitHub Actions secrets for CI. No secret manager is integrated ([TBD], TBD-04). Secrets are never committed, never logged and never placed in this document."],
      ["Input validation", "Zod schemas at the HTTP boundary for write routes; database constraints as the backstop, with SQLSTATE translation to 400 for malformed input."],
      ["Output encoding", "React escapes interpolated content by default. Any future use of raw HTML rendering requires sanitisation and an explicit review."],
      ["API security", "Bearer authentication, permission and ownership checks, CORS allow-list, 1 MB body limit, no verbose error disclosure (unmapped errors return a generic message while the stack is logged server-side)."],
      ["Network security", "Ingress restriction, WAF and database network allow-listing are hosting-platform concerns and are [TO BE DEFINED]."],
      ["Infrastructure security", "Managed platform responsibility for host patching; application host hardening is [TBD] pending the hosting decision."],
      ["Dependency security", "Lockfile-pinned installs in CI. Scheduled vulnerability scanning and an upgrade cadence are [TBD]."],
      ["Vulnerability management", "No formal intake, triage or disclosure process is defined ([TBD], TBD-11)."],
      ["Security logging and audit", "Content lifecycle decisions and question identity changes are recorded in dedicated tables. Authentication failures, administrative actions and permission denials are not currently written to a security log ([TBD])."],
      ["Security monitoring", "Not implemented ([TBD])."],
      ["Incident response", "See Section 28.11. A formal incident-response plan with roles and communication paths is [TO BE DEFINED]."],
    ],
    [1.1, 4.2]
  ),
  TBL("Security controls")
);

add(H(2, "13.3 Secure-by-design practices and OWASP alignment"));
add(
  P(
    "The design addresses the OWASP Top Ten categories most relevant to this product as follows. Broken access control is addressed by mandatory ownership predicates, transitive ownership resolution and tenancy narrowing, with a deliberate 404-over-403 disclosure policy. Cryptographic failures are limited by delegating identity entirely, holding no signing secret and storing no password material. Injection is addressed by parameterised SQL and schema-validated input. Insecure design is addressed by the server-authority principle: the client is never trusted for time, item selection or marks. Security misconfiguration is addressed by a CSP that extends the framework default by exactly one required origin, and by fail-fast environment validation at boot. Identification and authentication failures are addressed by provider-side verification plus an application session policy the provider does not offer. Software and data integrity failures are partially addressed — dependency scanning remains outstanding. Security logging and monitoring failures are the weakest area at this baseline and are recorded as open items rather than claimed as covered."
  )
);
add(NOTE("Statement", "No credential, token, key or connection string appears anywhere in this document. Any example value is a placeholder in square brackets."));

module.exports = c;
