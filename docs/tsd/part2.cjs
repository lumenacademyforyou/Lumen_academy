/** Sections 5-7: System Architecture, Technology Stack, Detailed Component Design. */
const { H, P, B, N, T, TBL, FIG, CODE, NOTE, PB } = require("./helpers.cjs");

const c = [];
const add = (...x) => x.forEach((y) => (Array.isArray(y) ? c.push(...y) : c.push(y)));

/* ========================= 5. SYSTEM ARCHITECTURE ========================= */
add(PB(), H(1, "5. System Architecture"));

add(H(2, "5.1 Architecture principles"));
add(
  T(
    ["ID", "Principle", "Implication"],
    [
      ["AP-1", "The server is the authority for anything that affects a score.", "Deadline, item selection, answer key and marks are computed and stored server-side; the client renders them, it never supplies them."],
      ["AP-2", "Persistence is explicit.", "The domain schema is raw SQL under version control with a verification script per migration; no ORM owns it."],
      ["AP-3", "Authorisation is data, not code.", "Roles and permissions are rows; route handlers assert a permission code, they do not test for a role name."],
      ["AP-4", "Ownership is checked once, at the boundary of the aggregate.", "Attempt children are authorised by resolving the parent attempt's owner one time per request."],
      ["AP-5", "Errors are a contract.", "Domain errors are typed and translated centrally into a fixed catalogue of status and code pairs."],
      ["AP-6", "Exactness over convenience in scoring.", "Marks use scaled-integer decimal arithmetic; floating point is prohibited."],
      ["AP-7", "Prefer the smallest infrastructure that satisfies the requirement.", "A single process with an in-process interval job is preferred over a queue or scheduler until scale demands otherwise."],
      ["AP-8", "A generic mechanism must not be used where an invariant exists.", "Attempts are not exposed through the generic CRUD router because they carry server-enforced state invariants."],
    ],
    [0.6, 2.6, 5]
  ),
  TBL("Architecture principles")
);

add(H(2, "5.2 Architecture style"));
add(
  P(
    "The system is a layered modular monolith with a single deployable artefact. Within the process, the boundaries are: HTTP edge (routing, validation, authentication, authorisation), application services (orchestration, transactions), and the domain layer (entity model, repository, service per entity, plus cross-entity engines for assembly, scoring and analytics). The frontend is a separate build artefact served as static assets by the same process in production. This is deliberately not a microservice topology: the domain is small, the transactional boundaries are tight around a single attempt, and the operational cost of a distributed deployment is not justified at this baseline (see ADR-005)."
  )
);

add(H(2, "5.3 Logical architecture"));
add(
  T(
    ["Layer", "Contents", "May depend on"],
    [
      ["Presentation", "React views, contexts, hooks, client services", "API layer (HTTP), Supabase client SDK"],
      ["API edge", "Routers, request validation, authentication, authorisation, error translation", "Application services, domain services"],
      ["Application services", "backend/src/services: profile, invitation, admin user, session, provisioning, account deletion", "Domain layer, Supabase admin client"],
      ["Domain layer", "db/ per-entity model, repository and service; assembly, scoring, analytics engines", "Shared pool, shared errors"],
      ["Shared kernel", "db/shared: connection pool, typed error classes, stem normalisation, repository helpers", "None (leaf)"],
      ["Persistence", "PostgreSQL schemas catalog, core, content, assess, learn, util", "None"],
    ],
    [1.1, 4, 2]
  ),
  TBL("Logical layers and permitted dependency direction")
);
add(NOTE("Rule", "Dependencies point downward only. A domain module never imports from backend/src, and the shared kernel imports nothing from the layers above it."));

add(H(2, "5.4 Physical architecture"));
add(
  P(
    "At this baseline a deployed environment consists of one Node process (API plus static SPA assets), one managed PostgreSQL instance reached through the platform's session-mode pooler, one object-storage bucket, and the managed identity service. There is no separate web tier, cache tier or message broker. The reverse proxy, TLS termination point and process supervisor are properties of the chosen hosting platform, which is [TO BE DEFINED]."
  )
);
add(
  CODE([
    "   Internet",
    "      |",
    "      |  HTTPS 443",
    "      v",
    "  +---------------------------------------------+",
    "  |  Hosting platform edge  [TBD]               |",
    "  |  TLS termination, HTTP routing              |",
    "  +----------------------+----------------------+",
    "                         |",
    "                         v",
    "  +---------------------------------------------+        +----------------------+",
    "  |  Node 20 process (dist/server.mjs)          |  HTTPS  |  Supabase Auth       |",
    "  |  - Express API  /api/*                      +-------->+  (token verify)      |",
    "  |  - Static SPA   dist/ (index.html, assets)  |         +----------------------+",
    "  |  - expirySweeper interval (60 s)            |",
    "  |  - pg pool (max 4)  + prisma pool (legacy)  |         +----------------------+",
    "  +----------------------+----------------------+  HTTPS  |  Supabase Storage    |",
    "                         |                     +--------->+  (public asset URLs) |",
    "                         | TLS 5432 (session pooler)      +----------------------+",
    "                         v",
    "  +---------------------------------------------+",
    "  |  PostgreSQL (Supabase)                      |",
    "  |  project connection cap: 15 sessions        |",
    "  +---------------------------------------------+",
  ]),
  FIG("Deployment architecture — one process per environment")
);

