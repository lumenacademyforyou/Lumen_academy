/** Sections 1-4: Executive Summary, Product Scope, Requirements, System Overview. */
const { H, P, B, N, T, TBL, FIG, CODE, NOTE, PB } = require("./helpers.cjs");

const c = [];
const add = (...x) => x.forEach((y) => (Array.isArray(y) ? c.push(...y) : c.push(y)));

/* ========================= 1. EXECUTIVE SUMMARY ========================= */
add(H(1, "1. Executive Summary"));
add(
  P(
    "Lumen Academy — NEET Assessment Tool is a self-hosted, TypeScript full-stack examination-preparation platform for candidates of the Indian National Eligibility cum Entrance Test (NEET). It maintains a curated, reviewed question bank, assembles mock and practice papers from that bank on every attempt, administers the attempt under a server-authoritative timer, scores the submission on the server against a stored marking scheme, and returns a scorecard, a per-question review and longitudinal analytics to the candidate."
  ),
  P(
    "The problem it addresses is that unsupervised self-preparation gives candidates neither a realistic paper nor trustworthy feedback. Free question sets repeat items, expose their answer keys, and cannot report where a candidate is actually weak. This product treats the paper as a generated artefact rather than a static file: the assembler selects items per blueprint line from the published bank, excludes items the candidate has already seen, records what was served, and scores centrally so that a client cannot influence the result."
  )
);
add(H(2, "1.1 Primary users"));
add(
  B([
    "Candidate (student) — the principal actor: takes tests, reviews results, tracks mastery, and manages study plans, flashcards, revision notes and Pomodoro sessions.",
    "Content administrator and content reviewer — import, review, publish and retire question content through the content lifecycle state machine.",
    "Institution administrator and educator — invite and manage users within a single institution (tenancy-scoped).",
    "Platform administrator and super administrator — platform-wide user lifecycle, role assignment and platform statistics.",
    "System / automation account — background jobs (attempt-expiry sweeping, scheduled demo-account reset).",
  ])
);
add(H(2, "1.2 Primary use cases"));
add(
  B([
    "Configure and start a subject-wise, full-mock, custom or image-practice test session in one call, with a pre-flight pool-availability check.",
    "Answer questions with periodic autosave, pause and resume, and a server-anchored countdown.",
    "Submit (or be auto-submitted at deadline) and receive a server-computed scorecard with per-section aggregates.",
    "Review each served question post-scoring, including the answer key, solution and any image assets.",
    "Track subject and topic performance over time on a dashboard, and export results to PDF.",
    "Administer users, invitations, roles and content lifecycle transitions through permission-gated endpoints.",
  ])
);
add(H(2, "1.3 Business and technical objectives"));
add(
  P(
    "The business objective is a production-grade NEET preparation product that a candidate can rely on unsupervised, and that an institution can administer for a cohort. The technical objectives that follow from it are: server authority over anything that affects a score (timer, item selection, answer key, marks); one canonical persistence layer with forward-only, individually verified SQL migrations; strict tenancy and ownership isolation on every read path; and an implementation that a small team can operate as a single Node process against managed infrastructure."
  )
);
add(H(2, "1.4 High-level system behaviour"));
add(
  P(
    "A browser-hosted React single-page application authenticates the user directly against Supabase Auth and thereafter calls a stateless Express API with the resulting bearer token. The API verifies each token with Supabase's Auth API, resolves the caller to a canonical application user, applies this application's own idle and absolute session policy, and then executes domain logic implemented as a hand-written TypeScript layer over raw SQL against PostgreSQL. Question images resolve to public object-storage URLs. In production the same Node process also serves the built SPA."
  )
);
add(H(2, "1.5 Major technical components"));
add(
  B([
    "Frontend SPA — React 19, Vite 6, Tailwind CSS 4, React Router 7, Recharts.",
    "API layer — Express 4 on Node 20, with Helmet, CORS, Zod request validation and a centralised error translator.",
    "Domain layer — the db/ tree: catalog, core, content, assess and learn, each entity exposing a model, repository and service over raw SQL.",
    "Assessment engine — blueprint assembler, seeded shuffle, anti-repeat exposure ledger, exact-decimal scoring, scorecard aggregation, IRT and cohort analytics.",
    "Persistence — PostgreSQL (Supabase-hosted), six schemas, forward-only numbered migrations each paired with a verification script.",
    "Platform services — Supabase Auth (identity) and Supabase Storage (question assets).",
    "Background job — in-process attempt-expiry sweeper on a 60-second interval.",
  ])
);
add(H(2, "1.6 Key architectural characteristics"));
add(
  B([
    "Server-authoritative assessment: deadline, item selection, answer key and marks never originate from the client.",
    "Stateless API: no server-side session store beyond a database-backed session row; horizontal scaling is bounded by database connection budget, not by API affinity.",
    "Explicit persistence: no ORM owns the domain schema; SQL is written and verified per migration.",
    "Ownership-first authorisation: every user-owned read path filters by the caller's canonical user id, with transitive ownership resolved once per request for attempt sub-resources.",
    "Typed error contract: domain errors map to a fixed catalogue of HTTP status and code pairs.",
  ])
);
add(H(2, "1.7 Major dependencies"));
add(
  B([
    "Supabase — Auth, Storage and managed PostgreSQL. The platform is a single point of dependency for identity, assets and data.",
    "PostgreSQL extensions and features relied upon: generated columns, check constraints, triggers, row-level security, and a vector index migration (006).",
    "Google OAuth (via Supabase provider configuration) and, optionally, Google One Tap.",
    "Google Drive — currently the host for unit study materials referenced by learn.unit_material.",
  ])
);
add(H(2, "1.8 Major risks"));
add(
  P(
    "The risk register in Section 27 is authoritative. The four risks leadership should be aware of at this document's baseline are: (i) a connection-pool exhaustion path in blueprint-mode attempt start under concurrency (RISK-01, from DB-01 in the repository defect backlog); (ii) total dependency on one managed platform for identity, storage and data, with a project-wide session-mode connection cap; (iii) the study-material corpus being unreachable to end users because the underlying Drive objects are not publicly shared (RISK-05, DB-06), which no code change can fix; and (iv) an incomplete internationalisation sweep, where user-visible strings remain untranslated outside the dictionary (RISK-06, DB-05)."
  )
);

