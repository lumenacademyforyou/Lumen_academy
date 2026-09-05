/** Sections 14-24: infrastructure, environments, delivery, testing, resilience, observability, capacity, HA/DR, integrations, configuration, dependencies. */
const { H, P, B, N, T, TBL, FIG, CODE, NOTE, PB } = require("./helpers.cjs");

const c = [];
const add = (...x) => x.forEach((y) => (Array.isArray(y) ? c.push(...y) : c.push(y)));

/* ========================= 14. INFRASTRUCTURE AND DEPLOYMENT ========================= */
add(PB(), H(1, "14. Infrastructure and Deployment"));
add(
  P(
    "The application's own infrastructure requirement is modest and explicit: one Node 20 runtime able to reach the managed data platform over TLS, plus whatever the hosting provider supplies for TLS termination, process supervision and log capture. The hosting platform itself has not been selected, so every row below that depends on that choice is marked as such rather than guessed."
  )
);
add(
  T(
    ["Element", "Specification at this baseline"],
    [
      ["Compute", "One Node 20 process per environment running dist/server.mjs. Memory and CPU allocation [TO BE DEFINED] once a host is chosen; the process is I/O-bound on database round trips, not CPU-bound."],
      ["Hosting platform", "[TO BE DEFINED] (TBD-01). Candidates must provide TLS termination, environment-variable configuration, process restart and log capture."],
      ["Networking", "Inbound HTTPS 443 to the platform edge, forwarded to the process on PORT (default 4000). Outbound HTTPS to the identity, storage and Drive endpoints, and TLS 5432 to the database."],
      ["DNS", "[TO BE DEFINED] — no domain is recorded in the repository."],
      ["Load balancer", "None at this baseline (single instance). Required before the application tier is made redundant."],
      ["CDN", "None. Content-hashed assets are served with a one-year immutable cache header directly by the process, which makes a CDN a straightforward later addition."],
      ["Firewall / WAF", "[TO BE DEFINED]. No application-level rate limiting or WAF exists today."],
      ["Containers", "None declared. There is no Dockerfile in the repository; the artefact is a bundled JavaScript file plus static assets."],
      ["Orchestration", "None."],
      ["Object storage", "Supabase Storage bucket named by OBJECT_STORAGE_BUCKET. Public read; writes performed by operator scripts with elevated credentials."],
      ["Database infrastructure", "Managed PostgreSQL with a session-mode pooler; project-wide cap of 15 sessions."],
      ["Availability zones and regions", "Managed by the data platform; the application is single-region. Region selection [TBD]."],
      ["Scaling", "Vertical for the process; horizontal blocked on the connection-budget work in 5.11."],
      ["Infrastructure as code", "None. Environment creation is manual ([TBD], TBD-12)."],
    ],
    [1.1, 4.2]
  ),
  TBL("Infrastructure elements")
);
add(
  CODE([
    "  Deploy pipeline (target state)",
    "  ------------------------------",
    "   git push / merge",
    "        |",
    "        v",
    "   CI: prisma generate -> typecheck -> unit -> frontend unit -> build -> e2e",
    "        |",
    "        v",
    "   artefact: dist/ (SPA) + dist/server.mjs (API bundle)",
    "        |",
    "        +--> [explicit, separate step] apply db/migrations/*.sql",
    "        |         run-migration.mjs <name>  (migration + verify assertions)",
    "        v",
    "   deploy artefact to host [TBD]  ->  NODE_ENV=production node dist/server.mjs",
    "        |",
    "        v",
    "   smoke: GET /api/health, GET / (index.html), sign-in journey",
  ]),
  FIG("Deployment pipeline and the separate schema-migration step")
);
add(NOTE("Rule", "Schema migrations are applied as an explicit, separately authorised deployment step against the target database. They are never run implicitly at application start, and Prisma's migration commands are never used for the domain schema."));