add(H(2, "5.5 Component architecture"));
add(
  P(
    "The request path through the process is fixed and every authenticated request traverses it in the same order. Placing the attempt-lockdown check inside the authentication middleware rather than per router is deliberate: it is the one point every authenticated request already passes, so no future router can omit it."
  )
);
add(
  CODE([
    "  request",
    "     |",
    "     v",
    "  helmet(CSP: self + supabase origin)",
    "     v",
    "  cors(allow-list from CORS_ORIGINS, credentials)",
    "     v",
    "  express.json(limit 1mb)",
    "     v",
    "  requestTiming  ------------------------------> timing log line",
    "     v",
    "  [route match]",
    "     |                              (public routes exit here: /health,",
    "     |                               /questions, /syllabus, /catalog/*)",
    "     v",
    "  requireAuth",
    "     |  1. extract Bearer token          -> 401 UNAUTHORIZED if absent",
    "     |  2. supabaseAuth.auth.getUser()   -> 401 UNAUTHORIZED if invalid",
    "     |  3. provisionCanonicalUser()      -> req.user{id, role, appUserId}",
    "     |  4. checkAndTouchOnAuth()         -> 401 SESSION_EXPIRED on policy lapse",
    "     |  5. enforceAttemptLockdown()      -> blocked while an attempt is active",
    "     v",
    "  requirePermission(code) | requireAttemptOwnership() | ownership filter",
    "     v",
    "  validate({ body | query } zod schema)  -> 400 on schema failure",
    "     v",
    "  controller -> application service -> domain service -> repository -> SQL",
    "     v",
    "  errorHandler (typed domain error -> status + code, Section 18)",
    "     v",
    "  response",
  ]),
  FIG("Component architecture — the request middleware and handler chain")
);

add(H(2, "5.6 Deployment architecture"));
add(
  P(
    "The build produces two artefacts from one repository: the Vite bundle of the SPA under dist/, and an esbuild ESM bundle of the API at dist/server.mjs. Production starts the bundle with NODE_ENV set to production, which is the condition under which the process serves the SPA at all; without it the process answers the root path with a JSON status instead of the application. Content-hashed assets under dist/assets are served immutable for one year; index.html is served no-cache because its URL is stable while its content changes on every deploy."
  )
);
add(
  T(
    ["Artefact", "Produced by", "Contents", "Cache policy"],
    [
      ["dist/ (SPA)", "vite build", "index.html plus content-hashed JS/CSS/asset files", "assets: public, max-age=31536000, immutable; root: no-cache"],
      ["dist/server.mjs", "esbuild, ESM, external packages, sourcemap", "API server bundle", "n/a"],
      ["Generated Prisma client", "npx prisma generate", "Typed client for the residual legacy model", "n/a"],
      ["Database migrations", "db/migrations/*.sql", "Applied out of band as an explicit deploy step", "n/a"],
    ],
    [1.3, 1.6, 2.6, 2.5]
  ),
  TBL("Deployment artefacts")
);
add(NOTE("Constraint", "The API bundle must be ESM. A CommonJS bundle crashes on start because the generated Prisma client resolves import.meta.url, which is undefined in CJS."));

add(H(2, "5.7 Network architecture"));
add(
  T(
    ["Path", "Protocol / port", "Direction", "Notes"],
    [
      ["Browser to platform edge", "HTTPS 443", "Inbound", "TLS termination at the platform edge [TBD]"],
      ["Platform edge to API process", "HTTP, PORT (default 4000)", "Internal", "Process binds PORT; not exposed directly"],
      ["Browser to Supabase Auth", "HTTPS 443", "Outbound from browser", "Sign-in and token refresh happen client-side; CSP connect-src admits this origin"],
      ["Browser to Supabase Storage", "HTTPS 443", "Outbound from browser", "Public asset URLs; CSP img-src admits this origin"],
      ["API to Supabase Auth", "HTTPS 443", "Outbound", "Per-request token verification"],
      ["API to PostgreSQL", "TLS 5432 (session-mode pooler)", "Outbound", "Session mode is required because the same connection is used for DDL during migration runs"],
      ["Browser to Google Drive", "HTTPS 443", "Outbound from browser", "Unit material preview and download"],
      ["CI to GitHub / npm / database", "HTTPS", "Outbound", "Build, test and optionally end-to-end against a live database"],
    ],
    [1.6, 1.5, 1.1, 3.8]
  ),
  TBL("Network paths")
);
add(NOTE("Open item", "Ingress restriction, WAF, DDoS protection and database network allow-listing are properties of the hosting platform and are [TO BE DEFINED] (see TBD-07)."));

