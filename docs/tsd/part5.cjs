/** Sections 25-33: compliance, decisions, risks, runbooks, maintenance, acceptance, traceability, TBD register, appendices. */
const { H, P, B, N, T, TBL, FIG, CODE, NOTE, PB } = require("./helpers.cjs");

const c = [];
const add = (...x) => x.forEach((y) => (Array.isArray(y) ? c.push(...y) : c.push(y)));

/* ========================= 25. COMPLIANCE AND DATA GOVERNANCE ========================= */
add(PB(), H(1, "25. Compliance and Data Governance"));
add(
  NOTE(
    "Statement of position",
    "No compliance certification, attestation or audit has been performed against this system. Nothing in this section asserts compliance. Each row states an applicable obligation or an open question, and the assessment column says only what is factually true of the implementation today."
  )
);
add(
  T(
    ["Regime / obligation", "Applicability", "Position at this baseline"],
    [
      ["Data privacy (general)", "Applicable — the system processes personal data of candidates, including minors in the typical NEET cohort", "Personal data is identified and classified in Section 10.4. Account deletion erases or anonymises user data while retaining audit records. No privacy notice, consent record or data-subject-request process is recorded in the repository."],
      ["Processing of minors' data", "Likely applicable — a substantial share of NEET candidates are under 18", "No age gate, guardian consent flow or minor-specific handling exists. This is an open governance question ([TBD], TBD-21) that should be answered before public launch."],
      ["Indian data-protection law (Digital Personal Data Protection Act, 2023)", "Likely applicable — the product targets Indian candidates", "Not assessed. Obligations around notice, consent, purpose limitation, retention and grievance redress have not been mapped to the implementation."],
      ["GDPR", "Applicable only if candidates in the European Economic Area are served", "Not assessed. Whether such candidates are in scope is a business decision that has not been recorded."],
      ["SOC 2", "Applicable only if contractually required by an institutional customer", "Not pursued. Several prerequisite controls (security logging, monitoring, formal change management, tested recovery) are open."],
      ["ISO/IEC 27001", "Applicable only if contractually required", "Not pursued."],
      ["PCI DSS", "Not applicable at this baseline", "The system processes no payment card data; there is no billing integration."],
      ["HIPAA", "Not applicable", "No protected health information is processed. Medical-subject content is examination material, not patient data."],
      ["Data residency", "Depends on the platform region selected", "Region is [TO BE DEFINED]; no residency commitment can be made until it is."],
      ["Auditability", "Applicable", "Content lifecycle decisions and question-identity changes are persisted and deliberately outlive the entities they describe. Administrative actions and authentication events are not audited (Section 19)."],
      ["Data retention", "Applicable", "[TO BE DEFINED] for every class (TBD-03). Only account-triggered deletion exists today."],
      ["Sub-processors", "Applicable", "Supabase (identity, database, storage) and Google (Drive, optional identity). No sub-processor register or data-processing agreement is recorded in the repository."],
    ],
    [1.5, 1.7, 4]
  ),
  TBL("Compliance and governance position")
);

/* ========================= 26. TECHNICAL DECISIONS ========================= */
add(PB(), H(1, "26. Technical Decisions and Trade-offs"));
add(
  P(
    "Each record states the decision, the context that forced it, the alternatives weighed, why the selected option won, and what the organisation now lives with. Dates are recorded where the repository evidences them and marked otherwise. Decision owner is [INPUT REQUIRED] where the record is reconstructed from the implementation rather than from a contemporaneous decision log."
  )
);

function adr(id, title, rows) {
  add(H(2, id + ": " + title));
  add(T(["Field", "Content"], rows, [0.9, 4.3]), TBL(id + " — " + title));
}

adr("ADR-001", "Own the domain schema in raw SQL, not in an ORM", [
  ["Context", "The product began with a Prisma-managed schema. The real domain — catalog, core, content, assess, learn — outgrew what the ORM modelled, and needed generated columns, triggers, custom SQLSTATEs, row-level security and a vector index."],
  ["Alternatives", "(a) Model everything in the ORM and use its migration track; (b) hand-written SQL migrations with a per-migration verification script; (c) a hybrid where the ORM owns some tables."],
  ["Selected", "(b), with the ORM retained only for two legacy fields (ADR-003)."],
  ["Reason", "The invariants that matter here are database-level: check constraints, triggers, exact-decimal columns, uniqueness across composite keys. Expressing them through an ORM abstraction would have obscured them, and the ORM's migration generator cannot express several of them at all."],
  ["Advantages", "Full access to PostgreSQL features; migrations are reviewable as SQL; each migration is provably applied because its verification script asserts the post-conditions."],
  ["Disadvantages", "More code to write per entity; no automatic typed client for domain tables; discipline is required to keep repositories consistent."],
  ["Trade-offs", "Developer convenience traded for explicitness and correctness at the persistence boundary."],
  ["Consequences", "db/migrations is the sole schema authority. Prisma migrate and db push must never run against the live database. Two migration ledgers coexist, which must not be confused."],
  ["Date / owner", "Established before this baseline / [INPUT REQUIRED]"],
]);

adr("ADR-002", "Delegate authentication entirely; hold no signing secret", [
  ["Context", "The product needs password and social sign-in, refresh handling and administrative account operations, with a small team."],
  ["Alternatives", "(a) Application-issued JWTs with a local signing secret; (b) verify provider tokens locally against the provider's public keys; (c) verify each token by calling the provider's user endpoint."],
  ["Selected", "(c)."],
  ["Reason", "It works identically whether the project signs with a shared secret or asymmetric keys, needs no key rotation handling in this codebase, and removes any possibility of the application minting a token."],
  ["Advantages", "No secret to leak or rotate; revocation at the provider takes effect immediately; the smallest possible identity surface in this codebase."],
  ["Disadvantages", "One outbound call per authenticated request, adding provider latency to every request and creating a hard dependency on provider availability."],
  ["Trade-offs", "Latency and availability coupling accepted in exchange for eliminating local key management."],
  ["Consequences", "There is no JWT_SECRET anywhere. An identity-provider outage is a total authentication outage. Verification-result caching is an available future optimisation and is currently [TBD]."],
  ["Date / owner", "Established before this baseline / [INPUT REQUIRED]"],
]);

adr("ADR-003", "Retain Prisma for two legacy profile fields only", [
  ["Context", "After the domain moved to raw SQL, one legacy model still backed two profile fields that live endpoints read and write."],
  ["Alternatives", "(a) Migrate the two fields into the core schema and delete the ORM immediately; (b) retain the client for those fields only; (c) keep the ORM broadly."],
  ["Selected", "(b), as an explicitly temporary state."],
  ["Reason", "Removing it required a data migration and endpoint changes that were not the priority at the time; keeping it broadly would have re-created the dual-authority problem ADR-001 solved."],
  ["Advantages", "No forced migration on the critical path."],
  ["Disadvantages", "A second connection pool against the same capped budget; a second migration ledger; a standing risk that someone runs an ORM migration against the live database."],
  ["Trade-offs", "Short-term delivery speed against a known, documented piece of technical debt."],
  ["Consequences", "The generated client must exist for the build to succeed, so prisma generate remains a pipeline step. Removal is tracked as future work."],
  ["Date / owner", "Recorded in the repository / [INPUT REQUIRED]"],
]);