/* ========================= 2. PRODUCT SCOPE ========================= */
add(PB(), H(1, "2. Product Scope"));
add(H(2, "2.1 Purpose"));
add(
  P(
    "This document is the authoritative technical specification for the product. It defines the requirements baseline, the architecture, the interface and persistence contracts, and the operational, security and quality expectations against which the implementation is built and reviewed. Where the implementation and this document disagree, the disagreement is a defect in one of them and shall be raised, not silently resolved."
  )
);
add(H(2, "2.2 Product objectives"));
add(
  B([
    "Deliver a realistic, non-repeating NEET practice paper on demand from a reviewed question bank.",
    "Guarantee that a candidate's score is computed by the server from the served paper and a stored marking scheme.",
    "Give the candidate actionable feedback: per-question review, section aggregates, subject and topic trends.",
    "Support institutional administration of candidates without cross-tenant data exposure.",
    "Remain operable by a small team on managed infrastructure with a single deployable artefact.",
  ])
);
add(H(2, "2.3 Business context"));
add(
  P(
    "The product is developed by the Lumen Academy team as a self-hosted platform rather than a reseller of third-party question content. Content is imported in reviewed batches, published through a state machine, and owned by the platform. Commercial packaging (subscription plans and institution licensing) exists in the schema as core.subscription_plan and core.subscription, but the pricing model, billing integration and plan entitlements are [TO BE DEFINED]."
  )
);
add(H(2, "2.4 Technical objectives"));
add(
  B([
    "One canonical schema authority: db/migrations, forward-only, each migration paired with a verification script.",
    "Deterministic, reproducible paper assembly: a persisted generation seed reproduces the same served set.",
    "Exact decimal arithmetic for all marks; no floating-point arithmetic anywhere in scoring.",
    "Every authenticated route passes through one authentication, session-policy and lockdown chain.",
    "Type safety end to end: TypeScript strict mode, Zod validation at HTTP boundaries, typecheck gating in CI.",
  ])
);
add(H(2, "2.5 In scope"));
add(
  B([
    "Candidate-facing web application and the API that serves it.",
    "Question content lifecycle: import, review, publish, retire, deduplicate, asset management.",
    "Test definition (blueprint and fixed-paper modes), assembly, administration, scoring, review and analytics.",
    "Learning-support features: study plans and tasks, topic mastery, flashcards, revision notes, Pomodoro sessions, error log, notifications, unit materials.",
    "Identity integration, application session policy, RBAC and tenancy scoping, user lifecycle administration.",
    "Build, test and delivery pipeline; environment strategy; operational runbooks.",
  ])
);
add(H(2, "2.6 Out of scope"));
add(
  B([
    "Any generative-AI subsystem. The AI generation and explanation endpoints were retired and now answer HTTP 410; content.ai_generation_job is retained as a schema-level provenance record only.",
    "Native mobile applications.",
    "Payment processing and billing.",
    "Proctoring (camera, screen capture, identity verification) beyond the in-application attempt-lockdown middleware.",
    "Content authoring UI. Content enters the system through import scripts, not an editor.",
    "Live classes, messaging and social features.",
  ])
);
add(H(2, "2.7 Target users and actors"));
add(
  T(
    ["Actor", "Type", "Authentication", "Principal interactions"],
    [
      ["Candidate (student)", "Human, external", "Supabase Auth (password, Google OAuth, One Tap)", "Test configuration, attempt lifecycle, review, analytics, learning tools"],
      ["Content reviewer", "Human, internal", "Supabase Auth + RBAC", "content:submit_review, content:review_decide"],
      ["Content administrator", "Human, internal", "Supabase Auth + RBAC", "content:publish, import and dedup operations"],
      ["Educator", "Human, institution-scoped", "Supabase Auth + RBAC", "users:invite within own institution"],
      ["Institution administrator", "Human, institution-scoped", "Supabase Auth + RBAC", "users:manage_institution, invitations"],
      ["Platform / super administrator", "Human, platform-scoped", "Supabase Auth + RBAC", "users:manage_platform, admin:stats, role grants"],
      ["Expiry sweeper", "System, in-process", "None (trusted, in-process)", "Auto-submits attempts past their server deadline"],
      ["Demo-reset workflow", "System, scheduled", "Service-role credential", "Resets the shared demonstration account's data"],
      ["Supabase Auth", "External system", "n/a", "Token issuance and verification"],
      ["Supabase Storage", "External system", "Public object URLs", "Question image assets"],
      ["Google Drive", "External system", "Public link sharing", "Unit study materials"],
    ],
    [1.4, 1.1, 1.6, 2.4]
  ),
  TBL("Actors and their principal interactions")
);
add(H(2, "2.8 Primary use cases"));
add(
  T(
    ["ID", "Use case", "Primary actor", "Requirements"],
    [
      ["UC-01", "Sign in and establish an application session", "Candidate", "FR-001, FR-002, FR-005"],
      ["UC-02", "Check pool availability for a configuration", "Candidate", "FR-018"],
      ["UC-03", "Create and start a test session in one call", "Candidate", "FR-019, FR-021, FR-022"],
      ["UC-04", "Answer, autosave, pause and resume an attempt", "Candidate", "FR-023, FR-024, FR-025"],
      ["UC-05", "Submit an attempt and receive a scorecard", "Candidate", "FR-026, FR-029"],
      ["UC-06", "Be auto-submitted at the server deadline", "Expiry sweeper", "FR-027"],
      ["UC-07", "Review a scored attempt question by question", "Candidate", "FR-030"],
      ["UC-08", "View dashboard analytics and export results", "Candidate", "FR-034, FR-042"],
      ["UC-09", "Import, review and publish question content", "Content administrator", "FR-014, FR-015, FR-016"],
      ["UC-10", "Invite and administer users", "Institution / platform administrator", "FR-043 to FR-047"],
      ["UC-11", "Run a demonstration session without registering", "Candidate", "FR-008"],
    ],
    [0.6, 3, 1.4, 1.6]
  ),
  TBL("Primary use cases and the requirements they exercise")
);
add(H(2, "2.9 Assumptions"));
add(
  T(
    ["ID", "Assumption", "Consequence if false"],
    [
      ["ASM-01", "Supabase remains the identity, storage and database provider for the planned lifetime of this baseline.", "Authentication, asset resolution and connection-budget design all require rework."],
      ["ASM-02", "Deployment is a single Node process per environment; horizontal scale-out is not required at this baseline.", "The in-process expiry sweeper and the per-process connection budget need revisiting (both are safe but redundant when replicated)."],
      ["ASM-03", "Candidates use a current desktop or mobile browser with JavaScript enabled.", "The SPA does not function; no server-rendered fallback exists."],
      ["ASM-04", "Question content is authored and reviewed outside the application and enters through import batches.", "An authoring UI becomes an in-scope deliverable."],
      ["ASM-05", "English and Tamil are the only delivered content languages at this baseline.", "The translation table and the language toggle need a general language-negotiation design."],
      ["ASM-06", "The NEET marking scheme is stable per exam pattern and is held as data, not code.", "Scoring strategies would need per-exam branching, which the design explicitly forbids."],
    ],
    [0.7, 4, 4]
  ),
  TBL("Assumptions")
);
add(H(2, "2.10 Constraints"));
add(
  T(
    ["ID", "Constraint", "Origin"],
    [
      ["CON-01", "The Supabase session-mode pooler caps the whole project at 15 connections; each application pool is sized well below that (the db/ pool is capped at 4).", "Platform limit, documented in db/shared/pool.ts"],
      ["CON-02", "The backend never issues or verifies its own JWTs; token verification is delegated to the Supabase Auth API on every authenticated request.", "Design decision ADR-002"],
      ["CON-03", "The domain schema is evolved only through db/migrations; Prisma migrate and db push must never run against the live database.", "Design decision ADR-003"],
      ["CON-04", "No generative-AI provider may be called from this application.", "Programme directive (docs/LA-APP-COMPLETION-001)"],
      ["CON-05", "Marks arithmetic must use exact decimal values; floating-point arithmetic is prohibited in scoring.", "Engine requirement R-11"],
      ["CON-06", "The production bundle must be ESM, because the generated Prisma client depends on import.meta.url.", "Toolchain constraint"],
      ["CON-07", "Request bodies are limited to 1 MB.", "backend/src/server.ts"],
    ],
    [0.7, 4.6, 2.7]
  ),
  TBL("Constraints")
);
add(H(2, "2.11 Dependencies"));
add(
  T(
    ["Dependency", "Kind", "Used for", "Failure impact"],
    [
      ["Supabase Auth", "External service", "Sign-in, token verification, admin auth operations", "Total: no authenticated request can succeed"],
      ["Supabase PostgreSQL", "External service", "All persistence", "Total: the product is unavailable"],
      ["Supabase Storage", "External service", "Question image assets", "Partial: image-bearing questions render without their image"],
      ["Google OAuth / One Tap", "External service", "Optional sign-in path", "Partial: password sign-in remains available"],
      ["Google Drive", "External service", "Unit study materials", "Partial: study materials cannot be viewed or downloaded"],
      ["Node.js 20 runtime", "Platform", "API and build", "Total"],
      ["npm registry", "Build-time", "Dependency installation", "Build only"],
      ["GitHub Actions", "Build-time", "CI and scheduled workflows", "Delivery only"],
    ],
    [1.3, 1, 2.2, 2.2]
  ),
  TBL("External and platform dependencies")
);
add(H(2, "2.12 Known limitations"));
add(
  B([
    "Blueprint-mode attempt start calls the assembler from inside an open transaction while the assembler uses the shared pool, so sufficiently concurrent starts can exhaust the pool (RISK-01 / DB-01, open).",
    "Fixed-paper ingestion has no HTTP surface, so publish-time blueprint feasibility validation has nothing to attach to (DB-02, open).",
    "Client-side attempt history in the SPA is in-memory in places and does not reflect server state after a reload or on a new device (DB-03, open).",
    "Internationalisation coverage is partial: strings outside the resource dictionary render in English regardless of the selected UI language (DB-05, open).",
    "All catalogued unit-material links point at Drive objects that are not publicly shared, so the materials feature cannot function end to end until that is corrected outside the codebase (DB-06, open).",
    "The demonstration account is a single shared identity; concurrent demonstration users share its data until it is reset.",
    "Approximately 8.6% of questions have no Tamil translation row, and partial option-translation arrays can render a question bilingually inconsistently.",
  ])
);
add(H(2, "2.13 Future considerations"));
add(
  B([
    "Threading a transaction client through the whole assembly pipeline to remove the pool-exhaustion path.",
    "Replacing the in-process sweeper with an external scheduler if the deployment ever becomes multi-instance.",
    "An administrative content-authoring and publish UI, which would also host publish-time blueprint validation.",
    "Per-viewer demonstration sandboxes instead of one shared demonstration identity.",
    "Migrating unit materials off Google Drive into the platform's own object storage.",
    "Retiring the residual Prisma model once the two legacy profile fields are migrated into the core schema.",
  ])
);