add(H(2, "5.8 Security architecture"));
add(
  P(
    "Security architecture is specified in full in Section 13. In architectural terms: identity is delegated, authorisation is data-driven and evaluated in the process, ownership is enforced in the query layer, and the answer key is treated as a separate confidentiality class from the question itself. The content security policy merges the framework's safe defaults with exactly one cross-origin dependency — this deployment's own Supabase project — rather than being relaxed wholesale."
  )
);

add(H(2, "5.9 Data architecture"));
add(
  P(
    "Data is partitioned into six PostgreSQL schemas by ownership and change cadence: catalog (slow-moving reference data: exams, patterns, subjects, syllabus nodes, marking schemes), core (tenancy and identity: institutions, users, roles, permissions, sessions, subscriptions), content (the question bank and its provenance, assets, translations, fingerprints), assess (tests, blueprints, attempts, responses, events, scorecards, exposure ledgers), learn (per-user learning artefacts), and util (the applied-migration ledger). Section 9 specifies the entity model; Section 10 specifies flow, lifecycle and retention."
  )
);

add(H(2, "5.10 Integration architecture"));
add(
  CODE([
    "                +--------------------+",
    "  identity  --->|  Supabase Auth     |<--- token verify (API, per request)",
    "                |  GoTrue REST       |<--- admin ops (service-role key, server only)",
    "                +--------------------+",
    "                +--------------------+",
    "  assets    --->|  Supabase Storage  |<--- upload (import scripts, service role)",
    "                |  public bucket     |---> read (browser, public URL)",
    "                +--------------------+",
    "                +--------------------+",
    "  materials --->|  Google Drive      |---> preview iframe / download redirect",
    "                +--------------------+",
    "                +--------------------+",
    "  sign-in   --->|  Google Identity   |---> OAuth redirect / One Tap ID token",
    "                +--------------------+",
    "",
    "  All integrations are synchronous HTTPS. There is no message broker, no",
    "  webhook receiver and no outbound queue in this baseline.",
  ]),
  FIG("Integration architecture — external systems and their direction of use")
);

add(H(2, "5.11 Scalability architecture"));
add(
  P(
    "The API holds no in-memory per-user state, so instances are interchangeable and can be added behind a load balancer without affinity. The binding constraint on horizontal scale is not the process but the database connection budget: the managed pooler caps the project at 15 sessions, and each process holds two pools (the domain pool, capped at 4, and the residual Prisma pool). Scaling out therefore requires either a raised platform cap or transaction-mode pooling, and must be planned rather than assumed. Read-heavy endpoints (question list, catalog tree) are candidates for caching; no cache tier exists today."
  )
);
add(NOTE("Precondition", "RISK-01 (assembly executed on the shared pool from within an open transaction) must be closed before any concurrency target is published or any load test is treated as representative."));

add(H(2, "5.12 High-availability architecture"));
add(
  P(
    "There is no redundancy in the application tier at this baseline: a single process is a single point of failure, and its restart is the recovery mechanism. Database availability, backup and point-in-time recovery are properties of the managed platform. Section 21 states the recovery objectives, which are currently unset. Making the application tier redundant is a configuration change (run two or more processes) plus the connection-budget work described in 5.11; the in-process sweeper is already safe to run in every instance because submission is idempotent per attempt and guarded by a row lock."
  )
);

add(H(2, "5.13 Failure and recovery architecture"));
add(
  T(
    ["Failure", "Detection", "Immediate behaviour", "Recovery"],
    [
      ["Database unreachable", "Health endpoint fails; query errors", "Requests fail with 500 INTERNAL_ERROR", "Platform recovery; process needs no restart once connectivity returns"],
      ["Connection pool exhausted", "Requests hang then fail; pooler reports EMAXCONNSESSION", "Attempt start and submit stall", "Restart the process to release sessions; close RISK-01"],
      ["Identity provider unavailable", "401s on all authenticated routes", "Public read routes continue to serve", "Wait for provider; no local fallback exists by design"],
      ["Object storage unavailable", "Broken images in client", "Questions render without images", "None required in-process"],
      ["Client disappears mid-attempt", "Deadline passes with no submission", "Sweeper force-submits within one interval and records reason sweeper", "Candidate sees a scored attempt on return"],
      ["Concurrent submission of one attempt", "Row lock contention", "Second submission observes the scored state", "No action; idempotent by design"],
      ["Pool cannot satisfy a blueprint line", "PoolInsufficientError at assembly", "422 POOL_INSUFFICIENT with requested and available counts", "Candidate narrows the configuration; content team publishes more items"],
      ["Process crash", "Platform health check", "All in-flight requests lost", "Process restart; in-progress attempts survive because state is in the database"],
    ],
    [1.5, 1.6, 2.6, 2.6]
  ),
  TBL("Failure modes and architectural responses")
);