adr("ADR-004", "Server authority over the assessment timer and paper", [
  ["Context", "A client-controlled timer or client-selected paper makes a score indefensible."],
  ["Alternatives", "(a) Client timer with server tolerance; (b) server-computed deadline delivered once, with the client counting down and the server enforcing independently."],
  ["Selected", "(b)."],
  ["Reason", "The candidate needs a smooth countdown, which only the client can render, but the outcome must not depend on the client's clock, tab state or honesty."],
  ["Advantages", "A responsive interface with an outcome that survives a throttled tab, a closed laptop or a manipulated clock."],
  ["Disadvantages", "Two mechanisms to keep aligned, and an independent server-side closure path is mandatory rather than optional."],
  ["Trade-offs", "Additional server machinery accepted for assessment integrity."],
  ["Consequences", "The envelope carries the server's clock reading and remaining seconds; the sweeper (ADR-008) is a required component, not a convenience."],
  ["Date / owner", "This baseline / [INPUT REQUIRED]"],
]);

adr("ADR-005", "Modular monolith, single deployable process", [
  ["Context", "A small team, one transactional core, and no independent scaling requirement per capability."],
  ["Alternatives", "(a) Services split by domain; (b) one process with enforced internal layering; (c) serverless functions per endpoint."],
  ["Selected", "(b)."],
  ["Reason", "Attempt start and submission are single transactions across several tables; splitting them would introduce distributed transactions to solve a problem the product does not have. Serverless would multiply connections against a capped pooler."],
  ["Advantages", "Simple deployment, simple debugging, transactional integrity, one artefact to version."],
  ["Disadvantages", "No independent scaling per capability; a single process is a single point of failure until replicated."],
  ["Trade-offs", "Operational simplicity now against a future refactor if any capability's load profile diverges sharply."],
  ["Consequences", "Layer boundaries must be enforced by review, since the compiler will not enforce them across directories."],
  ["Date / owner", "This baseline / [INPUT REQUIRED]"],
]);

adr("ADR-006", "Exact decimal arithmetic implemented locally, not with a library", [
  ["Context", "Marks must be exact. NEET-style schemes use values such as +4 and -1, and partial credit produces fractions."],
  ["Alternatives", "(a) JavaScript numbers; (b) a decimal library; (c) a small local module using scaled BigInt arithmetic."],
  ["Selected", "(c)."],
  ["Reason", "Floating point is disqualified outright. The operations actually required — add, compare, tolerance check, proportional partial credit — are narrow enough that a local module is easier to audit than a new dependency is to justify."],
  ["Advantages", "No rounding surprises; no added dependency; the whole implementation is reviewable in one file and is unit-tested directly."],
  ["Disadvantages", "A local implementation to maintain; every value crossing the boundary is a decimal string, which callers must respect."],
  ["Trade-offs", "A small amount of owned code against dependency surface and audit burden."],
  ["Consequences", "Marks appear as decimal strings in API payloads. Any future arithmetic on marks must go through this module."],
  ["Date / owner", "This baseline / [INPUT REQUIRED]"],
]);

adr("ADR-007", "No generic CRUD surface for stateful entities", [
  ["Context", "A generic router provides read, create, update and delete over any single-key repository, which is convenient for simple entities. Attempts were briefly exposed through it."],
  ["Alternatives", "(a) Generic CRUD with a column allow-list; (b) purpose-built transitions only, with a read-only ownership-checked read."],
  ["Selected", "(b)."],
  ["Reason", "The generic write path let an attempt's own owner set state to scored, move the deadline, or delete the row — defeating every guard the attempt flow exists to enforce. An allow-list would have to be remembered every time a column is added."],
  ["Advantages", "Server-enforced invariants cannot be bypassed; the write surface is exactly the set of legal transitions."],
  ["Disadvantages", "More routes to write for stateful entities."],
  ["Trade-offs", "Convenience traded for integrity, on the entity where integrity matters most."],
  ["Consequences", "The generic router remains in use for genuinely simple user-owned entities (learning artefacts, subscriptions, enrolments) and for read-only content reads."],
  ["Date / owner", "This baseline / [INPUT REQUIRED]"],
]);

adr("ADR-008", "In-process interval sweeper rather than external scheduling", [
  ["Context", "Lazy expiry enforcement only runs when a request for that user happens to arrive, so a candidate who goes offline at their deadline was left in progress indefinitely."],
  ["Alternatives", "(a) External cron or scheduled job; (b) a queue with delayed messages; (c) an interval inside the API process."],
  ["Selected", "(c), at 60 seconds."],
  ["Reason", "It needs no new infrastructure for a single-process deployment, and the work is cheap and idempotent. Sixty seconds makes 'closed promptly after the deadline' true in practice."],
  ["Advantages", "No new component to operate; the guarantee holds whenever the API is up."],
  ["Disadvantages", "If the process is down, expiry is not enforced until it returns. In a replicated deployment every instance runs the same sweep — safe but redundant."],
  ["Trade-offs", "Absolute punctuality traded for operational simplicity."],
  ["Consequences", "The sweeper starts at boot and stops on shutdown signals. If the deployment becomes multi-instance, this should be revisited but does not have to be."],
  ["Date / owner", "This baseline / [INPUT REQUIRED]"],
]);

adr("ADR-009", "Unversioned API path; retired endpoints answer 410", [
  ["Context", "The client and API ship together, so there is no independent client to keep on an old contract."],
  ["Alternatives", "(a) Versioned prefix from the outset; (b) unversioned with additive-only evolution and explicit retirement."],
  ["Selected", "(b), pending review."],
  ["Reason", "There is one client, deployed with the API. A version prefix would have been ceremony without a consumer."],
  ["Advantages", "Simpler paths; no dual-maintenance."],
  ["Disadvantages", "A third-party or mobile client would make a breaking change materially harder. The retirement mechanism (410) partially compensates by giving old callers a definitive answer."],
  ["Trade-offs", "Future flexibility against present simplicity."],
  ["Consequences", "This decision must be revisited before any external consumer is admitted. Recorded as TBD-19."],
  ["Date / owner", "This baseline / [INPUT REQUIRED]"],
]);

adr("ADR-010", "Answer 404, not 403, when a row is not the caller's", [
  ["Context", "An ownership failure can disclose that a resource exists."],
  ["Alternatives", "(a) 403 Forbidden; (b) 404 Not Found."],
  ["Selected", "(b)."],
  ["Reason", "A 403 on a well-formed identifier confirms the row exists, which lets an attacker enumerate identifiers and infer activity."],
  ["Advantages", "No existence disclosure across ownership or tenancy boundaries."],
  ["Disadvantages", "Slightly less precise diagnostics for a legitimate caller who has genuinely lost access."],
  ["Trade-offs", "Diagnostic clarity traded for confidentiality."],
  ["Consequences", "Uniform across attempts, learning artefacts and administrative tenancy. This is intentional and must not be 'corrected' to 403 in review."],
  ["Date / owner", "This baseline / [INPUT REQUIRED]"],
]);

adr("ADR-011", "Extend the content security policy by exactly one origin", [
  ["Context", "The framework's default policy restricts connect-src and img-src to the application's own origin. Sign-in happens from the browser against the identity provider, and question images resolve to storage URLs, so both were silently blocked in a production build — no server error, no build warning, only failed fetches."],
  ["Alternatives", "(a) Disable the policy; (b) relax the two directives to a wildcard; (c) merge the framework defaults with this deployment's own project origin."],
  ["Selected", "(c)."],
  ["Reason", "It fixes the real dependency without surrendering the protection, and it fails loudly if a new cross-origin dependency is added without thought."],
  ["Advantages", "Cross-site scripting protection retained; the one legitimate external origin admitted explicitly."],
  ["Disadvantages", "Any new external origin requires a deliberate code change — which is the point, not a defect."],
  ["Trade-offs", "None material."],
  ["Consequences", "Adding a CDN, analytics endpoint or font host requires a policy change and a review."],
  ["Date / owner", "This baseline / [INPUT REQUIRED]"],
]);