/* ========================= 15. ENVIRONMENT STRATEGY ========================= */
add(PB(), H(1, "15. Environment Strategy"));
add(
  P(
    "Two environments exist in practice today: a developer's local environment and whatever database it points at. The remaining environments in the table below are specified as the target state and are marked accordingly, because publishing an environment matrix that implies environments exist when they do not would be a material misstatement."
  )
);
add(
  T(
    ["Environment", "Status", "Purpose", "Database", "Access and secrets", "Deployment", "Data policy"],
    [
      ["Local", "Exists", "Development and debugging; Vite dev server on 5173 and API on 4000", "Developer-configured DATABASE_URL, commonly a shared Supabase project", "Untracked .env from .env.example", "npm run dev and npm run dev:api", "Must not contain unmasked production personal data"],
      ["Development (shared)", "[TO BE DEFINED]", "Integration point for the team", "[TBD]", "[TBD]", "[TBD]", "[TBD]"],
      ["Test / CI", "Exists (partial)", "Automated verification on pull request", "Optional: end-to-end tests run only when the DATABASE_URL secret is configured, otherwise the step warns and skips", "GitHub Actions secrets", "Ephemeral runner", "No production data"],
      ["QA", "[TO BE DEFINED]", "Manual and exploratory testing", "[TBD]", "[TBD]", "[TBD]", "[TBD]"],
      ["Staging", "[TO BE DEFINED]", "Pre-production rehearsal, including migration rehearsal", "[TBD] — should mirror production schema exactly", "[TBD]", "[TBD]", "Masked or synthetic data only"],
      ["Production", "[TO BE DEFINED]", "Live service", "Managed PostgreSQL with backups", "Platform secret storage; service-role key restricted", "NODE_ENV=production node dist/server.mjs", "Live personal data; retention per Section 10"],
    ],
    [1, 0.9, 1.5, 1.6, 1.4, 1.2, 1.5]
  ),
  TBL("Environment matrix")
);
add(
  T(
    ["Configuration key", "Local", "CI", "Production"],
    [
      ["NODE_ENV", "development", "test / production for e2e", "production (mandatory — the SPA is not served without it)"],
      ["PORT", "4000", "4000", "Platform-assigned or 4000"],
      ["CORS_ORIGINS", "http://localhost:5173", "As required by the suite", "The production origin only"],
      ["DATABASE_URL", "Developer's project", "Repository secret (optional)", "Production database, pooled"],
      ["SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY", "Developer's project", "Repository secret", "Production project"],
      ["SUPABASE_SERVICE_ROLE_KEY", "Only if running admin scripts", "Repository secret", "Restricted; server-side only"],
      ["OBJECT_STORAGE_BUCKET", "Developer's bucket", "As required", "Production bucket"],
      ["SESSION_IDLE_TIMEOUT_MINUTES / SESSION_ABSOLUTE_HOURS", "30 / 12", "30 / 12", "Policy decision — currently the defaults"],
      ["VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY", "Developer's project", "As required", "Production project (public by design)"],
      ["VITE_API_URL", "Defaults to http://localhost:4000/api", "As required", "Same-origin /api"],
      ["VITE_GOOGLE_CLIENT_ID", "Optional", "Optional", "Required only if One Tap is enabled"],
    ],
    [1.6, 1.3, 1.3, 2]
  ),
  TBL("Configuration by environment")
);

/* ========================= 16. CI/CD ========================= */
add(PB(), H(1, "16. CI/CD and Release Management"));
add(H(2, "16.1 Repository and branching"));
add(
  B([
    "One repository holds the frontend, backend, domain layer, migrations, content batches, scripts, tests and documentation.",
    "Feature branches are created from the product branch NEET-assessment-tool-CSK, and pull requests target that branch per the contributing guidance.",
    "Every pull request requires a passing pipeline plus review. Direct pushes to a shared branch are not the intended path.",
    "A schema change must arrive with its paired verification script in the same pull request.",
  ])
);
add(
  NOTE(
    "Discrepancy to resolve",
    "The CI workflow triggers on pull requests targeting main, while the contributing guidance directs pull requests at NEET-assessment-tool-CSK. As written, a pull request that follows the guidance does not run the pipeline. Recorded as RISK-09 and TBD-13; resolve by widening the workflow trigger or changing the target branch, not by ignoring one of the two."
  )
);

add(H(2, "16.2 Pipeline"));
add(
  CODE([
    "  on: pull_request -> ubuntu-latest",
    "",
    "   1. checkout",
    "   2. setup-node 20 (npm cache)",
    "   3. npm ci                         <- lockfile-pinned install",
    "   4. npx prisma generate            <- typed client only; NOT a migration",
    "   5. npm run typecheck              <- tsc --noEmit, must be clean",
    "   6. npm run test:unit              <- node:test over backend/ and db/, then vitest",
    "   7. npm run test:frontend          <- re-run named separately for clear failure attribution",
    "   8. npm run build                  <- vite build + esbuild ESM bundle",
    "   9. playwright install chromium    <- only when DATABASE_URL secret is present",
    "  10. npm run test:e2e               <- skipped with an explicit ::warning:: if no DATABASE_URL",
    "",
    "  Separate scheduled workflow: reset-demo-account (Mondays 03:00 UTC,",
    "  plus manual dispatch) -> resets and reseeds the shared demo account only.",
  ]),
  FIG("CI/CD pipeline as implemented")
);
add(
  T(
    ["Stage", "Gate", "Failure behaviour"],
    [
      ["Install", "npm ci against the lockfile", "Hard fail"],
      ["Client generation", "prisma generate", "Hard fail"],
      ["Static analysis", "TypeScript strict typecheck", "Hard fail. No ESLint configuration exists in the repository ([TBD], TBD-14)"],
      ["Unit tests", "backend and domain node:test suites, then the frontend Vitest suite", "Hard fail"],
      ["Build", "Vite build and esbuild bundle", "Hard fail"],
      ["End-to-end", "Playwright against the built production server", "Skipped with a visible warning when the database secret is absent; hard fail otherwise"],
      ["Security scanning", "None configured", "Not gated ([TBD], TBD-10)"],
      ["Deployment", "Not automated", "Manual ([TBD], TBD-01)"],
    ],
    [1.2, 2.6, 2.6]
  ),
  TBL("Pipeline stages and gates")
);