/* ========================= 6. TECHNOLOGY STACK ========================= */
add(PB(), H(1, "6. Technology Stack"));
add(
  P(
    "Versions are the declared dependency ranges of the repository at this baseline. Where a technology commonly present in a stack of this shape is genuinely absent, the row is retained and marked so, rather than omitted — an absent cache or broker is an architectural fact, not an oversight."
  )
);
add(
  T(
    ["Layer", "Technology", "Version", "Purpose", "Env", "Owner", "Licence", "Notes"],
    [
      ["Language", "TypeScript", "~5.8.2", "Frontend and backend source", "All", "Engineering", "Apache-2.0", "Strict mode; typecheck gates CI"],
      ["Frontend", "React / React DOM", "^19.0.1", "SPA rendering", "All", "Frontend", "MIT", "—"],
      ["Frontend", "Vite", "^6.2.3", "Dev server and production bundling", "All", "Frontend", "MIT", "—"],
      ["Frontend", "React Router", "^7.18.2", "Client routing", "All", "Frontend", "MIT", "—"],
      ["Frontend", "Tailwind CSS", "^4.1.14", "Styling", "All", "Frontend", "MIT", "Via @tailwindcss/vite"],
      ["Frontend", "Recharts", "^3.10.1", "Analytics charts", "All", "Frontend", "MIT", "—"],
      ["Frontend", "jsPDF / html2canvas", "^4.2.1 / ^1.4.1", "Client-side PDF export", "All", "Frontend", "MIT", "—"],
      ["Backend", "Node.js", "20 (CI); >=18 assumed", "Runtime", "All", "Platform", "MIT", "CI pins 20"],
      ["Backend", "Express", "^4.21.2", "HTTP API", "All", "Backend", "MIT", "—"],
      ["Backend", "Helmet", "^8.3.0", "Security headers and CSP", "All", "Backend", "MIT", "CSP admits the Supabase origin"],
      ["Backend", "cors", "^2.8.6", "Cross-origin policy", "All", "Backend", "MIT", "Allow-list from CORS_ORIGINS"],
      ["Backend", "Zod", "^4.4.3", "Environment and request validation", "All", "Backend", "MIT", "—"],
      ["Backend", "pdfkit", "^0.19.1", "Server-side PDF generation", "All", "Backend", "MIT", "—"],
      ["Backend", "jimp", "^1.6.1", "Image processing for asset pipeline", "All", "Content tooling", "MIT", "Perceptual hashing support"],
      ["API style", "REST over JSON", "n/a", "Client-server contract", "All", "Backend", "n/a", "No GraphQL, no RPC"],
      ["Database", "PostgreSQL (Supabase)", "[TBD] server version", "System of record", "All", "Platform", "PostgreSQL Licence", "Six schemas; pgvector index in migration 006"],
      ["DB driver", "pg", "^8.22.0", "Connection pooling and SQL", "All", "Backend", "MIT", "Pool max 4 per process"],
      ["ORM (legacy)", "Prisma / @prisma/client", "^7.9.1", "Two residual legacy profile fields only", "All", "Backend", "Apache-2.0", "Must never run migrate deploy or db push against the live database"],
      ["Cache", "None", "n/a", "—", "—", "—", "—", "No cache tier exists; REDIS_URL is declared optional and unconsumed"],
      ["Message broker", "None", "n/a", "—", "—", "—", "—", "No asynchronous messaging in this baseline"],
      ["Object storage", "Supabase Storage", "n/a", "Question image assets", "All", "Platform", "Commercial", "Bucket from OBJECT_STORAGE_BUCKET"],
      ["Identity", "Supabase Auth", "@supabase/supabase-js ^2.112.2", "Sign-in and token verification", "All", "Platform", "Commercial / MIT SDK", "No application-issued JWTs"],
      ["Cloud", "Supabase; application host [TBD]", "n/a", "Managed data platform", "All", "Platform", "Commercial", "Application hosting target not yet fixed"],
      ["Containers", "None declared", "n/a", "—", "—", "—", "—", "No Dockerfile in the repository"],
      ["Orchestration", "None", "n/a", "—", "—", "—", "—", "Single process; no Kubernetes"],
      ["CI/CD", "GitHub Actions", "n/a", "Pull-request pipeline and scheduled reset", "CI", "Engineering", "Commercial", "Two workflows: ci.yml, reset-demo-account.yml"],
      ["Build", "esbuild", "^0.25.0", "Backend bundling to ESM", "CI, Prod", "Backend", "MIT", "—"],
      ["Testing", "Playwright", "^1.62.1", "End-to-end", "CI, Local", "QA", "Apache-2.0", "Chromium project only"],
      ["Testing", "Vitest + Testing Library", "^3.2.7 / ^16.3.3", "Frontend unit and component", "CI, Local", "Frontend", "MIT", "jsdom environment"],
      ["Testing", "node:test", "Node 20 built-in", "Backend and domain unit tests", "CI, Local", "Backend", "MIT", "Run with tsx"],
      ["Monitoring", "None integrated", "n/a", "—", "—", "—", "—", "[TBD] — only console logging and GET /api/health today"],
      ["Logging", "console (stdout/stderr)", "n/a", "Request timing, errors", "All", "Backend", "n/a", "[TBD] — no structured log shipping"],
      ["Secrets", "Environment variables; GitHub Actions secrets", "n/a", "Configuration", "All", "Platform", "n/a", "No secret manager integrated"],
    ],
    [0.9, 1.5, 1.2, 1.7, 0.6, 0.9, 0.9, 2.3]
  ),
  TBL("Technology stack matrix")
);