adr("ADR-012", "Bundle the API as ESM", [
  ["Context", "A CommonJS bundle crashed at start because the generated database client resolves import.meta.url, which is undefined under CommonJS."],
  ["Alternatives", "(a) Keep CommonJS and shim the global; (b) emit ESM."],
  ["Selected", "(b)."],
  ["Reason", "The package is already declared as a module; shimming a generated file's assumptions is fragile and would break silently on regeneration."],
  ["Advantages", "The production entry point starts reliably; no shim to maintain."],
  ["Disadvantages", "Any future CommonJS-only dependency needs interop handling."],
  ["Trade-offs", "None material."],
  ["Consequences", "The build emits dist/server.mjs and production must set NODE_ENV explicitly, since that is also the condition under which the SPA is served."],
  ["Date / owner", "This baseline / [INPUT REQUIRED]"],
]);

adr("ADR-013", "Permission answers the verb; tenancy answers the rows", [
  ["Context", "Institution and platform administrators need the same verbs over different populations."],
  ["Alternatives", "(a) Encode tenancy in permission codes and multiply them; (b) assert a permission in middleware and narrow rows in the service."],
  ["Selected", "(b)."],
  ["Reason", "Tenancy is a data-scoping question that only the service layer can answer once it knows the rows involved; encoding it in permissions produces a combinatorial explosion of codes that still cannot express row-level scope."],
  ["Advantages", "A small, stable permission vocabulary; scoping lives where the data is."],
  ["Disadvantages", "Every administrative service must remember to narrow; the middleware alone is not sufficient protection."],
  ["Trade-offs", "Requires review discipline on each new administrative endpoint."],
  ["Consequences", "A dedicated tenancy middleware was written and then deleted as superseded, because the services already narrow inline. New administrative services must follow the same pattern."],
  ["Date / owner", "This baseline / [INPUT REQUIRED]"],
]);

adr("ADR-014", "Retire the generative-AI subsystem", [
  ["Context", "Earlier revisions called an external model provider for study plans, attempt evaluation and answer explanation."],
  ["Alternatives", "(a) Keep and harden it; (b) remove it and retire its endpoints."],
  ["Selected", "(b), by programme directive."],
  ["Reason", "The directive prohibits calls to a model provider from this application. Retaining dead call paths and an unused provider key would be a standing risk."],
  ["Advantages", "No provider key exists anywhere; no external inference dependency; a smaller attack surface."],
  ["Disadvantages", "Features that depended on it are gone until they are rebuilt deterministically."],
  ["Trade-offs", "Capability traded for compliance with the directive and a smaller surface."],
  ["Consequences", "The three endpoints answer 410. The generation-job table is retained purely as a provenance record for content already imported."],
  ["Date / owner", "Phase H of the completion programme / [INPUT REQUIRED]"],
]);

/* ========================= 27. RISKS ========================= */
add(PB(), H(1, "27. Risks and Mitigations"));
add(
  P(
    "Probability and impact are rated High, Medium or Low; severity is the resulting product. Risks carrying a repository defect identifier are traceable to DEFECT-BACKLOG.md, which remains the working record; this table is the specification-level view."
  )
);
add(
  T(
    ["ID", "Risk and description", "Prob.", "Impact", "Sev.", "Mitigation", "Contingency", "Owner", "Status"],
    [
      ["RISK-01", "Connection-pool exhaustion on concurrent attempt start (DB-01). Blueprint-mode start holds a transaction client while the assembler issues queries on the shared pool, which is capped at 4. Four or more simultaneous starts can deadlock, leaving every one of them stuck.", "Medium", "High", "High", "Thread the transaction client through the whole assembly pipeline so no query inside a transaction uses the shared pool. The identical defect in section-scheme loading has already been fixed this way.", "Restart the process to release sessions; throttle concurrent starts until fixed.", "Backend", "Open"],
      ["RISK-02", "Single-platform dependency. Identity, database and storage all come from one provider with a project-wide 15-session cap.", "Low", "High", "High", "Keep the connection budget well under the cap; keep the platform's status feed under observation.", "No fallback exists; an outage is an outage. Communicate to candidates.", "Platform", "Accepted"],
      ["RISK-03", "No monitoring or alerting. A failure is discovered by a user, not by the team.", "High", "High", "High", "Implement the alerting specification in Section 19.1, starting with health-check and error-rate alerts.", "Manual health checks after every deployment.", "Operations", "Open"],
      ["RISK-04", "Untested recovery. Backups are assumed to exist and have never been restored.", "Medium", "High", "High", "Confirm the backup configuration, then rehearse a restore into a scratch project and record RPO and RTO from the rehearsal.", "Content is reconstructible from import batches; candidate data would not be.", "Operations", "Open"],
      ["RISK-05", "Study materials unreachable (DB-06). Every catalogued unit-material link points at a Drive object that is not publicly shared; each redirects to a sign-in wall.", "High", "Medium", "High", "The owner of the Drive account must update sharing to 'anyone with the link, viewer'; the repository's access-check script then re-verifies. The application already handles the failure gracefully.", "Migrate materials into the platform's own object storage.", "Content owner (outside engineering)", "Open — cannot be fixed in code"],
      ["RISK-06", "Incomplete internationalisation (DB-05). Strings outside the resource dictionary render in English regardless of the selected language.", "High", "Medium", "Medium", "A screen-by-screen sweep wrapping remaining strings and adding dictionary entries, followed by a full click-through in Tamil.", "Document the limitation for Tamil-preferring candidates.", "Frontend", "Open"],
      ["RISK-07", "Client-side attempt state (DB-03). Attempt history in the application shell is in-memory and does not reflect server state after a reload, on a new device, or for a different signed-in user in the same tab.", "Medium", "Medium", "Medium", "Replace the in-memory history with server-backed reads everywhere it is consumed, and clear it on sign-out.", "Advise a page reload after switching accounts.", "Frontend", "Open"],
      ["RISK-08", "Partial translations. Around 8.6% of questions have no Tamil row, and a partially populated option-translation array leaves some options untranslated within one question.", "Medium", "Medium", "Medium", "Backfill missing translations; validate array completeness at import; show an explicit indicator instead of silently omitting.", "Bilingual display means the English text is always present.", "Content", "Open"],
      ["RISK-09", "Pipeline trigger mismatch. Continuous integration triggers on pull requests to main, while contributing guidance directs them at the product branch, so a compliant pull request may run no checks.", "High", "Medium", "Medium", "Widen the workflow trigger to include the product branch, or change the target branch. Either is a one-line change; leaving both as they are is not an option.", "Run the pipeline locally before merge.", "Engineering", "Open"],
      ["RISK-10", "Shared demonstration account. One fixed identity is used by every demonstration user, so leftover attempts from one session are visible to the next until the weekly reset.", "High", "Low", "Medium", "Per-viewer demonstration sandboxes, or a reset on each demonstration sign-in.", "The scheduled weekly reset plus the manual reset endpoint.", "Backend", "Open"],
      ["RISK-11", "No publish-time blueprint validation (DB-02). A fixed paper can be published that the pool cannot satisfy; the failure surfaces to a candidate at attempt time.", "Low", "Medium", "Low", "Attach feasibility validation to fixed-paper ingestion once it has an administrative route.", "The candidate receives a clear, structured pool-insufficiency error rather than a silent failure.", "Backend", "Open"],
      ["RISK-12", "No dependency vulnerability scanning. A known-vulnerable transitive dependency could ship unnoticed.", "Medium", "Medium", "Medium", "Add scheduled scanning and an automated update service to the pipeline.", "Ad-hoc audit before a release.", "Engineering", "Open"],
      ["RISK-13", "Unverified layout cases (DB-04). The fixed-viewport layout was verified at three widths, but long-text and tall-image questions were never exercised because the sample bank served short items.", "Medium", "Low", "Low", "Seed or locate representative long-text and tall-image questions and re-run the layout checks against them.", "None required; a defect here degrades presentation, not correctness.", "Frontend", "Open"],
      ["RISK-14", "Unclear stem label report (DB-07). A candidate reported a stray numbered label near a question stem; no such pattern exists in any published stem, so the suspicion falls on a rendered index leaking into or beside the stem container.", "Low", "Low", "Low", "Inspect the question-render component for an index or key value rendering adjacent to the stem.", "None.", "Frontend", "Open"],
    ],
    [0.6, 3.1, 1, 1, 1, 2.4, 1.7, 0.9, 0.9]
  ),
  TBL("Technical risk register")
);