add(H(2, "16.3 Release management"));
add(
  T(
    ["Aspect", "Specification"],
    [
      ["Versioning", "package.json carries 0.0.0; there is no release tagging scheme in use. Adopting semantic versioning with annotated tags is [TO BE DEFINED] (TBD-15)."],
      ["Artefact", "Built at deploy time from the source revision. No artefact registry is used."],
      ["Approval gates", "Pull-request review. No separate production approval step exists because deployment is not automated."],
      ["Release notes", "Not produced ([TBD]). The phase trackers under docs/ currently serve as the change record."],
      ["Rollback", "Redeploy the previous revision. A schema migration is forward-only, so a rollback that crosses a migration requires either the corresponding reversal script (three exist) or a forward corrective migration. This asymmetry must be considered before every release that carries a migration."],
      ["Feature flags", "None implemented. Behaviour is switched by environment variables where it is switchable at all ([TBD], TBD-16)."],
      ["Database and code ordering", "Migrations are applied before the code that depends on them, and must be written to be compatible with the previous code revision for the duration of the deployment."],
    ],
    [1, 4.2]
  ),
  TBL("Release management")
);

/* ========================= 17. TESTING STRATEGY ========================= */
add(PB(), H(1, "17. Testing Strategy"));
add(
  P(
    "The strategy is deliberately weighted toward fast, deterministic tests of the rules that carry risk — scoring arithmetic, assembly, ownership isolation, expiry, deduplication — with a thin end-to-end layer over the journeys that must never break. There are 37 test files in the repository at this baseline. Tests that require a live database state that requirement explicitly and skip with a stated reason rather than passing silently when it is unavailable."
  )
);
add(
  T(
    ["Type", "Objective", "Scope", "Tools", "Environment", "Entry criteria", "Exit criteria", "Owner", "Automated"],
    [
      ["Unit (domain)", "Prove the rules in isolation", "Scoring evaluation, partial credit, decimal arithmetic, aggregation, assembly, availability, shuffle, expiry, dedup, IRT model, test codes", "node:test with tsx", "CI and local", "Code compiles", "All pass; new rules have new cases", "Backend / domain", "Yes"],
      ["Unit (frontend)", "Prove component behaviour", "Lobby, test taking, results views; idle session guard", "Vitest, Testing Library, jsdom", "CI and local", "Build succeeds", "All pass", "Frontend", "Yes"],
      ["Integration", "Prove a controller against a real database", "Question controller count-equals-list; session service", "node:test with a live DATABASE_URL", "Local, CI when configured", "Database reachable", "All pass, or explicitly skipped with a stated reason", "Backend", "Yes"],
      ["API contract", "Prove the HTTP contract, including negative cases", "Question endpoints, retired endpoints answering 410, invalid subject rejected with 400", "Playwright request context", "CI when configured", "Server built and running", "All pass", "QA", "Yes"],
      ["End-to-end", "Prove the candidate journey", "Landing, sign-in, demo account, dashboard; layout checks", "Playwright (Chromium)", "CI when configured, local", "Production build served", "All pass", "QA", "Yes"],
      ["Concurrency", "Prove behaviour under simultaneous access", "Concurrent generation, shared-pool behaviour, cross-user isolation, anti-repeat exposure", "node:test", "Local and CI", "Live database", "No isolation breach, no double-scoring", "Backend", "Yes"],
      ["Regression", "Prevent recurrence of fixed defects", "A case per fixed defect, named for it", "As appropriate to the layer", "CI", "Defect fixed", "Case exists and passes", "Whoever fixed it", "Yes"],
      ["Performance and load", "Establish real capacity figures", "Attempt start, submission, question reads", "[TO BE DEFINED]", "[TBD]", "RISK-01 closed", "Targets in Section 20 replaced with measured values", "Backend", "No — not implemented"],
      ["Stress and soak", "Find the breaking point and leaks", "Connection pool, sweeper, memory over time", "[TO BE DEFINED]", "[TBD]", "Load harness exists", "Documented limits", "Backend", "No"],
      ["Security", "Verify the controls in Section 13", "Authorisation, ownership, answer-key exposure, headers, dependencies", "Manual review; dependency scanning [TBD]", "[TBD]", "Threat model current", "No high findings open", "Security", "Partly"],
      ["Compatibility", "Confirm the supported browser matrix", "Browsers and viewports", "[TO BE DEFINED]", "[TBD]", "Matrix agreed", "Matrix passes", "Frontend", "No"],
      ["Accessibility", "Confirm WCAG 2.1 AA conformance", "All candidate-facing screens", "[TO BE DEFINED]", "[TBD]", "Screens stable", "No Level A or AA violations", "Frontend", "No"],
      ["User acceptance", "Confirm the product meets the need", "The documented happy path", "Manual against docs/HAPPY_PATH.md", "Staging [TBD]", "Release candidate", "Sign-off by the product owner", "Product", "No"],
    ],
    [0.9, 1.3, 2.2, 1.5, 1, 1, 1.4, 0.9, 0.7]
  ),
  TBL("Testing types, ownership and criteria")
);
add(
  NOTE(
    "Known gaps",
    "Performance, load, stress, compatibility and accessibility testing are not implemented. They are stated here as required activities with [TBD] tooling rather than omitted, and each carries a TBD-register entry."
  )
);
add(H(2, "17.1 Traceability chain"));
add(
  P(
    "Requirement to test-case to result to defect to acceptance is maintained as follows: the master matrix in Section 31 maps each requirement to its test asset; the pipeline records the result per commit; a failure that is not a test defect becomes an entry in the defect backlog with its own identifier; and a requirement is accepted only when its acceptance criteria (Section 3.1.6) are demonstrably met with no open critical defect against it (Section 30)."
  )
);