/* ========================= 7. DETAILED COMPONENT DESIGN ========================= */
add(PB(), H(1, "7. Detailed Component Design"));
add(
  P(
    "Each component below is specified against the same fifteen-point template: overview, responsibilities, internal structure, interfaces, inputs, outputs, dependencies, data handling, error handling, security, performance, scalability, logging, monitoring and failure scenarios. The template is rendered as a table per component so that the same attribute occupies the same position throughout, and so that the section can be reviewed component-by-component or attribute-by-attribute."
  )
);

function component(id, name, rows) {
  add(H(2, id + " " + name));
  add(
    T(["Attribute", "Specification"], rows, [1, 4.2]),
    TBL("Component specification — " + name)
  );
}

component("7.1", "Web client (SPA)", [
  ["Overview", "React 19 single-page application, built by Vite, served in production as static assets by the API process. Owns all rendering, the test-taking experience and client-side PDF export."],
  ["Responsibilities", "Authenticate against Supabase; attach the bearer token to every API call; render the attempt from the server envelope; run the countdown from the server's clock reading; flush answers on an interval; render results, review and analytics; present admin and content screens to permitted users."],
  ["Internal structure", "pages/ (Landing, Dashboard, TestList, SystemCheck, Lobby, TestTaking, Evaluating, AttemptReview, MyResults, Analytics, StudyPlan, Courses, CourseArea, Profile, Admin); components/{layout,ui}; contexts/LanguageContext; hooks/{useDashboardAnalytics,useIdleSessionGuard}; services/ (one module per API area plus supabase, supabaseAuth, demoSession, pdfExport)."],
  ["Interfaces", "Outbound: REST to /api/* through services/api.ts; Supabase JS SDK for auth; direct HTTPS GET for public asset URLs. Inbound: none (no server pushes to the client)."],
  ["Inputs", "User interaction; API responses; Supabase session; environment variables prefixed VITE_."],
  ["Outputs", "API requests; rendered views; generated PDF files on the user's device."],
  ["Dependencies", "API layer (7.2); Supabase Auth; Supabase Storage; Google Drive (material preview); Google Identity Services (optional One Tap)."],
  ["Data handling", "Answers are held in component state and flushed on a 12-second interval and on submit. The Supabase SDK holds the session in browser storage and refreshes it in the background. No answer key is ever present in client memory before submission."],
  ["Error handling", "services/api.ts parses the structured error envelope into a typed ApiError. A 401 on an authenticated call signs the user out and returns them to the landing route, because the SDK has already exhausted its own refresh path by that point."],
  ["Security", "Holds only the publishable Supabase key. Never receives the service-role key. Subject to the API's CSP; must not introduce a cross-origin dependency without a CSP change."],
  ["Performance", "Content-hashed assets are immutable-cached for a year; index.html is never cached. Autosave interval 12 s. [TBD] initial-bundle budget."],
  ["Scalability", "Static assets scale with the serving tier or a CDN [TBD]."],
  ["Logging", "Browser console only; no client telemetry is collected."],
  ["Monitoring", "[TBD] — no real-user monitoring or client error reporting is integrated."],
  ["Failure scenarios", "Lost network mid-attempt: unflushed answers since the last interval are lost, and the attempt is closed by the sweeper if the deadline passes. Navigation away from the attempt view discards unflushed state (see RISK-07)."],
]);

component("7.2", "API layer (Express)", [
  ["Overview", "Stateless HTTP interface for the whole product, mounted under /api, plus the production static-asset server for the SPA."],
  ["Responsibilities", "Terminate the HTTP contract; apply security headers, CORS and body limits; authenticate; enforce session policy, lockdown, permissions and ownership; validate request shapes; delegate to services; translate domain errors into the HTTP catalogue."],
  ["Internal structure", "server.ts (composition root); routes/ (api, catalog, content, core, assess, learn, admin); controllers/; services/; middleware/ (requireAuth, requirePermission, ownership, attemptLockdown, validate, requestTiming, errorHandler); lib/ (db, permissions, supabaseClient, supabaseAdmin, dbCrudRouter); jobs/expirySweeper."],
  ["Interfaces", "Inbound REST (Section 8). Outbound: Supabase Auth API, PostgreSQL, Supabase admin API for privileged user operations."],
  ["Inputs", "HTTP requests with an optional Bearer token; validated environment configuration."],
  ["Outputs", "JSON responses in a data or error envelope; static files in production; timing and error log lines."],
  ["Dependencies", "Domain layer (7.4); Supabase Auth; PostgreSQL."],
  ["Data handling", "Holds no request state between requests. The only cached process state is configuration and client instances (permission catalogue, Supabase clients), never per-user data."],
  ["Error handling", "One central error handler maps typed domain errors, structured domain errors carrying payloads (pool insufficiency, invalid paper, active attempt), a small set of PostgreSQL SQLSTATE codes, and everything else to 500 with the stack logged."],
  ["Security", "Helmet CSP with connect-src and img-src extended to the deployment's Supabase origin only; CORS allow-list; 1 MB JSON limit; service-role key held server-side and used only by administrative paths."],
  ["Performance", "Per-request timing middleware. The dominant cost is database round-trip latency, measured at approximately 250-300 ms against the managed instance in the development environment."],
  ["Scalability", "Stateless and replicable; bounded by the database connection budget (5.11)."],
  ["Logging", "Request timing per request; error stacks for unmapped errors; explicit loud logging for scoring-rule data defects."],
  ["Monitoring", "GET /api/health for liveness and database reachability; everything else is [TBD]."],
  ["Failure scenarios", "Identity provider outage makes all authenticated routes fail closed. Database outage fails every data path. Neither is masked."],
]);