/* ========================= 28. RUNBOOK ========================= */
add(PB(), H(1, "28. Operational Runbook"));
add(
  P(
    "Each runbook follows the same nine steps: symptoms, detection, immediate action, investigation, resolution, verification, rollback or recovery, escalation, post-incident actions. Escalation targets are [INPUT REQUIRED] until an on-call rota exists; the placeholder is deliberate, because naming a rota that does not exist would be worse than admitting there is none."
  )
);

function runbook(id, title, rows) {
  add(H(2, id + " " + title));
  add(T(["Step", "Action"], rows, [0.8, 4.4]), TBL("Runbook — " + title));
}

runbook("28.1", "Application unavailable", [
  ["Symptoms", "The site does not load, or every request times out or returns 502 or 503."],
  ["Detection", "Uptime check on GET /api/health (once configured); user report."],
  ["Immediate action", "Confirm the process is running and check the platform's process status and recent deployments. Confirm the platform edge itself is healthy."],
  ["Investigation", "Read the process log from the last successful start. Distinguish: crash at boot (configuration validation failure prints every offending key and exits), crash at runtime (stack in the log), or the process running but not serving (NODE_ENV not set to production, so the SPA is not served)."],
  ["Resolution", "Correct the configuration and restart, or redeploy the last known-good revision."],
  ["Verification", "GET /api/health returns a healthy payload; GET / returns index.html and not a JSON stub; a sign-in and a scored attempt complete."],
  ["Rollback", "Redeploy the previous revision. If the failed release carried a migration, check for a reversal script before rolling back; otherwise roll forward."],
  ["Escalation", "[INPUT REQUIRED]"],
  ["Post-incident", "Record the cause; add a check that would have caught it; if it was configuration, extend boot validation."],
]);

runbook("28.2", "API latency increased", [
  ["Symptoms", "Slow page loads; long waits when starting or submitting an attempt."],
  ["Detection", "Latency alert (once implemented); user report."],
  ["Immediate action", "Check the platform status feed for the data platform and identity provider — every authenticated request depends on both."],
  ["Investigation", "Distinguish three causes: identity-provider latency (adds to every authenticated request), database round-trip latency (dominant at roughly 250-300 ms per trip, so an operation making many trips is the first suspect), and pool saturation (requests queueing for one of four connections)."],
  ["Resolution", "Reduce round trips in the offending operation; increase the pool only within the project's session cap; restart to clear leaked sessions."],
  ["Verification", "Latency returns to its usual band for attempt start, submission and question reads."],
  ["Rollback", "Revert the change that introduced the additional round trips."],
  ["Escalation", "[INPUT REQUIRED]"],
  ["Post-incident", "Add a timing metric for the affected operation."],
]);

runbook("28.3", "Database unavailable", [
  ["Symptoms", "Every data path fails; the health endpoint reports a database failure; 500 responses across the board."],
  ["Detection", "Health check; error-rate alert."],
  ["Immediate action", "Check the platform status page and the project's own dashboard. Confirm the connection string and any network allow-list have not changed."],
  ["Investigation", "Distinguish an outage from exhaustion: a pooler at its session cap reports a distinct error and is usually self-inflicted (leaked sessions from repeated restarts, or RISK-01)."],
  ["Resolution", "For exhaustion, restart the process to release sessions and confirm graceful shutdown is closing pools. For a platform outage, wait; the application recovers without a restart once connectivity returns."],
  ["Verification", "Health endpoint healthy; a read and a write both succeed."],
  ["Rollback", "Not applicable."],
  ["Escalation", "[INPUT REQUIRED]; the platform provider for an outage."],
  ["Post-incident", "Add pool-utilisation monitoring; prioritise RISK-01 if exhaustion recurred."],
]);

runbook("28.4", "Database performance degradation", [
  ["Symptoms", "Queries slow but succeeding; attempt start and dashboard noticeably slower."],
  ["Detection", "Latency alert; user report."],
  ["Immediate action", "Check the platform's query insights for the slowest statements and for lock waits."],
  ["Investigation", "Compare against the indexes added for analytics and the hot attempt paths. Check whether table growth has outpaced an index, and whether a recent migration changed a plan."],
  ["Resolution", "Add or correct an index through a new migration with its verification script; never by hand on the live database."],
  ["Verification", "The slow statement's plan improves and end-to-end latency recovers."],
  ["Rollback", "Drop the added index in a forward migration if it made matters worse."],
  ["Escalation", "[INPUT REQUIRED]"],
  ["Post-incident", "Record the query and its plan in the operational notes."],
]);

runbook("28.5", "Queue backlog", [
  ["Symptoms", "Not applicable at this baseline — there is no message broker or job queue."],
  ["Detection", "n/a"],
  ["Immediate action", "The nearest equivalent is the expiry sweeper falling behind or stopping: attempts stay in progress past their deadline."],
  ["Investigation", "Confirm the process is running and that the sweeper logs a cycle when it finds work. Confirm the interval was not stopped by a shutdown path without a restart."],
  ["Resolution", "Restart the process. If a backlog of expired attempts exists, the next cycle closes them all; the manual sweep script can also be run."],
  ["Verification", "No attempt remains in progress with a deadline in the past."],
  ["Rollback", "n/a"],
  ["Escalation", "[INPUT REQUIRED]"],
  ["Post-incident", "Add the sweeper-silence alert from Section 19.1."],
]);

runbook("28.6", "External service outage (identity, storage or Drive)", [
  ["Symptoms", "Identity: every authenticated route returns 401 while public reads work. Storage: images missing. Drive: materials will not open."],
  ["Detection", "Error-rate alert; user report."],
  ["Immediate action", "Identify which provider is affected and check its status feed."],
  ["Investigation", "For identity, confirm the failure is provider-side rather than a configuration change (a rotated key, a changed project URL, or a content security policy that no longer admits the origin)."],
  ["Resolution", "Provider outage: wait and communicate. Configuration: correct the variable and restart."],
  ["Verification", "Sign-in succeeds; an image-bearing question renders its image; a material opens."],
  ["Rollback", "Restore the previous configuration value."],
  ["Escalation", "[INPUT REQUIRED]"],
  ["Post-incident", "For Drive specifically, re-run the material access-check script — the recurring cause there is sharing configuration, not an outage."],
]);

