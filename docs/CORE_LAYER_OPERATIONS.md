# Core layer operations note

LA-BE-CORE-002 CL-P8 task 5.

## Environment variables required

Already documented in `.env.example`; the core layer specifically needs:
- `DATABASE_URL` — Postgres connection string (raw SQL layer + Prisma both use it).
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` — token verification (`backend/supabaseClient.ts`) and the frontend's own client.
- `SUPABASE_SERVICE_ROLE_KEY` — required for: invitations (`admin.inviteUserByEmail`), status transitions and forced sign-out (`admin.updateUserById`), and the seed/e2e scripts. Not required for normal request serving.

## Running the seed scripts

Order matters — later scripts assume earlier ones already ran:

```
npx tsx db/scripts/seed/00_core_roles.ts              # core.role / core.permission / core.role_permission + backfills
                                                        # user_role_assignment for any pre-existing core.app_user rows
npx tsx db/scripts/seed/01_catalog.ts                  # catalog reference data (pre-existing, unrelated to CL-P6/7/8)
npx tsx db/scripts/seed/02_core_lifecycle_fixture.ts   # platform root + 1 institution + 1 user of every type
```

All three are idempotent — safe to re-run. Each accepts `--dry-run` to preview without writing.

## Creating the first super administrator

`00_core_roles.ts` must have already run (it creates the `super_admin` role row). Then either:
- Run `db/scripts/seed/02_core_lifecycle_fixture.ts` — creates `super-admin@lumen.internal`, password `LumenPilot-Seed-2026!` (change it immediately in a real deployment — this is a fixture credential, not a secret), **or**
- Grant it directly to an existing account:
  ```sql
  insert into core.user_role_assignment (user_id, role_id, institution_id, granted_by, granted_at)
  select '<app_user_id>', role_id, null, '<app_user_id>', now() from core.role where role_code = 'super_admin';
  ```

## Rotating secrets

- **`SUPABASE_SERVICE_ROLE_KEY`**: rotate from the Supabase dashboard (Project Settings → API); update `.env`; restart the backend. No application state depends on the old value once rotated.
- **Fixture account passwords** (`02_core_lifecycle_fixture.ts`'s `LumenPilot-Seed-2026!`): change via `admin.updateUserById(userId, { password: '<new>' })`, or through each account's own password-reset flow once one exists to receive it.

## What "safe to run repeatedly" actually means here

- Seed scripts (`00_core_roles.ts`, `02_core_lifecycle_fixture.ts`): every write is an upsert on a real unique constraint or an existence check before insert. Confirmed live by running each twice in a row — identical IDs returned, no duplicate rows.
- The e2e script (`db/scripts/manual/e2e/core_lifecycle.ts`): generates a fresh timestamped email and institution code on every run, and deletes everything it created in a `finally` block regardless of pass or fail. Confirmed live by running it twice consecutively.
- Neither ever sends a real email — both use `admin.createUser({ email_confirm: true })`, never `signUp()` or `inviteUserByEmail()`. The two-per-hour Supabase email quota is never at risk from running either script, including in CI on every commit.

## What's genuinely unfinished, and why

- **`core.educator_profile`** is not read or written anywhere yet — no flow creates an educator profile extension today, so `GET /me` correctly never returns one; wiring it in is straightforward once a real educator-facing feature needs it.
- **Automatic account lockout** (the `locked` status's original intent — "after repeated [failed sign-in] attempts") is not implemented. `locked` exists as a status an *administrator* can set manually; nothing counts failed sign-in attempts or transitions a user into it automatically. Building that requires either a Supabase Auth webhook/hook (not configured) or tracking failed attempts in application code (nothing currently does).
- **Bulk user operations** (CL-P7 task 8) were not built — the brief says to defer them absent a genuine pilot need, and none was identified.
- **`public.users` has no FK to `auth.users`** (found in CL-P3) — `core.app_user` does, and Postgres already refuses to let an admin delete an `auth.users` row while one exists (confirmed live). The Prisma side has no equivalent protection. Flagged, not fixed — touching the Prisma migration track carries real, previously-realized risk (see `docs/MIGRATION_STATE.md`'s own incident note), so this needs an explicit go-ahead rather than a session unilaterally deciding to add it.
- **Custom SMTP** remains out of scope for the pilot (per the brief's own section 7) — every email-sending path in the core layer (registration confirmation, invitations, forced password reset) still shares Supabase's two-per-hour project quota. This is fine for a pilot's expected volume and is a named release blocker for general availability, not a defect in this work.