/* ========================= 18. ERROR HANDLING AND RESILIENCE ========================= */
add(PB(), H(1, "18. Error Handling and Resilience"));
add(H(2, "18.1 Error categories"));
add(
  B([
    "Validation errors — a request that fails a schema or a database input constraint. Client-correctable; returned as 400.",
    "Authentication and authorisation errors — missing, invalid or lapsed credentials, or insufficient rights. Returned as 401, 403 or, where disclosure matters, 404.",
    "Domain state errors — the request is well-formed but the domain forbids it now (wrong attempt state, unpublished test, closed window, active attempt). Returned as 409.",
    "Domain data errors — the request is well-formed but the data cannot satisfy it (insufficient pool, invalid paper, question not in attempt, unparseable numeric answer). Returned as 422.",
    "Retired-endpoint errors — the operation no longer exists. Returned as 410.",
    "Infrastructure and unexpected errors — anything unmapped. Returned as 500 with a generic message while the stack is logged server-side.",
  ])
);

add(H(2, "18.2 Error code catalogue"));
add(
  T(
    ["Code", "HTTP", "Meaning", "Raised by / additional fields"],
    [
      ["INVALID_INPUT", "400", "Malformed or missing input that reached the database layer", "PostgreSQL SQLSTATE 23502, 22P02, 22007, 22008"],
      ["UNAUTHORIZED", "401", "No bearer token, or the identity provider rejected it", "requireAuth"],
      ["SESSION_EXPIRED", "401", "The application's idle or absolute session policy has lapsed", "session policy check; the provider's own token may still be valid"],
      ["FORBIDDEN", "403", "The caller lacks the required permission", "requirePermission"],
      ["NOT_FOUND", "404", "No such resource, or the resource is not the caller's", "Repositories and ownership checks; deliberately used instead of 403 for ownership"],
      ["GONE", "410", "Retired endpoint", "Retired stubs for submit-attempt and the AI routes"],
      ["DUPLICATE_KEY", "409", "Unique constraint violated", "Typed duplicate error and PostgreSQL 23505"],
      ["FK_VIOLATION", "409", "Referenced row does not exist", "Typed foreign-key error"],
      ["INVALID_STATE_TRANSITION", "409", "The entity cannot move between these states", "Attempt and content lifecycle state machines"],
      ["CONCURRENT_WRITE", "409", "The row changed underneath the write", "Typed concurrency error"],
      ["TEST_NOT_PUBLISHED", "409", "The test is not available to attempt", "Attempt start"],
      ["TEST_WINDOW_CLOSED", "409", "The assignment window has closed", "Attempt start"],
      ["IDEMPOTENCY_CONFLICT", "409", "The same key was reused with different content", "Idempotency handling"],
      ["REVIEW_NOT_AVAILABLE", "409", "The attempt is not yet scored", "Review and ability-report handlers"],
      ["ACTIVE_ATTEMPT_EXISTS", "409", "The candidate already has an active attempt", "Adds existingAttemptId and existingTestId so the client can offer resume or submit"],
      ["QUESTION_NOT_IN_ATTEMPT", "422", "The question was not served in this attempt", "Response save"],
      ["INVALID_NUMERIC_ANSWER", "422", "The supplied numeric answer cannot be interpreted", "Response save"],
      ["RESPONSE_OPTION_MISMATCH", "422", "The selected option does not belong to the served question", "Database trigger raising SQLSTATE LM001"],
      ["POOL_INSUFFICIENT", "422", "The published pool cannot satisfy a blueprint line", "Adds blueprintId, testSectionId, requested, available"],
      ["PAPER_INVALID", "422", "The composed paper failed validation", "Adds itemErrors"],
      ["SCORING_RULE_MISSING", "500", "Marking-scheme data is absent — a data defect, not a client error", "Logged loudly before responding"],
      ["INTERNAL_ERROR", "500", "Unmapped failure", "Generic message to the client; stack logged server-side"],
    ],
    [1.5, 0.5, 2.4, 2.8]
  ),
  TBL("Error code catalogue")
);