/* ========================= 3. REQUIREMENTS ========================= */
add(PB(), H(1, "3. Requirements"));
add(
  P(
    "Requirement identifiers are permanent. A withdrawn requirement is marked withdrawn; its identifier is never reused. Priority uses MoSCoW (M = must, S = should, C = could). Source values are: DIR (programme directive documents under docs/), IMPL (derived from the implemented and reviewed behaviour of the current baseline), OPS (operational necessity), and SEC (security requirement). A source of IMPL means the requirement was reverse-specified from working, reviewed code, and is confirmed; it does not mean it was assumed."
  )
);
add(NOTE("Baseline note", "This is a reverse-specified baseline. Requirements marked IMPL are confirmed behaviour of the current implementation. Requirements marked DIR that are not yet implemented are listed as such in the Status column of the traceability matrix in Section 31."));

add(H(2, "3.1 Functional requirements"));
add(H(3, "3.1.1 Identity, session and account"));
add(
  T(
    ["ID", "Requirement (shall)", "Pri.", "Src"],
    [
      ["FR-001", "The system shall authenticate users exclusively through Supabase Auth, supporting email/password and Google OAuth, with Google One Tap enabled when a client identifier is configured.", "M", "IMPL"],
      ["FR-002", "On every authenticated request the system shall resolve the verified token to a canonical application user (core.app_user), provisioning that record on first use.", "M", "IMPL"],
      ["FR-003", "The system shall expose the signed-in user's own profile for read and partial update, and shall not expose another user's profile through that path.", "M", "IMPL"],
      ["FR-004", "Account deletion shall be an administrative operation, not a self-service one: the self-deletion route shall remain mounted and answer 403 to an ordinary caller, deletion shall require a recent one-time-password re-authentication, and the deleted user's data shall be erased or anonymised while audit records are retained.", "M", "IMPL"],
      ["FR-005", "The system shall enforce an application session policy independent of the identity provider: an idle timeout (default 30 minutes) and an absolute cap (default 12 hours), both environment-configurable.", "M", "DIR"],
      ["FR-006", "The system shall expose session status and a heartbeat endpoint so the client can display and extend an active session.", "S", "IMPL"],
      ["FR-007", "The system shall expose an explicit logout that terminates the application session record.", "M", "IMPL"],
      ["FR-008", "The system shall provide a demonstration sign-in path and an authenticated endpoint that resets the demonstration account's data.", "S", "IMPL"],
    ],
    [0.7, 6.4, 0.5, 0.6]
  ),
  TBL("Functional requirements — identity, session and account")
);
add(H(3, "3.1.2 Catalog and content"));
add(
  T(
    ["ID", "Requirement (shall)", "Pri.", "Src"],
    [
      ["FR-009", "The system shall expose the examination catalog tree (exam, subject, syllabus node hierarchy) for read without authentication.", "M", "IMPL"],
      ["FR-010", "The system shall expose the published question bank filtered by subject code, returning only published items and never the answer key.", "M", "IMPL"],
      ["FR-011", "The question count endpoint shall apply exactly the same filter semantics as the question list endpoint, such that count equals list length for every filter.", "M", "IMPL"],
      ["FR-012", "The system shall resolve image assets attached to a question to public object-storage URLs, restricted to stem and option roles before submission, unrestricted in post-scoring review.", "M", "IMPL"],
      ["FR-013", "The system shall deliver question text and options bilingually (English with Tamil where a translation row exists), and shall not fail a question that has no translation.", "M", "IMPL"],
      ["FR-014", "The system shall govern question lifecycle transitions (draft, in_review, approved, published, retired) through a state machine that rejects invalid transitions, gated by content:* permissions.", "M", "IMPL"],
      ["FR-015", "The system shall import question content from versioned JSON batches validated against a published schema contract, recording each batch and row.", "M", "IMPL"],
      ["FR-016", "The system shall compute content and skeleton fingerprints for every question and shall detect, quarantine and repoint duplicates rather than serving them.", "M", "DIR"],
      ["FR-017", "The system shall catalogue unit study materials and expose them for in-application preview and download.", "S", "IMPL"],
    ],
    [0.7, 6.4, 0.5, 0.6]
  ),
  TBL("Functional requirements — catalog and content")
);
add(H(3, "3.1.3 Assessment"));
add(
  T(
    ["ID", "Requirement (shall)", "Pri.", "Src"],
    [
      ["FR-018", "The system shall provide a pre-flight availability check that reports whether the published pool can satisfy a proposed configuration before an attempt is created.", "M", "DIR"],
      ["FR-019", "The system shall create and publish a test and start its attempt in a single call for the subject-wise, full-mock, custom and image-practice modes.", "M", "DIR"],
      ["FR-020", "The system shall allow an authenticated user to create a single-scope practice test for themselves, with optional difficulty and image-only filters.", "M", "IMPL"],
      ["FR-021", "The assembler shall select items per blueprint line from the published pool, exclude items already selected by earlier lines of the same paper, exclude items the user has already been served where the pool allows, and record the generation seed.", "M", "DIR"],
      ["FR-022", "On attempt start the system shall persist the served item set, its order, and a server-computed deadline derived from the test duration.", "M", "IMPL"],
      ["FR-023", "The attempt envelope shall carry the server's current time and remaining seconds, and shall never carry answer keys or solutions.", "M", "SEC"],
      ["FR-024", "The system shall accept per-question response saves and batched autosave writes for an in-progress attempt owned by the caller.", "M", "IMPL"],
      ["FR-025", "The system shall support pausing and resuming an attempt, accumulating paused time and adjusting the effective deadline.", "M", "IMPL"],
      ["FR-026", "Submission shall be server-scored under a row lock, shall be idempotent per attempt, and shall persist a scorecard and per-section scores.", "M", "DIR"],
      ["FR-027", "A background sweeper shall close attempts whose server deadline has passed without a client submission, recording the submission reason.", "M", "DIR"],
      ["FR-028", "The system shall reject the creation of a second concurrent attempt for a user while one is active, returning the existing attempt and test identifiers so the client can offer resume or submit.", "M", "IMPL"],
      ["FR-029", "The system shall expose the scorecard with per-section aggregates for a scored attempt owned by the caller.", "M", "IMPL"],
      ["FR-030", "The system shall expose a post-scoring review containing, per served question, the response, the correct answer, the solution and any assets.", "M", "IMPL"],
      ["FR-031", "The system shall expose an item-response-theory ability report for a scored attempt.", "S", "IMPL"],
      ["FR-032", "The system shall expose a cohort comparison for a scored attempt.", "S", "IMPL"],
      ["FR-033", "While a user has an active attempt, the system shall block that user's requests to routes outside the attempt path (attempt lockdown).", "M", "DIR"],
      ["FR-034", "The system shall expose dashboard analytics for the signed-in user: attempt counts, accuracy, subject and topic performance, and trends.", "M", "IMPL"],
      ["FR-035", "The system shall record what a user has been served so that later assemblies can avoid repetition.", "M", "DIR"],
    ],
    [0.7, 6.4, 0.5, 0.6]
  ),
  TBL("Functional requirements — assessment")
);
add(H(3, "3.1.4 Learning support"));
add(
  T(
    ["ID", "Requirement (shall)", "Pri.", "Src"],
    [
      ["FR-036", "The system shall let a user create, read, update and delete their own study plans, plan tasks and study-plan goals.", "S", "IMPL"],
      ["FR-037", "The system shall let a user maintain their own flashcards and record flashcard reviews.", "S", "IMPL"],
      ["FR-038", "The system shall let a user maintain their own revision notes.", "S", "IMPL"],
      ["FR-039", "The system shall record Pomodoro study sessions for the signed-in user.", "C", "IMPL"],
      ["FR-040", "The system shall maintain a per-user error log of incorrectly answered items for targeted revision.", "S", "IMPL"],
      ["FR-041", "The system shall deliver per-user notifications and allow them to be listed and updated.", "S", "IMPL"],
      ["FR-042", "The system shall let a user maintain custom tasks alongside generated plan tasks.", "C", "IMPL"],
      ["FR-043", "The system shall maintain per-user topic mastery records derived from attempt outcomes.", "S", "IMPL"],
      ["FR-044", "The system shall export a result or report to PDF on the client.", "C", "IMPL"],
    ],
    [0.7, 6.4, 0.5, 0.6]
  ),
  TBL("Functional requirements — learning support")
);
add(H(3, "3.1.5 Administration and platform"));
add(
  T(
    ["ID", "Requirement (shall)", "Pri.", "Src"],
    [
      ["FR-045", "The system shall allow a permitted administrator to create, list, revoke and resend user invitations.", "M", "IMPL"],
      ["FR-046", "The system shall allow a permitted administrator to list and read users, narrowed by tenancy in the service layer rather than by permission alone.", "M", "IMPL"],
      ["FR-047", "The system shall allow a permitted administrator to update a user, transition user status, and grant or revoke a role.", "M", "IMPL"],
      ["FR-048", "The system shall allow a permitted administrator to force sign-out and force password reset for a user.", "M", "IMPL"],
      ["FR-049", "The system shall expose platform statistics to holders of admin:stats.", "S", "IMPL"],
      ["FR-050", "The system shall enforce role-based access control from persisted role and permission data, never from hard-coded role checks in route handlers.", "M", "SEC"],
      ["FR-051", "The system shall expose a health endpoint that reports API and database reachability.", "M", "OPS"],
      ["FR-052", "The system shall return errors in a single structured envelope carrying a stable machine-readable code.", "M", "IMPL"],
      ["FR-053", "Retired endpoints shall answer HTTP 410 rather than being removed silently or left routable.", "S", "IMPL"],
    ],
    [0.7, 6.4, 0.5, 0.6]
  ),
  TBL("Functional requirements — administration and platform")
);
add(H(3, "3.1.6 Acceptance criteria and dependencies"));
add(
  P(
    "Acceptance criteria are stated for the requirements whose behaviour is not fully self-evident from the statement. Every criterion below is objectively testable; the test assets that discharge them are named in the traceability matrix (Section 31)."
  )
);
add(
  T(
    ["ID", "Acceptance criteria", "Depends on"],
    [
      ["FR-002", "Given a valid token for a Supabase user with no core.app_user row, when any authenticated route is called, then a canonical user row exists afterwards and the request succeeds; a second call creates no duplicate.", "FR-001"],
      ["FR-005", "Given a session idle beyond the configured timeout, when any authenticated route is called, then the response is 401 with code SESSION_EXPIRED even though the Supabase token is still valid.", "FR-002"],
      ["FR-011", "For every supported subject filter and for no filter, the count endpoint's value equals the length of the list endpoint's array against the same database.", "FR-010"],
      ["FR-012", "Every question returned with hasImage true carries at least one resolvable asset URL; no asset of solution, hint or explanation role appears in any pre-submission payload.", "FR-010, FR-023"],
      ["FR-014", "An attempt to transition a question between two states not permitted by the state machine returns 409 INVALID_STATE_TRANSITION and leaves the row unchanged.", "FR-050"],
      ["FR-018", "For a configuration the pool cannot satisfy, availability reports insufficiency before any attempt row is created, and a subsequent start returns 422 POOL_INSUFFICIENT with requested and available counts.", "FR-021"],
      ["FR-021", "Re-running assembly with the persisted seed against an unchanged pool yields the identical served set and order; no question appears twice within one paper.", "FR-022"],
      ["FR-022", "The persisted server_deadline equals the attempt start time plus the test duration, computed by the database clock, and is not derived from any client-supplied value.", "FR-019"],
      ["FR-023", "No pre-submission payload contains is_correct, explanation text, or a solution-role asset for any served question.", "FR-012"],
      ["FR-026", "Two concurrent submissions of the same attempt produce exactly one scorecard; the second observes the scored state and does not double-score. Section totals equal the sum of their responses' marks computed in exact decimal.", "FR-024"],
      ["FR-027", "An attempt whose deadline passed with no further client activity is closed within one sweeper interval and carries a submission reason of sweeper.", "FR-026"],
      ["FR-028", "Starting a second attempt while one is active returns 409 ACTIVE_ATTEMPT_EXISTS carrying existingAttemptId and existingTestId.", "FR-022"],
      ["FR-033", "While an attempt is active, a request to a non-attempt authenticated route is rejected; requests under the attempt path are unaffected.", "FR-022"],
      ["FR-046", "An institution administrator listing users sees only users of their own institution; a platform administrator sees all.", "FR-050"],
      ["FR-052", "Every non-2xx API response body matches { error: { code, message } }, with code drawn from the catalogue in Section 18.", "—"],
    ],
    [0.7, 6.6, 1.4]
  ),
  TBL("Acceptance criteria for selected functional requirements")
);