component("7.3", "Authentication, session and authorisation", [
  ["Overview", "The chain that turns a bearer token into an authorised, session-valid, non-locked-down caller."],
  ["Responsibilities", "Verify the token with the identity provider; resolve or provision the canonical application user; enforce this application's idle and absolute session policy; enforce attempt lockdown; evaluate permission codes; enforce row ownership."],
  ["Internal structure", "middleware/requireAuth; services/session.service (session identity derived from the token's session claim, so a background refresh is not a new session); services/provisionUser.service; middleware/requirePermission with lib/permissions; middleware/ownership and requireAttemptOwnership; middleware/attemptLockdown."],
  ["Interfaces", "Consumed as Express middleware. Session status, heartbeat and logout are exposed as routes (Section 8.3)."],
  ["Inputs", "Authorization header; core.user_session rows; core.role, core.permission, core.role_permission, core.user_role_assignment rows."],
  ["Outputs", "req.user (legacy profile id, role, canonical app user id), req.accessToken, req.sessionInfo; or a 401/403 error."],
  ["Dependencies", "Supabase Auth API; PostgreSQL core schema."],
  ["Data handling", "The session record is keyed by the token's session claim rather than the token itself. The claim is read from an already-verified token without re-verifying the signature, which is a read of trusted data, not an independent trust decision."],
  ["Error handling", "401 UNAUTHORIZED for a missing or invalid token; 401 SESSION_EXPIRED when the application's own policy has lapsed; 403 FORBIDDEN for a failed permission check; 404 NOT_FOUND rather than 403 when a row exists but is not the caller's, so ownership is not disclosed."],
  ["Security", "Fails closed. No local signing secret exists, so the application cannot mint tokens. Permission checks read persisted data, never a hard-coded role list."],
  ["Performance", "One outbound verification call per authenticated request. [TBD] — no verification-result caching is implemented; this is the single largest per-request fixed cost."],
  ["Scalability", "Stateless apart from one session row read and touch per request."],
  ["Logging", "Authentication failures are returned but not currently logged with context ([TBD], see Section 19)."],
  ["Monitoring", "[TBD] — no authentication failure-rate metric exists."],
  ["Failure scenarios", "Identity provider latency directly adds to every authenticated request's latency. Provider outage fails all authenticated traffic closed."],
]);

component("7.4", "Domain layer (db/)", [
  ["Overview", "The hand-written TypeScript layer over raw SQL that owns all domain behaviour and all persistence, independent of Express."],
  ["Responsibilities", "Expose one model, repository and service per entity across catalog, core, content, assess and learn; own transactions; raise typed domain errors; host the cross-entity engines (assembly, scoring, analytics, lifecycle, dedup)."],
  ["Internal structure", "db/{catalog,core,content,assess,learn}/<entity>/{model,repository,service}; db/shared/{pool,errors,normalizeStem,repository-helpers,questionArtifacts}; db/migrations and db/verify; db/scripts for seed, import, dedup, manual operations."],
  ["Interfaces", "TypeScript function exports consumed by the API layer and by scripts. No HTTP awareness whatsoever."],
  ["Inputs", "Typed arguments from callers; DATABASE_URL and related configuration validated at import time."],
  ["Outputs", "Typed rows and domain objects; typed errors."],
  ["Dependencies", "PostgreSQL; Supabase Storage (asset resolution only)."],
  ["Data handling", "Raw parameterised SQL only. Transactions are opened explicitly with a checked-out client, and every query inside a transaction must use that client rather than the shared pool."],
  ["Error handling", "A typed error class per domain condition (not found, duplicate key, foreign-key violation, invalid state transition, concurrent write, pool insufficient, paper invalid, test not published, window closed, idempotency conflict, question not in attempt, invalid numeric answer, scoring rule missing, review not available, active attempt exists)."],
  ["Security", "No string interpolation of user input into SQL. Ownership predicates are part of the query, not a post-filter."],
  ["Performance", "Assembly runs one query per blueprint line, sequentially, because each line must exclude items already chosen by earlier lines. Attempt-start inserts are batched into a single set-returning insert."],
  ["Scalability", "Shares one pool capped at 4 connections per process; see RISK-01 for the transaction-versus-pool hazard."],
  ["Logging", "Errors surface to the caller; scripts log their own progress."],
  ["Monitoring", "[TBD] — no query-level metrics."],
  ["Failure scenarios", "A query issued on the shared pool while a transaction client is held can exhaust the pool and deadlock (RISK-01)."],
]);