add(H(2, "18.3 Resilience patterns"));
add(
  T(
    ["Pattern", "Status", "Specification"],
    [
      ["Timeout", "Partial", "No explicit server-side request timeout is configured. The database driver applies its own connection idle timeout of 10 seconds. Request timeouts are [TBD]."],
      ["Retry", "By exception", "The application does not retry outbound calls automatically. Operational scripts retry where documented. The client does not retry a failed API call."],
      ["Exponential backoff", "Not implemented", "Applies to the git push guidance for operators; not implemented in application code."],
      ["Circuit breaker", "Not implemented", "An identity-provider outage fails every authenticated request individually; no breaker short-circuits the calls ([TBD], TBD-17)."],
      ["Fallback", "By design, none for identity", "There is deliberately no local authentication fallback. Asset resolution failure degrades to a question without an image, which is an acceptable partial fallback."],
      ["Graceful degradation", "Implemented", "Public read paths (question bank, catalog, health) continue to serve when the identity provider is unavailable."],
      ["Transaction rollback", "Implemented", "Attempt start and submission are single transactions; any failure rolls back the whole unit."],
      ["Dead-letter queue", "Not applicable", "There is no asynchronous messaging in this baseline."],
      ["Duplicate handling", "Implemented", "Response saves are upserts keyed by (attempt, served question); submission is idempotent per attempt."],
      ["Idempotency", "Implemented for submission", "Row lock plus state machine. The idempotency-key table exists for future endpoints."],
      ["Partial failure", "Implemented", "Assembly failing one blueprint line fails the whole attempt creation rather than serving a short paper — a partial paper would be an unfair assessment."],
      ["Recovery", "Implemented", "Attempt state lives in the database, so a process restart loses no attempt; the sweeper closes anything the client abandoned."],
    ],
    [1.2, 1, 4]
  ),
  TBL("Resilience patterns")
);
add(
  CODE([
    "  error raised",
    "       |",
    "       v",
    "  AppError?  --yes--> respond with its own status + code",
    "       |no",
    "       v",
    "  structured domain error?  --yes--> respond 422/409 + code + named fields",
    "   (PoolInsufficient, PaperInvalid,          (blueprintId, itemErrors,",
    "    ActiveAttemptExists)                       existingAttemptId, ...)",
    "       |no",
    "       v",
    "  ScoringRuleMissing?  --yes--> log loudly, respond 500 SCORING_RULE_MISSING",
    "       |no",
    "       v",
    "  typed db/ error?  --yes--> table lookup -> 404 / 409 / 422 + code",
    "       |no",
    "       v",
    "  PostgreSQL SQLSTATE mapped?  --yes--> LM001 -> 422 RESPONSE_OPTION_MISMATCH",
    "       |no                                23505 -> 409 DUPLICATE_KEY",
    "       v",
    "  SQLSTATE in client-error set?  --yes--> 400 INVALID_INPUT",
    "       |no",
    "       v",
    "  log stack; respond 500 INTERNAL_ERROR with a generic message",
  ]),
  FIG("Error-handling decision flow")
);

/* ========================= 19. OBSERVABILITY ========================= */
add(PB(), H(1, "19. Logging, Monitoring and Observability"));
add(
  NOTE(
    "Current state",
    "Observability is the least developed area of this system. What exists is request timing, error logging to standard error, sweeper activity logging, and a health endpoint. Everything else in this section is a requirement, not a description — each unimplemented item is marked and carries a TBD-register entry."
  )
);
add(
  T(
    ["Signal", "Requirement", "Status at baseline"],
    [
      ["Application logs", "Structured, levelled application logs with a configurable level", "LOG_LEVEL is validated and available but logging is unstructured console output"],
      ["Access logs", "One line per request with method, path, status and duration", "Request timing middleware exists; the platform edge would supply the rest"],
      ["Error logs", "Stack and context for every unmapped error", "Implemented (console.error before the 500 response)"],
      ["Audit logs", "Administrative and content-lifecycle actions with actor, action, target and time", "Partial: content review and question identity changes are persisted; administrative actions are not"],
      ["Security logs", "Authentication failures, permission denials, forced account actions", "Not implemented"],
      ["Infrastructure metrics", "CPU, memory, disk and network per instance", "Not implemented — platform-dependent"],
      ["Request metrics", "Request rate, latency distribution, error rate by route", "Not implemented"],
      ["Database metrics", "Connection pool utilisation, query latency, slow queries, deadlocks", "Not implemented; pool utilisation matters most given the 15-session cap"],
      ["Domain metrics", "Attempts started and submitted, sweeper closures, pool-insufficiency rate, assembly duration, scoring failures", "Not implemented"],
      ["Distributed tracing", "Trace across the request path", "Not applicable in a single process, but request correlation is still required"],
      ["Correlation identifiers", "A request identifier generated at the edge, attached to every log line and returned to the client", "Not implemented (NFR-OBS-003)"],
      ["Dashboards", "System health, application health, business-critical metrics", "Not implemented"],
      ["Alerting", "Conditions, severity, escalation and notification channels", "Not implemented"],
    ],
    [1.3, 2.6, 2.4]
  ),
  TBL("Observability requirements and current state")
);
add(H(2, "19.1 Alerting specification (target)"));
add(
  T(
    ["Alert", "Condition", "Severity", "First responder", "Channel"],
    [
      ["Service down", "Health endpoint failing for 2 consecutive checks", "SEV-1", "[TBD]", "[TBD]"],
      ["Database unreachable", "Health endpoint reports database failure", "SEV-1", "[TBD]", "[TBD]"],
      ["Connection pool near cap", "Sessions in use above 80% of the project cap", "SEV-2", "[TBD]", "[TBD]"],
      ["Error rate elevated", "5xx rate above [TBD]% over 5 minutes", "SEV-2", "[TBD]", "[TBD]"],
      ["Latency elevated", "p95 above [TBD] ms over 10 minutes", "SEV-3", "[TBD]", "[TBD]"],
      ["Sweeper silent", "No sweeper cycle observed for 10 minutes", "SEV-2", "[TBD]", "[TBD]"],
      ["Scoring rule missing", "Any occurrence", "SEV-2", "[TBD]", "[TBD]"],
      ["Pool insufficiency spike", "Rate above [TBD] per hour", "SEV-3", "Content administration", "[TBD]"],
      ["Certificate expiring", "Under 14 days remaining", "SEV-3", "[TBD]", "[TBD]"],
    ],
    [1.3, 2.2, 0.8, 1.3, 0.9]
  ),
  TBL("Target alerting specification")
);