add(H(2, "3.2 Non-functional requirements"));
add(
  P(
    "Measurable targets are stated only where a value is confirmed by the implementation or by an approved directive. Every unconfirmed target is marked [TBD] and carries an entry in the TBD register (Section 32); no target has been invented for the sake of completeness."
  )
);
add(
  T(
    ["ID", "Requirement (shall / should)", "Target", "Verification"],
    [
      ["NFR-PERF-001", "The 95th-percentile response time of read endpoints (question list, catalog tree, dashboard) shall be below the stated target under the stated concurrency.", "[TBD] ms at [TBD] concurrent users", "Load test, Section 17.10"],
      ["NFR-PERF-002", "Attempt start (POST /assess/sessions) shall complete within the stated budget for a paper of up to 180 items.", "[TBD] s (observed: 14-18 s before batching; per-round-trip latency to the managed database measured at approximately 250-300 ms)", "Instrumented timing, Section 20"],
      ["NFR-PERF-003", "Response autosave shall not block the candidate's interaction; the client shall flush answers at a fixed interval.", "12 s autosave interval (implemented)", "Frontend unit test"],
      ["NFR-PERF-004", "Scoring of a submitted attempt shall complete within the stated budget.", "[TBD] s", "Load test"],
      ["NFR-SCAL-001", "The API shall be stateless such that additional instances can be added without session affinity.", "Confirmed by design; instance count [TBD]", "Architecture review"],
      ["NFR-SCAL-002", "Total database connections held by the deployment shall remain below the platform pooler cap.", "Project cap 15; db/ pool max 4 per process", "Configuration review, Section 20"],
      ["NFR-SCAL-003", "The system shall support the stated number of concurrent active attempts.", "[TBD] (see RISK-01 before any concurrency claim)", "Load test"],
      ["NFR-AVAIL-001", "The service shall meet the stated availability objective measured monthly.", "[TBD] % (no SLA agreed)", "Uptime monitoring"],
      ["NFR-AVAIL-002", "Planned maintenance shall be announced in advance and performed inside an agreed window.", "[TBD]", "Change process"],
      ["NFR-REL-001", "No submitted attempt shall be lost or double-scored under concurrent submission.", "Zero tolerance; enforced by row lock and idempotency", "Concurrency unit tests"],
      ["NFR-REL-002", "An attempt shall not remain in progress indefinitely after its deadline.", "Closed within one 60 s sweeper interval", "Sweeper unit test"],
      ["NFR-MAINT-001", "The codebase shall compile under TypeScript strict mode with zero errors.", "0 errors, gated in CI", "npm run typecheck"],
      ["NFR-MAINT-002", "Every schema migration shall have a paired verification script asserting its post-conditions.", "100% of migrations", "Repository review"],
      ["NFR-SEC-001", "All traffic shall be served over TLS; the application shall set security headers via Helmet with a content security policy that admits only its own origin and its Supabase project origin.", "TLS 1.2+; CSP implemented", "Header inspection, Section 13"],
      ["NFR-SEC-002", "No secret, credential or service-role key shall appear in source control, in this document, or in any client bundle.", "Zero occurrences", "Secret scanning, review"],
      ["NFR-SEC-003", "Answer keys, solutions and correctness flags shall not be present in any payload served before submission.", "Zero occurrences", "API contract tests"],
      ["NFR-SEC-004", "Every user-owned read path shall filter by the caller's canonical user identifier.", "100% of user-owned routes", "Cross-user isolation tests"],
      ["NFR-SEC-005", "Request bodies shall be size-limited and schema-validated at the HTTP boundary.", "1 MB limit; Zod validation on write routes", "Code review"],
      ["NFR-USE-001", "The candidate interface shall be usable on viewport widths from 360 px upward without horizontal scrolling.", "Verified at three widths; long-text and tall-image cases outstanding (DB-04)", "Layout checks"],
      ["NFR-A11Y-001", "The interface should conform to WCAG 2.1 Level AA.", "[TBD] — no accessibility audit has been performed", "Accessibility audit"],
      ["NFR-COMPAT-001", "The application shall support the current and previous major versions of Chrome, Edge, Safari and Firefox.", "[TBD] — matrix not agreed", "Compatibility testing"],
      ["NFR-PORT-001", "The application shall run on any Node 20 host with a reachable PostgreSQL instance and the documented environment variables.", "Confirmed", "Deployment test"],
      ["NFR-OBS-001", "The API shall emit request timing for every request and shall log unmapped errors with their stack.", "Implemented (requestTiming middleware)", "Log inspection"],
      ["NFR-OBS-002", "The system shall expose a health endpoint suitable for an external uptime check.", "GET /api/health", "Monitoring configuration"],
      ["NFR-OBS-003", "Requests should carry a correlation identifier propagated to logs.", "[TBD] — not implemented", "Section 19"],
      ["NFR-DR-001", "The system shall meet the stated recovery point and recovery time objectives.", "RPO [TBD], RTO [TBD]", "DR test, Section 21"],
      ["NFR-DATA-001", "Attempt, scorecard and audit data shall be retained for the stated period.", "[TBD]", "Retention policy"],
      ["NFR-DATA-002", "Deleting an account shall erase or anonymise that user's data while preserving audit records that must outlive it.", "Implemented (migration 045)", "Deletion test"],
      ["NFR-COMP-001", "The system shall comply with applicable data-protection law for the jurisdictions it operates in.", "[TBD] — jurisdictions not confirmed, see Section 25", "Legal review"],
    ],
    [1.2, 4.6, 2.6, 1.6]
  ),
  TBL("Non-functional requirements")
);