runbook("28.7", "Deployment failure", [
  ["Symptoms", "The deployment does not complete, or the new revision starts and immediately exits."],
  ["Detection", "Deployment output; health check failing after release."],
  ["Immediate action", "Read the first 50 lines of the process log: configuration validation failure lists every offending key by name."],
  ["Investigation", "Check the ordering of the release: migrations must be applied before the code that depends on them, and the code must tolerate the previous schema during the changeover."],
  ["Resolution", "Correct the configuration or the ordering and redeploy."],
  ["Verification", "Health endpoint healthy; the SPA is served at the root; a scored attempt completes."],
  ["Rollback", "Redeploy the previous revision. If a migration has been applied, roll forward instead unless a reversal script exists for it."],
  ["Escalation", "[INPUT REQUIRED]"],
  ["Post-incident", "Add the missed check to the pipeline."],
]);

runbook("28.8", "Certificate expiration", [
  ["Symptoms", "Browsers refuse the connection with a certificate warning."],
  ["Detection", "Expiry alert (once configured); user report."],
  ["Immediate action", "Identify the certificate's owner: at this baseline TLS is terminated by the hosting platform, so renewal is usually automatic."],
  ["Investigation", "Confirm whether renewal automation failed or a manual certificate was used."],
  ["Resolution", "Renew through the platform. Application configuration is unaffected."],
  ["Verification", "The certificate chain validates and the expiry date is in the future."],
  ["Rollback", "n/a"],
  ["Escalation", "[INPUT REQUIRED]"],
  ["Post-incident", "Ensure the 14-day expiry alert exists."],
]);

runbook("28.9", "Storage exhaustion", [
  ["Symptoms", "Writes fail; the platform reports a quota or disk limit."],
  ["Detection", "Platform alert."],
  ["Immediate action", "Identify which store is full: the database, the object storage bucket, or the host's own disk."],
  ["Investigation", "Database growth is dominated by attempt-related rows, which grow with usage. Object storage grows only with content imports."],
  ["Resolution", "Raise the quota, or reclaim space by removing orphaned assets and pruning data whose retention has expired — once a retention policy exists (TBD-03)."],
  ["Verification", "Writes succeed and utilisation is back within its normal band."],
  ["Rollback", "n/a"],
  ["Escalation", "[INPUT REQUIRED]"],
  ["Post-incident", "Add growth monitoring; define retention if it is still undefined."],
]);

runbook("28.10", "Data corruption or suspected incorrect scoring", [
  ["Symptoms", "A scorecard that does not match the responses; an attempt in an impossible state; a duplicate item in one paper."],
  ["Detection", "Candidate report; a failing verification script; an internal inconsistency check."],
  ["Immediate action", "Do not modify the data. Capture the attempt identifier, its served set, its responses and its scorecard as they stand."],
  ["Investigation", "Re-run assembly with the persisted generation seed to reproduce the served set, then re-evaluate the responses with the same rules. The scoring modules are pure, so a discrepancy isolates to data (rules, keys, served set) rather than to arithmetic."],
  ["Resolution", "Correct the underlying data through a migration or a reviewed script; re-score the affected attempts deliberately and record what was changed and why."],
  ["Verification", "The recomputed scorecard matches the corrected data; section totals sum to the attempt total."],
  ["Recovery", "If corruption is broad, restore from backup (see 28.11 and Section 21)."],
  ["Escalation", "[INPUT REQUIRED] — a scoring error is a candidate-facing integrity issue and should be escalated on discovery, not after diagnosis."],
  ["Post-incident", "Add a regression case; consider an automated consistency check over recent scorecards."],
]);

runbook("28.11", "Security incident", [
  ["Symptoms", "Suspected credential exposure, unauthorised access, unexpected administrative action, or answer-key disclosure."],
  ["Detection", "Report, anomalous behaviour, or a secret found in a commit or log."],
  ["Immediate action", "Contain first: rotate the exposed credential at the provider — the service-role key above all — and force sign-out for affected accounts. Preserve evidence before changing anything else."],
  ["Investigation", "Determine what the credential could reach. The service-role key bypasses row-level security and reaches the identity admin API, so its exposure is the most severe case. Establish scope and timeline from whatever records exist, noting that security logging is currently a gap."],
  ["Resolution", "Rotate every affected secret, revoke sessions, close the exposure path, and remove the secret from history if it was committed."],
  ["Verification", "The old credential no longer authenticates; affected sessions are terminated; the exposure path is closed and covered by a test where possible."],
  ["Recovery", "If data was altered, follow 28.10 and Section 21."],
  ["Escalation", "[INPUT REQUIRED] — a security incident requires named owners and a communication path; neither is currently defined, which is itself an open item."],
  ["Post-incident", "Write the incident up; implement the security logging that would have shortened detection; review whether the credential needed that scope at all."],
]);

/* ========================= 29. MAINTENANCE AND SUPPORT ========================= */
add(PB(), H(1, "29. Maintenance and Support"));
add(
  T(
    ["Activity", "Cadence", "Owner", "Notes"],
    [
      ["Dependency updates", "[TBD] — quarterly recommended", "Engineering", "Gated on the full pipeline; upgrade the direct set deliberately rather than accepting every automated bump"],
      ["Security patching", "On advisory", "Engineering", "Requires the vulnerability scanning that does not yet exist (RISK-12)"],
      ["Runtime and platform updates", "As the platform requires", "Platform", "Node major upgrades require re-testing the ESM bundle"],
      ["Database maintenance", "Platform-managed", "Platform", "Index review after significant data growth; every change goes through a migration"],
      ["Certificate renewal", "Automatic", "Platform", "Alert at 14 days remaining"],
      ["Content maintenance", "Per import cycle", "Content administration", "Import, review, publish; run duplicate detection after each batch"],
      ["Demonstration account reset", "Weekly, Mondays 03:00 UTC, plus manual dispatch", "Automated", "Requires the publishable-key secret to be configured for the workflow to succeed"],
      ["Backup verification", "[TBD] — quarterly restore rehearsal recommended", "Operations", "Currently never performed (RISK-04)"],
      ["Monitoring maintenance", "n/a until monitoring exists", "Operations", "RISK-03"],
      ["Technical-debt review", "Per release", "Technical lead", "Standing items: close RISK-01, remove the residual ORM dependency, complete the internationalisation sweep, make attempt history server-backed"],
      ["Documentation review", "Per release", "Technical lead", "This document is reviewed and re-versioned whenever architecture, interfaces or schema change"],
    ],
    [1.5, 1.3, 1, 3]
  ),
  TBL("Routine maintenance")
);
add(
  T(
    ["Support aspect", "Specification"],
    [
      ["Support ownership", "[INPUT REQUIRED]. The repository names three maintainers; a formal support rota does not exist."],
      ["Support channels", "Repository issues today. A candidate-facing support channel is [TO BE DEFINED]."],
      ["Severity definitions", "SEV-1 service unavailable or assessment integrity compromised; SEV-2 major function degraded; SEV-3 minor defect with a workaround; SEV-4 cosmetic. Response and resolution targets are [TBD]."],
      ["Escalation path", "[INPUT REQUIRED]."],
      ["On-call", "None. Out-of-hours failures are detected on the next working day, which is a direct consequence of RISK-03."],
      ["Knowledge base", "The docs/ directory holds phase trackers, debug plans, defect logs and operational notes; this document is the specification-level entry point."],
    ],
    [1.2, 4.2]
  ),
  TBL("Support model")
);