/* ========================= 20. PERFORMANCE AND CAPACITY ========================= */
add(PB(), H(1, "20. Performance and Capacity"));
add(
  P(
    "No load testing has been performed, so this section states what is known from direct measurement and what remains unmeasured. Nothing here is extrapolated. The single most useful measured fact is that round-trip latency to the managed database from the development environment is approximately 250 to 300 milliseconds regardless of query complexity, which makes round-trip count — not query cost — the dominant performance variable in this system."
  )
);
add(
  T(
    ["Dimension", "Known value", "Target"],
    [
      ["Registered users", "Not recorded", "[TBD]"],
      ["Concurrent users", "Not measured", "[TBD]"],
      ["Concurrent active attempts", "Not measured; see RISK-01 before claiming any figure", "[TBD]"],
      ["Requests per second", "Not measured", "[TBD]"],
      ["Peak load profile", "Expected to be spiky around scheduled practice sessions", "[TBD]"],
      ["Database round-trip latency", "Approximately 250-300 ms (development environment, remote managed instance)", "Reduce by co-locating the application with the database"],
      ["Attempt start duration", "Was 14-18 s before per-question inserts were batched into one statement; not re-measured since", "[TBD]"],
      ["Autosave interval", "12 s (client)", "Retain unless measurement justifies a change"],
      ["Sweeper interval", "60 s", "Retain"],
      ["Published question bank", "1,399 published, 1 retired, 0 draft (1,400 rows) at the last recorded inventory", "Grows with each import batch"],
      ["Question assets", "15 asset rows, all with a resolvable storage object", "Grows with image-bearing content"],
      ["Database growth", "Dominated by attempt, attempt_question and attempt_response rows: roughly (items per paper) rows per attempt in each of two tables", "Model once attempt volume is known"],
      ["Storage requirements", "Not modelled", "[TBD]"],
      ["Bandwidth", "Not modelled", "[TBD]"],
      ["CPU and memory", "Not measured; the process is I/O-bound", "[TBD]"],
      ["Connection budget", "Project cap 15; domain pool max 4 per process plus the legacy client's pool", "Stay below the cap with headroom for migrations and scripts"],
      ["Scaling threshold", "Undefined — no metric is collected that could trigger it", "Define once metrics exist"],
    ],
    [1.4, 3.4, 1.4]
  ),
  TBL("Performance and capacity: known values and targets")
);
add(
  NOTE(
    "Method note",
    "The dominance of round-trip latency means the correct optimisation is to reduce the number of round trips per operation (as was done for attempt start) and to place the application close to the database, before considering caching or scaling out."
  )
);

/* ========================= 21. HA AND DR ========================= */
add(PB(), H(1, "21. High Availability and Disaster Recovery"));
add(
  T(
    ["Aspect", "Specification"],
    [
      ["Availability objective", "[TO BE DEFINED]. No service-level objective has been agreed, so none is claimed."],
      ["Application redundancy", "None at this baseline: a single process is a single point of failure. Adding instances requires the connection-budget work in 5.11 and a load balancer."],
      ["Database redundancy", "Provided by the managed platform; the specific replication and failover characteristics of the chosen plan are [TBD]."],
      ["Failover", "Platform-managed for the database. No application-tier failover exists."],
      ["Backup", "Platform-managed. Frequency, retention and point-in-time recovery window are [TO BE DEFINED] (TBD-02)."],
      ["Restore", "Platform restore procedure. The application needs no coordination beyond a restart, because it holds no state outside the database."],
      ["Recovery point objective (RPO)", "[TO BE DEFINED]. Cannot be asserted until backup configuration is confirmed."],
      ["Recovery time objective (RTO)", "[TO BE DEFINED]."],
      ["Disaster-recovery testing", "Never performed (RISK-04). An untested restore is not a recovery capability; a rehearsal into a scratch project is the first action required."],
      ["Business continuity", "[TO BE DEFINED] — no continuity plan exists for a prolonged platform outage."],
      ["Data loss scenarios", "In-flight responses since the last autosave flush are lost on a client failure; committed responses are not. No committed data is lost by an application restart."],
    ],
    [1.2, 4.2]
  ),
  TBL("High availability and disaster recovery")
);
add(
  CODE([
    "  Disaster-recovery architecture (target)",
    "  ---------------------------------------",
    "   Primary region [TBD]                       Recovery",
    "   +----------------------------+             +----------------------------+",
    "   | app process(es)            |             | redeploy artefact from     |",
    "   | (stateless - rebuildable)  |  ----->     | source revision            |",
    "   +----------------------------+             +----------------------------+",
    "   +----------------------------+             +----------------------------+",
    "   | managed PostgreSQL         |  ----->     | restore from platform      |",
    "   | + automated backups [TBD]  |   RPO[TBD]  | backup / PITR              |",
    "   +----------------------------+             +----------------------------+",
    "   +----------------------------+             +----------------------------+",
    "   | object storage bucket      |  ----->     | bucket restore [TBD] -      |",
    "   | (question assets)          |             | assets are re-uploadable    |",
    "   +----------------------------+             | from content batches        |",
    "                                              +----------------------------+",
    "",
    "   Recovery order: 1. database  2. object storage  3. application",
    "   Verification:   verify scripts per migration, then GET /api/health,",
    "                   then a scored attempt end to end.",
  ]),
  FIG("Disaster-recovery architecture and recovery order")
);
add(
  NOTE(
    "Recoverability strength",
    "Question content is reconstructible from the versioned import batches held in the repository, and image assets can be re-uploaded from those batches. Candidate-generated data — attempts, responses, scorecards, learning artefacts — exists only in the database and depends entirely on the platform's backups."
  )
);

