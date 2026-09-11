# Core layer endpoint catalogue

LA-BE-CORE-002 CL-P8 task 4. Every endpoint the identity/user/session/profile surface exposes, as actually implemented — not as originally planned. Base path: `/api`. Every endpoint below requires `Authorization: Bearer <supabase access token>` unless stated otherwise.

## Identity / profile (CL-P3, CL-P4)

### `GET /me`
- **Permission:** any authenticated user (self only).
- **Tenancy:** none — always the caller's own row.
- **Success:** `200 { user: FullProfile }` — see `backend/services/meProfile.service.ts`'s `FullProfile` shape (identity, `core.app_user` fields, institution, active role grants, `studentProfile`).
- **Errors:** `401 UNAUTHORIZED` (missing/invalid token), `404 USER_NOT_FOUND` (should not occur in practice — provisioning runs first in the same middleware).

### `PATCH /me`
- **Permission:** any authenticated user (self only).
- **Body:** `{ fullName?, mobileNumber?, preferredLanguage?, targetExam?, studentProfile?: { targetYear?, classLevel?, guardianContact?, dailyStudyMinutes?, onboardingState? } }` — `.strict()`, any other field is rejected outright, not ignored.
- **Success:** `200 { user: FullProfile }` (fresh, post-update).
- **Errors:** `400 VALIDATION_ERROR` (schema violation, including any forbidden field), `401 UNAUTHORIZED`.
- **Cannot be changed here:** email, status, role, institution, `appUserId`/`authUserId`, `lastLoginAt` — admin/verification-only.

## Invitations (CL-P6 task 5)

All four routes require `users:invite`. Delivery is Supabase's own `admin.inviteUserByEmail` (link-based, shares the two-per-hour project email quota) — see `db/migrations/015_core_invitation.sql` for why this is deliberately not code-based like CL-P2.

### `POST /admin/invitations`
- **Body:** `{ email, roleCode: "platform_admin"|"institution_admin"|"educator", institutionId? }`.
- **Authority:** the caller's best role must strictly outrank `roleCode` (`backend/lib/permissions.ts`'s `canGrantRole`). An institution-scoped caller (`institution_admin`) may only name their own institution; a platform-scoped caller (`super_admin`/`platform_admin`) may name any institution or none.
- **Success:** `201 { data: invitation }`.
- **Errors:** `403 FORBIDDEN` (authority or tenancy), `400 VALIDATION_ERROR` (missing required `institutionId` for `institution_admin`/`educator`), `409 INVITATION_ALREADY_PENDING`, `502 INVITE_SEND_FAILED`.

### `GET /admin/invitations`
- **Tenancy:** platform-scoped callers see every invitation; `institution_admin` sees only their own institution's.
- **Success:** `200 { data: invitation[] }`. Lazily flips any overdue `pending` row to `expired` before returning.

### `DELETE /admin/invitations/:id`
- Revokes — and actually deletes the underlying (still-unconfirmed) Supabase Auth user, so the already-sent link stops working, not just a status label change.
- **Errors:** `404 NOT_FOUND` (not found or out of scope — same code either way), `409 INVALID_STATE_TRANSITION` (not `pending`).

### `POST /admin/invitations/:id/resend`
- **Errors:** `404`/`409` as above, `429 RESEND_COOLDOWN` (< 60s since last send), `429 RESEND_LIMIT_REACHED` (3 resends already used), `502 INVITE_SEND_FAILED`.

## User lifecycle administration (CL-P7)

All routes below require `users:manage_platform` **or** `users:manage_institution` — which rows a given caller can actually reach is narrowed by tenancy inside the service layer, not by which of the two permissions they hold.

### `GET /admin/users`
- **Query:** `status?`, `roleCode?`, `search?` (matches name/email substring), `page` (default 1), `pageSize` (default 20, max 100).
- **Tenancy:** platform-scoped callers see every user; `institution_admin` sees only their own institution's.
- **Success:** `200 { data: user[], total, page, pageSize }`.

### `GET /admin/users/:id`
- **Success:** `200 { data: user }` (includes `active_role_codes`, comma-joined).
- **Errors:** `404 NOT_FOUND` (not found, or exists but outside the caller's institution — same code either way).

### `PATCH /admin/users/:id`
- **Body:** `{ fullName?, mobileNumber?, preferredLanguage? }` — `.strict()`. Status and role changes go through the dedicated endpoints below, not this one.
- **Errors:** `400`, `404` as above.

### `POST /admin/users/:id/status`
- **Body:** `{ toStatus: "active"|"suspended"|"locked"|"deleted" }`.
- **Transition table** (`backend/services/adminUser.service.ts`'s `VALID_TRANSITIONS`):

  | From | May go to |
  |---|---|
  | `awaiting_verification` | `active`, `suspended`, `deleted` |
  | `active` | `suspended`, `locked`, `deleted` |
  | `suspended` | `active`, `deleted` |
  | `locked` | `active`, `deleted` |
  | `deleted` | *(none — terminal)* |

- **Effect:** every non-`active` target bans the underlying Supabase Auth identity indefinitely (confirmed live: banning kills every existing session immediately; restoring to `active` explicitly un-bans — un-banning alone resurrects the pre-ban session rather than requiring a fresh sign-in, confirmed live, which is why restore always un-bans explicitly rather than just relying on the status label).
- **Errors:** `404`, `409 INVALID_STATE_TRANSITION`, `502 AUTH_UPDATE_FAILED`.

### `POST /admin/users/:id/roles`
- **Body:** `{ roleCode, institutionId? }`. Same authority (`canGrantRole`) and tenancy rules as invitation creation.
- **Errors:** `403 FORBIDDEN`, `404`, `400 VALIDATION_ERROR` (unknown role code).

### `DELETE /admin/users/:id/roles/:roleCode`
- Same authority check as granting — a role cannot be revoked by a caller who couldn't have granted it.
- **Errors:** `403`, `404`, `409 LAST_SUPER_ADMIN` (refuses to revoke the last active `super_admin`, enforced by both `db/migrations/009_core_rbac.sql`'s trigger and surfaced here with a specific code).

### `POST /admin/users/:id/force-sign-out`
- No body. Bans the target for 60 seconds (confirmed live: kills every current session immediately; self-expires without a follow-up call) — the closest this Supabase project's admin API surface gets to "sign this person out right now" without either a real suspension or that person's own current token (no admin method accepts a bare user id for session revocation).
- **Success:** `204`.

### `POST /admin/users/:id/force-password-reset`
- No body. Sends a real Supabase recovery email to the target — the same shared two-per-hour quota. Guarded by a 60-second cooldown per target, checked against `learn.audit_log`.
- **Errors:** `404`, `429 RESEND_COOLDOWN`, `502 PASSWORD_RESET_SEND_FAILED`.

## Catalog write gate (CL-P6 — a fix, not new functionality)

`POST`/`PATCH`/`DELETE` under `/catalog/*` (`exams`, `marking-schemes`, `exam-cycles`, `subjects`, `syllabus-versions`, `exam-patterns`, `pattern-sections`, `syllabus-nodes`, `node-weightages`) now require the `catalog:write` permission (`super_admin`, `platform_admin`, `content_admin`, `system`). Previously required only `requireAuth` — any signed-in student could write platform-owned catalog data. Reads remain open, unchanged.

## `GET /admin/stats`

Requires `admin:stats` (`super_admin`, `platform_admin`). Previously had no auth middleware at all. The response body itself is still hardcoded placeholder data (`backend/controllers/adminController.ts`) — making it real is not this document's scope.