/* ========================= 30. TECHNICAL ACCEPTANCE CRITERIA ========================= */
add(PB(), H(1, "30. Technical Acceptance Criteria"));
add(
  P(
    "A release is technically accepted when every criterion below is demonstrably met. Criteria that cannot be met at this baseline are marked, so that acceptance is an honest gate rather than a formality."
  )
);
add(
  T(
    ["ID", "Criterion", "Evidence", "Status at baseline"],
    [
      ["AC-01", "All must-priority functional requirements are implemented and their acceptance criteria demonstrated.", "Section 31 matrix with test results", "Substantially met; see matrix"],
      ["AC-02", "All must-priority non-functional requirements are met, or an accepted deviation is recorded.", "Section 3.2 with measurements", "Not met — performance, availability and accessibility targets are unset"],
      ["AC-03", "No pre-submission payload exposes an answer key, solution or answer-key-adjacent asset.", "Contract test", "Met"],
      ["AC-04", "Every user-owned read path filters by the caller's identifier, verified by isolation tests.", "Cross-user isolation tests", "Met"],
      ["AC-05", "Scoring is exact, idempotent and correct under concurrent submission.", "Scoring and concurrency unit tests", "Met"],
      ["AC-06", "TypeScript typecheck passes with zero errors.", "Pipeline", "Met"],
      ["AC-07", "The full unit and end-to-end suites pass in the pipeline.", "Pipeline", "Met when the database secret is configured; otherwise end-to-end is skipped with a visible warning"],
      ["AC-08", "No critical or high defect is open against the release scope.", "Defect backlog", "Not met — RISK-01 is open"],
      ["AC-09", "Every migration in the release has a verification script and has been applied to the target environment in order.", "Migration ledger and verify output", "Met by process"],
      ["AC-10", "Monitoring and alerting are configured for the alerts in Section 19.1.", "Monitoring configuration", "Not met (RISK-03)"],
      ["AC-11", "Backups are configured and a restore has been rehearsed within the last quarter.", "Restore rehearsal record", "Not met (RISK-04)"],
      ["AC-12", "Disaster recovery objectives are defined and demonstrated.", "DR test record", "Not met"],
      ["AC-13", "Deployment is validated by a smoke test: health endpoint, SPA served at the root, sign-in, and one scored attempt.", "Smoke-test record", "Met by process"],
      ["AC-14", "No secret appears in source control, logs, the client bundle or this document.", "Review and scanning", "Met by review; automated scanning outstanding"],
      ["AC-15", "This document is updated to match the release.", "Revision history", "Met at issue"],
      ["AC-16", "Operational readiness confirmed: runbooks current, escalation named, support ownership assigned.", "Sections 28 and 29", "Not met — escalation and ownership are [INPUT REQUIRED]"],
    ],
    [0.6, 3.4, 1.6, 2.2]
  ),
  TBL("Technical acceptance criteria")
);

/* ========================= 31. TRACEABILITY MATRIX ========================= */
add(PB(), H(1, "31. Traceability Matrix"));
add(
  P(
    "Each requirement is traced to its design component, its API surface, its principal database entities, the test asset that discharges it, whether an acceptance criterion is stated in Section 3.1.6, and its implementation status. A test entry of 'None' is a genuine coverage gap and should be read as such."
  )
);
add(
  T(
    ["Req", "Component", "API", "Entity", "Test asset", "AC", "Status"],
    [
      ["FR-001", "7.3", "n/a (client to provider)", "core.app_user", "tests/happy-path.spec.ts", "—", "Implemented"],
      ["FR-002", "7.3", "All authenticated", "core.app_user", "session.service.test.ts", "3.1.6", "Implemented"],
      ["FR-003", "7.2", "API-002, API-003", "core.app_user, legacy profile", "None", "—", "Implemented"],
      ["FR-004", "7.2", "API-004", "core.app_user, learn.audit_log", "None", "—", "Implemented"],
      ["FR-005", "7.3", "All authenticated", "core.user_session", "session.service.test.ts, useIdleSessionGuard.test.ts", "3.1.6", "Implemented"],
      ["FR-006", "7.3", "API-006", "core.user_session", "useIdleSessionGuard.test.ts", "—", "Implemented"],
      ["FR-007", "7.3", "API-007", "core.user_session", "None", "—", "Implemented"],
      ["FR-008", "7.2, 7.9", "API-008", "assess.attempt (demo account)", "happy-path.spec.ts", "—", "Implemented (RISK-10)"],
      ["FR-009", "7.2", "API-013", "catalog.*", "None", "—", "Implemented"],
      ["FR-010", "7.2, 7.7", "API-010", "content.question, question_option", "questionController.test.ts, happy-path.spec.ts", "—", "Implemented"],
      ["FR-011", "7.2", "API-011", "content.question", "questionController.test.ts", "3.1.6", "Implemented"],
      ["FR-012", "7.7", "API-010, API-036, API-046", "content.asset", "None (verified by script)", "3.1.6", "Implemented"],
      ["FR-013", "7.5, 7.7", "API-036", "content.question_translation", "None", "—", "Implemented (RISK-08)"],
      ["FR-014", "7.7", "API-022 to API-025", "content.question, question_review", "db/content/*.test.ts", "3.1.6", "Implemented"],
      ["FR-015", "7.7", "Scripts", "content.import_batch, import_row", "db/content/*.test.ts", "—", "Implemented"],
      ["FR-016", "7.7", "Scripts", "content.question_duplicate_candidate, _dedup_repoint", "db/scripts/dedup/*.test.ts, fingerprint-normalizer.test.ts", "—", "Implemented"],
      ["FR-017", "7.2", "API-066", "learn.unit_material", "None", "—", "Implemented (RISK-05 blocks end-to-end use)"],
      ["FR-018", "7.5", "API-030", "content.question, assess.test_blueprint", "generation/availability.test.ts", "3.1.6", "Implemented"],
      ["FR-019", "7.5", "API-031", "assess.test, test_section, attempt", "happy-path.spec.ts", "—", "Implemented"],
      ["FR-020", "7.5", "API-032", "assess.test, test_blueprint", "definition/test-code.test.ts", "—", "Implemented"],
      ["FR-021", "7.5", "API-031, API-035", "assess.attempt_question, user_question_seen", "assemble.test.ts, repeat-rotation.test.ts, scope-prefix-match.test.ts, image-only-blueprint.test.ts, reproduce-assembly.test.ts", "3.1.6", "Implemented"],
      ["FR-022", "7.5", "API-031, API-035", "assess.attempt", "concurrent-generation.test.ts", "3.1.6", "Implemented"],
      ["FR-023", "7.5", "API-036", "assess.attempt_question", "None (contract test recommended)", "3.1.6", "Implemented — coverage gap"],
      ["FR-024", "7.5", "API-039, API-040", "assess.attempt_response", "None", "—", "Implemented — coverage gap"],
      ["FR-025", "7.5", "API-042, API-043", "assess.attempt_pause", "None", "—", "Implemented — coverage gap"],
      ["FR-026", "7.6", "API-044", "assess.scorecard, section_score", "scoring/evaluate, rules, aggregate, decimal tests", "3.1.6", "Implemented"],
      ["FR-027", "7.9", "n/a (background)", "assess.attempt", "expiry-sweeper.test.ts", "3.1.6", "Implemented"],
      ["FR-028", "7.5", "API-031, API-035", "assess.attempt", "concurrent-generation.test.ts", "3.1.6", "Implemented"],
      ["FR-029", "7.6", "API-045", "assess.scorecard, section_score", "aggregate.test.ts", "—", "Implemented"],
      ["FR-030", "7.5", "API-046", "assess.attempt_response, content.question_solution", "MyResultsView.test.tsx", "—", "Implemented"],
      ["FR-031", "7.8", "API-047", "assess.attempt_response", "irt-model.test.ts", "—", "Implemented"],
      ["FR-032", "7.8", "API-048", "assess.scorecard", "None", "—", "Implemented — coverage gap"],
      ["FR-033", "7.3", "All authenticated", "assess.attempt", "None", "3.1.6", "Implemented — coverage gap"],
      ["FR-034", "7.8", "API-050", "assess.*, catalog.*", "None", "—", "Implemented"],
      ["FR-035", "7.5", "n/a (internal)", "assess.user_question_seen, content.question_usage", "anti-repeat-exposure.test.ts, recycled-items.test.ts", "—", "Implemented"],
      ["FR-036", "7.2", "API-060 to API-062", "learn.study_plan, plan_task, study_plan_goal", "None", "—", "Implemented"],
      ["FR-037", "7.2", "API-063, API-064", "learn.flashcard, flashcard_review", "None", "—", "Implemented"],
      ["FR-038", "7.2", "API-063", "learn.revision_note", "None", "—", "Implemented"],
      ["FR-039", "7.2", "API-063", "learn.pomodoro_session", "None", "—", "Implemented"],
      ["FR-040", "7.2", "API-063", "learn.error_log", "None", "—", "Implemented"],
      ["FR-041", "7.2", "API-063, API-065", "learn.notification", "None", "—", "Implemented"],
      ["FR-042", "7.2", "API-063", "learn.custom_task", "None", "—", "Implemented"],
      ["FR-043", "7.8", "API-050", "learn.topic_mastery", "None", "—", "Implemented"],
      ["FR-044", "7.1", "n/a (client)", "n/a", "None", "—", "Implemented"],
      ["FR-045", "7.2", "API-070", "core.invitation", "None", "—", "Implemented"],
      ["FR-046", "7.2", "API-071", "core.app_user, institution", "None", "3.1.6", "Implemented — coverage gap"],
      ["FR-047", "7.2", "API-071, API-072", "core.app_user, user_role_assignment", "None", "—", "Implemented"],
      ["FR-048", "7.2", "API-073", "core.app_user, user_session", "None", "—", "Implemented"],
      ["FR-049", "7.2", "API-051", "core.*, assess.*", "None", "—", "Implemented"],
      ["FR-050", "7.3", "All permission-gated", "core.role, permission, role_permission", "None", "—", "Implemented — coverage gap"],
      ["FR-051", "7.2", "API-001", "n/a", "happy-path.spec.ts", "—", "Implemented"],
      ["FR-052", "7.2", "All", "n/a", "happy-path.spec.ts (negative cases)", "3.1.6", "Implemented"],
      ["FR-053", "7.2", "API-090, API-091", "n/a", "happy-path.spec.ts", "—", "Implemented"],
    ],
    [0.7, 0.9, 1.6, 2, 2.6, 0.6, 1.5]
  ),
  TBL("Master traceability matrix")
);
add(
  NOTE(
    "Coverage observation",
    "The heaviest automated coverage sits where the risk is — scoring, assembly, exposure, expiry, isolation and deduplication. The clearest gaps are the response-save and pause/resume paths, attempt lockdown, permission enforcement, tenancy narrowing, and a contract test asserting answer-key absence. Those are the tests to write next."
  )
);