/* ========================= 22. THIRD-PARTY INTEGRATIONS ========================= */
add(PB(), H(1, "22. Third-Party Integrations"));

function integration(id, name, rows) {
  add(H(2, id + " " + name));
  add(T(["Attribute", "Specification"], rows, [1, 4.2]), TBL("Integration — " + name));
}

integration("22.1", "Supabase Auth", [
  ["Purpose", "Sole identity provider: sign-in, token issuance and refresh, token verification, and administrative account operations."],
  ["Provider", "Supabase (GoTrue)."],
  ["Protocol", "HTTPS REST via @supabase/supabase-js. The browser uses the publishable key; the server uses the publishable key for verification and the service-role key for administrative operations."],
  ["Authentication", "Publishable (anon) key plus the caller's bearer token for verification; service-role key for admin operations, server-side only."],
  ["Data exchanged", "Credentials and OAuth assertions from the browser; access tokens; user subject, email, phone and user metadata returned to the API."],
  ["Request and response", "auth.getUser(token) on every authenticated request; admin endpoints for forced sign-out and password reset."],
  ["Rate limits", "Provider-defined; not documented in the repository ([TBD])."],
  ["Timeout and retry", "SDK defaults. No application-level timeout or retry is configured."],
  ["Failure handling", "Fails closed: 401 for the caller. Public read routes continue to serve."],
  ["Dependency risk", "Highest in the system: an outage is a total authentication outage with no fallback, by design."],
  ["Monitoring", "[TBD] — no authentication error-rate metric or provider status subscription."],
  ["Versioning and contract change", "SDK major versions and provider API changes are absorbed at upgrade time; the key naming has already changed once (anon to publishable)."],
]);

integration("22.2", "Supabase Storage", [
  ["Purpose", "Store and serve question image assets."],
  ["Provider", "Supabase Storage."],
  ["Protocol", "HTTPS. Public object URLs resolved by the asset resolver from the bucket named in OBJECT_STORAGE_BUCKET."],
  ["Authentication", "Public read for served assets; writes performed by operator scripts with elevated credentials."],
  ["Data exchanged", "Image files and their public URLs."],
  ["Failure handling", "A question renders without its image; nothing fails hard. The resolver throws immediately if the bucket variable is unset, which is a configuration error rather than a runtime outage."],
  ["Consistency", "A verification script reconciles asset rows against storage objects and reports orphans and missing objects in both directions."],
  ["Rate limits and timeouts", "Provider-defined ([TBD])."],
  ["Dependency risk", "Moderate: degrades image-bearing questions, does not stop assessment."],
  ["Monitoring", "[TBD]."],
]);

integration("22.3", "Google Drive (unit study materials)", [
  ["Purpose", "Host the unit study material files referenced by learn.unit_material."],
  ["Provider", "Google Drive, under an account outside this system."],
  ["Protocol", "HTTPS. In-application preview uses an iframe; download is a server-issued redirect to the Drive URL."],
  ["Authentication", "None — the design depends on the files being shared as 'anyone with the link, viewer'."],
  ["Failure handling", "The client checks the content type before saving a downloaded blob, so a sign-in page is never saved as a file with a misleading name, and the failure message is a single clear sentence. Cross-origin iframe content cannot be inspected, so the viewer shows a static hint instead."],
  ["Current status", "All catalogued material links were verified as not publicly shared: every one redirects to a Google sign-in wall or returns 401 or 403 to an unauthenticated client. The application code is correct; the sharing configuration is not (RISK-05 / DB-06)."],
  ["Dependency risk", "High for the materials feature specifically, and it cannot be resolved in code — it requires whoever owns the Drive account to change the sharing settings, after which the access-check script re-verifies."],
  ["Monitoring", "A repository script performs the access check on demand; it is not scheduled ([TBD])."],
]);

integration("22.4", "Google Identity Services (optional)", [
  ["Purpose", "Google OAuth sign-in and, when configured, One Tap automatic sign-in on the landing view."],
  ["Provider", "Google Cloud OAuth 2.0 client (Web application type)."],
  ["Authentication", "Client identifier supplied through VITE_GOOGLE_CLIENT_ID; the same identifier must also be registered in the identity provider's Google provider configuration for identifier-token sign-in."],
  ["Failure handling", "If the variable is absent, One Tap is skipped entirely and the standard OAuth redirect button remains available."],
  ["Dependency risk", "Low: an optional convenience path over an existing one."],
  ["Contract change", "Origin allow-listing must be maintained in the Google console for every deployed origin."],
]);