component("7.5", "Assessment engine", [
  ["Overview", "Blueprint assembly, seeded ordering, exposure control, attempt state machine, envelope production and expiry."],
  ["Responsibilities", "Select a served item set that satisfies the blueprint; guarantee no duplicate item within a paper; prefer items the candidate has not seen; persist the seed and the served set; compute and enforce the server deadline; produce the attempt envelope; sweep expired attempts."],
  ["Internal structure", "generation/{assemble,availability,session-shuffle}; attempt/{attempt-flow,envelope,expiry,attempt.repository}; definition/{create-test,create-practice-test,ingest-paper,test-code}; test_section, test_assignment; unit_recycle_log and user_question_seen as exposure ledgers."],
  ["Interfaces", "assembleForAttempt, startAttempt, upsertResponse, batch response save, pauseAttempt, resumeAttempt, submitAttempt, getAttemptEnvelope, getReview, sweepExpiredAttempts."],
  ["Inputs", "Test and blueprint rows; the published question pool; the candidate's exposure history; the database clock."],
  ["Outputs", "assess.attempt, assess.attempt_question, assess.attempt_response, assess.attempt_event, assess.attempt_pause rows; the attempt envelope; assess.scorecard and assess.section_score via 7.6."],
  ["Dependencies", "Domain layer; content schema; scoring engine; database clock."],
  ["Data handling", "Assembly is read-only. The served set and its order are persisted at start so the paper is reproducible and auditable. Pause accumulates paused milliseconds rather than mutating the original deadline."],
  ["Error handling", "PoolInsufficientError carries blueprint, section, requested and available counts. ActiveAttemptExistsError carries the existing attempt and test ids so the client can offer resume or submit. Invalid state transitions are rejected, not coerced."],
  ["Security", "The envelope omits correctness flags, explanations and answer-key-adjacent assets. Attempts are deliberately not exposed through the generic CRUD router, because a generic write path would let an owner set state or deadline directly."],
  ["Performance", "One query per blueprint line plus one exceptional-path count query; batched insert of served questions at start."],
  ["Scalability", "See RISK-01. Assembly itself is read-only and parallelisable once the pool hazard is closed."],
  ["Logging", "The sweeper logs found, scored and abandoned counts whenever it closes anything."],
  ["Monitoring", "[TBD] — no metric for assembly duration, pool insufficiency rate or sweeper closures."],
  ["Failure scenarios", "Insufficient pool for a line; a candidate abandoning an attempt (closed by the sweeper); concurrent starts under RISK-01."],
]);

component("7.6", "Scoring and scorecard", [
  ["Overview", "Pure evaluation of responses against marking rules, aggregation into section and attempt totals, and persistence of the scorecard."],
  ["Responsibilities", "Evaluate each response (correct, incorrect, unattempted, void, partial); apply the marking scheme's partial-credit strategy for multiple-response items; aggregate to section and attempt level; persist scorecard and section scores."],
  ["Internal structure", "scoring/{types,decimal,evaluate,rules,aggregate}; attempt/scorecard/{model,repository,service} and section_score."],
  ["Interfaces", "Pure functions with no database, HTTP or clock access, called by submitAttempt inside its transaction."],
  ["Inputs", "Served questions with their answer keys, the candidate's responses, and the applicable scoring rule rows."],
  ["Outputs", "Per-response evaluation results and section and attempt aggregates as exact decimal strings; persisted scorecard and section score rows."],
  ["Dependencies", "catalog.marking_scheme data; assess.attempt_response rows."],
  ["Data handling", "All arithmetic is performed on integers scaled by a fixed power of ten and formatted back to decimal strings; no floating-point value ever participates. Numeric answers are matched within the rule's absolute or relative tolerance, taking the more permissive reading when both are present."],
  ["Error handling", "A missing scoring rule is treated as a data defect: logged loudly and returned as 500 SCORING_RULE_MISSING, not silently defaulted."],
  ["Security", "Runs only server-side; the scoring inputs are never accepted from the client."],
  ["Performance", "Pure in-process computation; negligible relative to the surrounding transaction."],
  ["Scalability", "Stateless and trivially parallel."],
  ["Logging", "Scoring-rule defects only."],
  ["Monitoring", "[TBD]."],
  ["Failure scenarios", "Absent or ambiguous marking-scheme data; a voided item requires an explicit disposition in the rule row rather than an assumed one."],
]);