/* ========================= 32. TBD REGISTER ========================= */
add(PB(), H(1, "32. Open Questions and TBD Register"));
add(
  P(
    "Every [TBD], [TO BE DEFINED] and [INPUT REQUIRED] marker in this document appears here. Nothing in this document assumes an answer to any of these; where a decision was needed to keep the specification coherent, it is recorded as a decision in Section 26, not smuggled in as an assumption."
  )
);
add(
  T(
    ["ID", "Question or missing information", "Impact if unresolved", "Owner", "Required by", "Status"],
    [
      ["TBD-01", "Which hosting platform runs the application process?", "Sections 5.4, 5.7, 14 and 15 cannot be completed; deployment stays manual", "Technical owner", "Before production launch", "Open"],
      ["TBD-02", "Backup frequency, retention and point-in-time recovery window on the database plan", "RPO cannot be stated; RISK-04 stays open", "Operations", "Before production launch", "Open"],
      ["TBD-03", "Retention periods per data class (attempts, scorecards, exposure ledgers, sessions, logs)", "No lawful basis for indefinite retention; no pruning possible; Section 25 stays open", "Product owner and legal", "Before production launch", "Open"],
      ["TBD-04", "Secret storage mechanism beyond environment variables", "Rotation is manual and unaudited", "Operations", "Before production launch", "Open"],
      ["TBD-05", "Pagination contract for collection endpoints", "Collections grow unbounded; response sizes degrade", "Backend", "Before any collection exceeds a few hundred rows", "Open"],
      ["TBD-06", "Rate limiting at the edge: limits, scope and response", "No protection against volumetric abuse (THR-10)", "Operations", "Before public launch", "Open"],
      ["TBD-07", "Network controls: ingress restriction, web application firewall, database allow-listing", "Attack surface unbounded at the network layer", "Operations", "Before public launch", "Open"],
      ["TBD-08", "Identity-provider policy: password rules, multi-factor, lockout, session length", "Section 12.2 is incomplete; account-security posture unknown", "Technical owner", "Before public launch", "Open"],
      ["TBD-09", "Published snapshot of the role-to-permission matrix per release", "Reviewers cannot verify authorisation without database access", "Backend", "Next release", "Open"],
      ["TBD-10", "Dependency vulnerability scanning and update service in the pipeline", "RISK-12 stays open", "Engineering", "Next release", "Open"],
      ["TBD-11", "Vulnerability intake, triage and disclosure process", "No route for a reported vulnerability", "Security", "Before public launch", "Open"],
      ["TBD-12", "Infrastructure as code for environment creation", "Environments drift and cannot be recreated reliably", "Operations", "Before staging exists", "Open"],
      ["TBD-13", "Reconcile the pipeline trigger branch with the contributing guidance", "RISK-09: compliant pull requests may run no checks", "Engineering", "Immediately", "Open"],
      ["TBD-14", "Adopt a linter and formatter alongside the typecheck", "Style and correctness issues the compiler does not catch go unflagged", "Engineering", "Next release", "Open"],
      ["TBD-15", "Release versioning and tagging scheme", "Releases are not identifiable; rollback targets are ambiguous", "Technical lead", "Next release", "Open"],
      ["TBD-16", "Feature-flag mechanism", "Risky changes cannot be dark-launched or disabled without a deploy", "Backend", "When needed", "Open"],
      ["TBD-17", "Circuit breaker for identity-provider calls", "A provider slowdown propagates to every request", "Backend", "After monitoring exists", "Open"],
      ["TBD-18", "Transitive dependency licence audit", "Licence obligations unknown", "Engineering", "Before commercial launch", "Open"],
      ["TBD-19", "API versioning strategy before any external consumer", "A breaking change would break an external client (ADR-009)", "Backend", "Before an external client exists", "Open"],
      ["TBD-20", "Accessibility target and audit (WCAG 2.1 AA assumed)", "NFR-A11Y-001 unverifiable; possible legal exposure", "Frontend and product", "Before public launch", "Open"],
      ["TBD-21", "Applicable jurisdictions, minors' data handling, and the resulting obligations", "Section 25 cannot be closed; compliance posture unknown", "Product owner and legal", "Before public launch", "Open"],
      ["TBD-22", "Cohort definition for cohort comparison, and the minimum item count for a meaningful ability estimate", "Reports may mislead on sparse data", "Product owner", "Next analytics change", "Open"],
      ["TBD-23", "Subscription plan entitlements and billing model", "core.subscription_plan carries no defined semantics", "Product owner", "Before monetisation", "Open"],
      ["TBD-24", "Document control metadata: owner, approvers, reviewers, distribution and classification", "This document cannot be formally approved", "Technical owner", "Before first approval", "Open"],
      ["TBD-25", "Supported browser and device matrix", "NFR-COMPAT-001 unverifiable", "Product owner", "Before public launch", "Open"],
      ["TBD-26", "Monitoring stack, correlation identifiers and dashboards", "RISK-03 stays open; incidents are user-detected", "Operations", "Before production launch", "Open"],
      ["TBD-27", "Availability, latency and capacity targets (service-level objectives)", "Sections 3.2, 20 and 21 remain unquantified", "Product owner and technical owner", "Before production launch", "Open"],
      ["TBD-28", "Support ownership, severity response targets, escalation path and on-call rota", "Section 29 and every runbook escalation step stay unfilled", "Technical owner", "Before production launch", "Open"],
    ],
    [0.6, 3.2, 2.4, 1.2, 1.3, 0.7]
  ),
  TBL("Open questions and TBD register")
);