/* ========================= 4. SYSTEM OVERVIEW ========================= */
add(PB(), H(1, "4. System Overview"));
add(H(2, "4.1 System purpose and boundaries"));
add(
  P(
    "The system boundary encloses the React single-page application, the Express API, the domain layer and the PostgreSQL schemas it owns. Supabase Auth, Supabase Storage and Google Drive sit outside the boundary and are reached over HTTPS. The browser is outside the boundary and is treated as untrusted: no value originating there is accepted as authoritative for identity, timing, item selection or marks."
  )
);
add(
  CODE([
    "                              +-------------------------------+",
    "                              |        Supabase Auth          |",
    "                              |  (identity, token issuance)   |",
    "                              +---------------+---------------+",
    "        sign-in / token             ^         | verify token (auth.getUser)",
    "        refresh (browser)           |         v",
    "  +----------------+       +--------+---------------------+       +-------------------+",
    "  |                | HTTPS |                              | SQL   |                   |",
    "  |   Candidate    +------>+   Lumen Academy NEET         +------>+   PostgreSQL      |",
    "  |   browser      |       |   Assessment Tool            |       |   (Supabase)      |",
    "  |   (SPA)        +<------+   SPA + API (single process) +<------+   6 schemas       |",
    "  +-------+--------+       +--------+---------------------+       +-------------------+",
    "          |                         |",
    "          | image URLs              | public object URLs",
    "          v                         v",
    "  +----------------+       +------------------------------+",
    "  | Supabase       |       |  Google Drive                |",
    "  | Storage        |       |  (unit study materials)      |",
    "  +----------------+       +------------------------------+",
    "",
    "  Legend:  ---->  request / data flow      [ ] outside the system boundary",
  ]),
  FIG("System context — actors, the system boundary and external systems")
);
add(H(2, "4.2 Major actors, data sources and destinations"));
add(
  T(
    ["Element", "Classification", "Description"],
    [
      ["Candidate browser", "External actor", "Holds the Supabase session; issues all candidate API traffic with a bearer token."],
      ["Administrative user", "External actor", "Same transport, additional permissions resolved from persisted RBAC data."],
      ["Supabase Auth", "External system", "Sole identity authority. Verifies every bearer token presented to the API."],
      ["Supabase Storage", "Data destination and source", "Holds question image assets; serves public URLs to the browser directly."],
      ["Google Drive", "External data source", "Hosts unit study materials referenced by learn.unit_material."],
      ["Content batch files", "Data source", "Versioned JSON batches with images under db/content/content-batches, validated against the schema contract in schemas/."],
      ["PostgreSQL", "Data destination", "System of record for catalog, core, content, assess and learn data."],
      ["PDF export", "Data destination", "Client-side generated result export delivered to the candidate's device."],
    ],
    [1.2, 1.2, 4]
  ),
  TBL("Data sources, destinations and external actors")
);
add(H(2, "4.3 Internal components"));
add(
  CODE([
    "  Browser (SPA)",
    "  +----------------------------------------------------------------------+",
    "  |  Views: Landing / Dashboard / TestList / SystemCheck / Lobby /        |",
    "  |         TestTaking / Evaluating / AttemptReview / MyResults /         |",
    "  |         Analytics / StudyPlan / Courses / Profile / Admin             |",
    "  |  Services: api.ts (fetch + bearer), sessionApi, analyticsApi,         |",
    "  |            catalogApi, studyPlanApi, supabaseAuth, pdfExport          |",
    "  |  Contexts/hooks: LanguageContext, useIdleSessionGuard                 |",
    "  +---------------------------------+------------------------------------+",
    "                                    | HTTPS /api/*",
    "  API process (Express)             v",
    "  +----------------------------------------------------------------------+",
    "  |  Edge:      helmet (CSP) -> cors -> json(1mb) -> requestTiming        |",
    "  |  Auth:      requireAuth -> session policy -> attemptLockdown          |",
    "  |  AuthZ:     requirePermission / ownership / requireAttemptOwnership   |",
    "  |  Validate:  validate(zod schema)                                      |",
    "  |  Routers:   /me /auth /catalog /content /core /assess /learn /admin   |",
    "  |  Controllers + services   |   Jobs: expirySweeper (60 s)              |",
    "  |  Error:     errorHandler (domain error -> HTTP code catalogue)        |",
    "  +---------------------------------+------------------------------------+",
    "                                    | pg (pool max 4)",
    "  Domain layer  db/                 v",
    "  +----------------------------------------------------------------------+",
    "  |  catalog | core | content | assess | learn   (model/repository/       |",
    "  |                                              service per entity)      |",
    "  |  assess:  generation/assemble, availability, session-shuffle,         |",
    "  |           attempt/attempt-flow, envelope, expiry, scorecard,          |",
    "  |           scoring/{evaluate,rules,aggregate,decimal}, analytics/irt   |",
    "  |  content: lifecycle, asset-resolver, fingerprints, dedup toolkit      |",
    "  |  shared:  pool, errors, normalizeStem, repository-helpers             |",
    "  +---------------------------------+------------------------------------+",
    "                                    v",
    "                        PostgreSQL: catalog, core, content, assess, learn, util",
  ]),
  FIG("High-level architecture — layers from browser to database")
);
add(H(2, "4.4 Major workflows"));
add(
  N([
    "Authentication and session establishment (Section 12).",
    "Content ingestion: batch validation, import, review, publish (Section 11.6).",
    "Test configuration and availability check (Section 11.2).",
    "Attempt lifecycle: start, answer, autosave, pause, resume, submit or expire (Section 11.3).",
    "Scoring and scorecard production (Section 11.4).",
    "Review and analytics (Section 11.5).",
    "User administration and invitation (Section 11.7).",
  ])
);
add(H(2, "4.5 Trust boundaries"));
add(
  T(
    ["Boundary", "Between", "Control"],
    [
      ["TB-1", "Browser and API", "Bearer token verified per request by Supabase; CORS allow-list; CSP; 1 MB body limit; Zod validation"],
      ["TB-2", "API and identity provider", "HTTPS to the Supabase Auth API; publishable key on the request path, service-role key never on it"],
      ["TB-3", "API and database", "TLS connection string held only in environment configuration; least-privilege database role [TBD]"],
      ["TB-4", "Candidate and another candidate's data", "Ownership filter on every user-owned query; transitive ownership resolved once per request for attempt children"],
      ["TB-5", "Institution and institution", "Tenancy narrowing inside administrative services, not by permission alone"],
      ["TB-6", "Pre-submission and post-scoring payloads", "Answer-key suppression in envelope and question read paths; review path deliberately unrestricted"],
      ["TB-7", "Browser and object storage", "Public read URLs only; no credential is exposed to the browser"],
    ],
    [0.7, 2.4, 5]
  ),
  TBL("Trust boundaries and the controls that enforce them")
);

module.exports = c;