component("7.7", "Content pipeline", [
  ["Overview", "Import, review, publication, asset management, fingerprinting and deduplication of question content."],
  ["Responsibilities", "Validate batch files against the published contract; record batches and rows; move questions through the lifecycle state machine; resolve and rename assets; compute content and skeleton fingerprints; detect, quarantine and repoint duplicates; maintain usage records."],
  ["Internal structure", "content/{question,question_option,question_solution,question_translation,source_document,ai_generation_job}; content/lifecycle; content/asset-resolver; content/fingerprint-normalizer; db/scripts/{import,dedup}; schemas/ for the batch JSON contract."],
  ["Interfaces", "Command-line scripts for import and dedup; HTTP read-only routers plus lifecycle transition routes gated by content:* permissions."],
  ["Inputs", "Batch JSON and images; reviewer decisions; asset files."],
  ["Outputs", "content.question and its satellites; content.asset and Storage objects; import batch and row records; dedup candidate, repoint and audit records."],
  ["Dependencies", "Supabase Storage; PostgreSQL; the catalog syllabus tree for node mapping."],
  ["Data handling", "Stem text is normalised for fingerprinting (whitespace, dash folding, multiword topic handling) so that near-duplicates collapse to the same key. Duplicate collapse repoints references rather than deleting rows outright, and audit rows are designed to outlive the question."],
  ["Error handling", "Invalid transitions return 409; contract violations reject the row and record it in the import row table rather than partially importing it."],
  ["Security", "Write paths require content permissions. The answer key lives with the option rows and is excluded from every pre-submission projection."],
  ["Performance", "Batch operations are offline and idempotent; they are not on any request path."],
  ["Scalability", "Bounded by database throughput; not a runtime concern."],
  ["Logging", "Scripts log per-batch and per-row outcomes; asset renames are recorded in a dedicated log table."],
  ["Monitoring", "[TBD] — no alert on published-pool depth per blueprint line."],
  ["Failure scenarios", "A question with no translation renders monolingually by design; a partially populated translation array leaves some options untranslated (RISK-08)."],
]);

component("7.8", "Analytics and reporting", [
  ["Overview", "Per-candidate dashboard analytics, item-response-theory reporting and cohort comparison."],
  ["Responsibilities", "Aggregate a candidate's attempts into counts, accuracy, subject and topic breakdowns and trends; compute an ability estimate for a scored attempt; compare an attempt against its cohort."],
  ["Internal structure", "db/assess/analytics/{dashboard,irt,irt-model}; backend/src/controllers/analyticsController; frontend hooks/useDashboardAnalytics."],
  ["Interfaces", "GET /api/analytics/dashboard; GET /api/assess/attempts/:attemptId/irt; GET /api/assess/attempts/:attemptId/cohort."],
  ["Inputs", "Scored attempts, responses and served questions for the caller; cohort scope [TBD]."],
  ["Outputs", "Aggregated analytics payloads consumed by the dashboard and review screens."],
  ["Dependencies", "assess and catalog schemas; analytics indexes from migration 023."],
  ["Data handling", "Every query is scoped to the caller's canonical user id; cohort comparison returns aggregates only, never another candidate's identity or responses."],
  ["Error handling", "A report requested for an attempt that is not yet scored returns 409 REVIEW_NOT_AVAILABLE rather than an empty result."],
  ["Security", "Aggregate-only disclosure across users; ownership enforced for the attempt-scoped reports."],
  ["Performance", "Supported by the analytics indexes added in migration 023; no materialised views exist."],
  ["Scalability", "Read-only; a candidate for caching if it becomes hot."],
  ["Logging", "None specific."],
  ["Monitoring", "[TBD]."],
  ["Failure scenarios", "Sparse history yields statistically weak ability estimates; the minimum item count for a meaningful estimate is [TBD]."],
]);

component("7.9", "Background jobs", [
  ["Overview", "In-process attempt-expiry sweeper, plus one scheduled external workflow that resets the demonstration account."],
  ["Responsibilities", "Close attempts whose deadline has passed without a client submission; keep the shared demonstration account usable."],
  ["Internal structure", "backend/src/jobs/expirySweeper (60-second interval, started at boot, stopped on SIGTERM/SIGINT); db/assess/test/attempt/expiry (shared sweep implementation); .github/workflows/reset-demo-account.yml; db/scripts/reset-user-data and wipe-user-data."],
  ["Interfaces", "None externally; the sweeper is internal and the reset workflow runs as a scheduled CI job."],
  ["Inputs", "Attempts past their server deadline; the demonstration account identifier."],
  ["Outputs", "Scored or abandoned attempts with a submission reason of sweeper; a reset demonstration account."],
  ["Dependencies", "Domain layer; database."],
  ["Data handling", "Force-submission reuses the same submission path as a candidate submission, so scoring is identical and idempotent."],
  ["Error handling", "A sweep failure is caught and logged; the interval continues."],
  ["Security", "Runs with the process's own database credentials; the reset workflow requires the service-role key held as a CI secret."],
  ["Performance", "One indexed SELECT per minute plus work only for rows that actually need closing."],
  ["Scalability", "Safe to run in every instance if the deployment is ever replicated, because submission is idempotent per attempt and row-locked."],
  ["Logging", "Logs only when it finds work, reporting found, scored and abandoned counts."],
  ["Monitoring", "[TBD] — no alert if the sweeper stops running."],
  ["Failure scenarios", "If the process is down, expiry is not enforced until it returns; attempts are closed on the next sweep, not retroactively at the correct instant."],
]);

module.exports = c;