/* ========================= 33. APPENDICES ========================= */
add(PB(), H(1, "33. Appendices"));

add(H(2, "Appendix A — Glossary"));
add(
  T(
    ["Term", "Definition"],
    [
      ["Attempt", "One candidate's single sitting of one test, from start to scored or abandoned. The unit of assessment integrity in this system."],
      ["Attempt envelope", "The payload delivered to the client to render an attempt: the served items in order, the server's current time and the remaining seconds. Contains no answer key."],
      ["Assembler", "The read-only component that selects items per blueprint line from the published pool for one attempt."],
      ["Blueprint", "The specification of what a paper must contain: how many items, from which scope, at which difficulty, in which section."],
      ["Canonical user", "The core.app_user record that all domain data references, distinct from the identity provider's subject and from the legacy profile record."],
      ["Content lifecycle", "The state machine a question moves through: draft, in review, approved, published, retired."],
      ["Exposure ledger", "The record of which items a candidate has already been served, used to avoid repetition in later papers."],
      ["Fingerprint", "A normalised hash of a question's content or structure, used to detect duplicates."],
      ["Fixed paper", "A test whose exact item set is specified in advance, as opposed to blueprint mode where items are assembled per attempt."],
      ["Generation seed", "The value persisted with an attempt that makes its assembly and ordering reproducible."],
      ["Marking scheme", "The stored rules that determine marks for correct, incorrect, unattempted, partially correct and voided responses."],
      ["Ownership check", "A query predicate restricting rows to the calling user; transitive ownership resolves it through a parent entity."],
      ["Scorecard", "The persisted result of scoring one attempt, with per-section scores."],
      ["Served set", "The exact items presented in one attempt, persisted at start."],
      ["Session (application)", "This application's own session record enforcing idle and absolute limits, distinct from the identity provider's token session."],
      ["Sweeper", "The background job that closes attempts whose deadline has passed without a client submission."],
      ["Syllabus node", "A node in the hierarchical curriculum tree to which questions are mapped."],
      ["Tenancy narrowing", "Restricting an administrative operation to the caller's own institution, performed in the service layer."],
    ],
    [1, 4.2]
  ),
  TBL("Glossary")
);

add(H(2, "Appendix B — Acronyms"));
add(
  P(
    "The acronym list is held in the front matter of this document (List of Acronyms), immediately before Section 1, so that a reader meets it before the text rather than after it. It is not repeated here."
  )
);

add(H(2, "Appendix C — API reference"));
add(
  P(
    "The complete endpoint inventory is in Section 8.2; per-endpoint specifications for the endpoints carrying invariants are Sections 8.3 to 8.7; the error catalogue is in Section 18.2. The implementation is authoritative and lives in backend/src/routes and backend/src/controllers. A machine-readable specification (OpenAPI) does not exist and would be a worthwhile addition."
  )
);

add(H(2, "Appendix D — Database schema"));
add(
  P(
    "The entity inventory is in Section 9.3; the entity-relationship model is in Section 9.4; detailed table specifications for the core entities are in Section 9.5. The authoritative schema is the ordered set of files in db/migrations, each with its assertion script in db/verify. The applied state of any environment is readable from util.applied_migration."
  )
);

add(H(2, "Appendix E — Index of figures by type"));
add(
  T(
    ["Diagram type", "Figure"],
    [
      ["System context", "Figure 1"],
      ["High-level architecture", "Figure 2"],
      ["Deployment architecture", "Figure 3"],
      ["Component architecture (request chain)", "Figure 4"],
      ["Integration architecture", "Figure 5"],
      ["API examples", "Figures 6 and 7"],
      ["Database ER model", "Figure 8"],
      ["Data flow", "Figure 9"],
      ["Sequence — authentication", "Figure 10"],
      ["Sequence — attempt lifecycle", "Figure 11"],
      ["Authentication and authorisation flow", "Figure 12"],
      ["Deployment pipeline", "Figure 13"],
      ["CI/CD pipeline", "Figure 14"],
      ["Error-handling decision flow", "Figure 15"],
      ["Disaster-recovery architecture", "Figure 16"],
    ],
    [1.6, 1]
  ),
  TBL("Index of figures by diagram type")
);
add(
  NOTE(
    "Note",
    "Figure numbers in this table are as allocated in document order; the List of Figures in the front matter is the authoritative index. No network-topology diagram is included because the hosting topology is undetermined (TBD-01); Section 5.7 specifies the network paths in tabular form instead of drawing a topology that does not yet exist."
  )
);

add(H(2, "Appendix F — Error code reference"));
add(P("See Section 18.2. The implementation is backend/src/middleware/errorHandler.ts and the typed error classes in db/shared/errors.ts."));

add(H(2, "Appendix G — Configuration reference"));
add(P("See Section 23. The authoritative definitions are backend/src/config/env.ts, db/config/env.ts and the template .env.example, which is kept in step with both."));

add(H(2, "Appendix H — References"));
add(
  T(
    ["Reference", "Location", "Nature"],
    [
      ["Repository README", "README.md", "Setup, scripts, environment variables, deployment notes"],
      ["Recon of the assessment subsystem", "CONTEXT.md", "Evidence-based code reading with file and line citations"],
      ["Defect backlog", "DEFECT-BACKLOG.md", "Open defects noticed outside the scope of the pass that found them"],
      ["Completion programme tracker", "docs/APP_COMPLETION_PLAN.md", "Authoritative running status by phase, with evidence"],
      ["Database state", "docs/DB_STATE.md", "Live schema inventory"],
      ["Open items against the brief", "docs/OPEN_ITEMS.md", "Where the repository contradicts earlier design assumptions"],
      ["Happy path", "docs/HAPPY_PATH.md", "Expected user journey for manual verification"],
      ["Core layer operations", "docs/CORE_LAYER_OPERATIONS.md", "Seeding order and operational procedures"],
      ["Content contract", "docs/CL1_CONTENT_CONTRACT.md, schemas/", "Import batch JSON contract"],
      ["Deduplication thresholds", "docs/QUESTION_DEDUP_THRESHOLDS.md", "Fingerprint and duplicate-detection parameters"],
      ["Test engine and hardening trackers", "docs/ENGINE_STATE.md, docs/TEST_LAYER_HARDENING_TRACKER.md", "Assessment engine design and hardening history"],
      ["Migration set", "db/migrations/, db/verify/", "Authoritative schema"],
    ],
    [1.6, 1.8, 2]
  ),
  TBL("References")
);

add(H(2, "Appendix I — Change history"));
add(
  P(
    "Document revision history is maintained in the front matter of this document. Product change history is maintained in the repository's phase trackers under docs/ and in the commit history; no release-notes process exists yet (TBD-15)."
  )
);

module.exports = c;