/* ========================= 23. CONFIGURATION MANAGEMENT ========================= */
add(PB(), H(1, "23. Configuration Management"));
add(
  P(
    "Configuration is supplied exclusively through environment variables and validated at process start by Zod schemas — one for the API and one for the domain layer. A missing or malformed required variable prints every offending key and exits rather than starting in a degraded state. The template file .env.example is kept in step with those schemas and with the client's own prefixed variables; it is the only configuration file in version control and it contains no real values."
  )
);
add(
  T(
    ["Variable", "Required", "Consumed by", "Default", "Notes"],
    [
      ["DATABASE_URL", "Yes", "API and domain layer", "—", "PostgreSQL connection string; TLS is enabled automatically for the managed host"],
      ["SUPABASE_URL", "Yes", "API and domain layer", "—", "Also determines the origin admitted by the content security policy"],
      ["SUPABASE_PUBLISHABLE_KEY", "Yes", "API", "—", "Public by design; used for token verification"],
      ["SUPABASE_SERVICE_ROLE_KEY", "No (yes for admin paths)", "API, operator scripts", "—", "Elevated: bypasses row-level security and reaches the admin API. Never exposed to the client"],
      ["OBJECT_STORAGE_BUCKET", "Schema-optional, runtime-required", "Domain layer", "—", "The asset resolver throws immediately if unset; every image-bearing question depends on it"],
      ["PORT", "No", "API", "4000", "—"],
      ["CORS_ORIGINS", "No", "API", "http://localhost:5173", "Comma-separated allow-list"],
      ["NODE_ENV", "No", "API", "development", "Must be production in production, or the SPA is not served"],
      ["LOG_LEVEL", "No", "API", "info", "Validated but not yet consumed by a structured logger"],
      ["SESSION_IDLE_TIMEOUT_MINUTES", "No", "API", "30", "Application session policy"],
      ["SESSION_ABSOLUTE_HOURS", "No", "API", "12", "Application session policy"],
      ["REDIS_URL", "No", "Domain layer schema only", "—", "Declared and unconsumed; no Redis-backed code exists"],
      ["VITE_SUPABASE_URL", "Yes (client)", "Web client", "—", "Only VITE_-prefixed variables reach the browser bundle"],
      ["VITE_SUPABASE_PUBLISHABLE_KEY", "Yes (client)", "Web client", "—", "Public by design"],
      ["VITE_API_URL", "No", "Web client", "http://localhost:4000/api", "Same-origin /api in production"],
      ["VITE_GOOGLE_CLIENT_ID", "No", "Web client", "—", "Enables One Tap when present"],
      ["SUPER_ADMIN_EMAIL, PILOT_ADMIN_EMAIL", "No", "Bootstrap script", "—", "Read once when seeding the initial administrators"],
    ],
    [1.7, 0.9, 1.3, 1, 2.4]
  ),
  TBL("Configuration reference")
);
add(
  T(
    ["Aspect", "Specification"],
    [
      ["Configuration hierarchy", "Process environment overrides the local .env file, which overrides the schema default. There is no runtime configuration store and no dynamic reload; a change requires a restart."],
      ["Validation", "Fail-fast at boot with every offending key listed. The domain layer validates independently so that scripts and migrations can run without the API."],
      ["Deployment", "Environment variables are set in the hosting platform's own configuration; CI reads its values from repository secrets."],
      ["Feature flags", "None. Behavioural switches are environment variables where they exist at all."],
      ["Client exposure", "Only VITE_-prefixed variables are compiled into the browser bundle. The service-role key is deliberately not prefixed and must never become so."],
    ],
    [1, 4.2]
  ),
  TBL("Configuration management practices")
);
add(
  NOTE(
    "Mandatory statement",
    "Secrets and credentials must never be stored directly in this document or in source code. Real values belong only in an untracked environment file or the platform's secret storage. No value in this document is a real credential."
  )
);

/* ========================= 24. DEPENDENCY MANAGEMENT ========================= */
add(PB(), H(1, "24. Dependency Management"));
add(
  T(
    ["Aspect", "Specification"],
    [
      ["Internal dependencies", "The API layer depends on the domain layer; the domain layer depends on the shared kernel; nothing depends upward. Both the API and the operational scripts import the same domain modules, so a domain change affects both surfaces simultaneously."],
      ["External runtime dependencies", "Listed in Section 6. The load-bearing ones are Express, pg, @supabase/supabase-js, Zod, Helmet and React."],
      ["Build and test dependencies", "TypeScript, Vite, esbuild, tsx, Playwright, Vitest, Testing Library, Prisma CLI."],
      ["Version policy", "Caret ranges in the manifest with a committed lockfile; CI installs from the lockfile, so builds are reproducible even though the ranges are permissive."],
      ["Runtime requirement", "Node 20 in CI. The ESM output format is a hard requirement of the generated Prisma client."],
      ["Licence considerations", "The direct dependency set is MIT, Apache-2.0 or equivalent permissive licences. No full transitive licence audit has been performed ([TBD], TBD-18)."],
      ["Upgrade strategy", "No cadence is defined. Upgrades happen when a need arises. A quarterly review of the direct dependency set is recommended, gated on the full pipeline."],
      ["Deprecation strategy", "The Prisma dependency is retained solely for two legacy profile fields and is to be removed once those are migrated into the core schema. It must never be used to change the domain schema in the meantime."],
      ["Vulnerability monitoring", "Not configured. Neither npm audit nor an automated dependency-update service runs in the pipeline ([TBD], TBD-10)."],
      ["Transitive risk", "The dependency count is moderate for a stack of this shape; the highest-value hardening available is scheduled scanning plus a lockfile-integrity gate."],
    ],
    [1, 4.2]
  ),
  TBL("Dependency management")
);

module.exports = c;
