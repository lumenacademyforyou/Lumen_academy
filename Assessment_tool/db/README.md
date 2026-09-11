# db/

The domain layer: hand-written TypeScript repositories/services/models for the
`catalog`, `core`, `content`, `assess`, and `learn` Postgres schemas, plus the
SQL that defines and verifies them.

- `catalog/`, `core/`, `content/`, `assess/`, `learn/` — one `*.model.ts` /
  `*.repository.ts` / `*.service.ts` (+ `index.ts` barrel) per entity. Imported
  only by `backend/`.
- `shared/` — cross-cutting helpers (`pool.ts`, `errors.ts`,
  `repository-helpers.ts`) used by nearly every repository/service here and by
  several `backend/` files directly.
- `config/env.ts` — boot-time env config scoped to this layer, independent of
  `backend/config.ts` so migrations/workers/repositories can run without the
  Express app.
- `migrations/*.sql` — forward-only, already applied to Supabase. **Never
  edited, only ever moved as a set.**
- `verify/*.sql` — one verification script per migration.
- `scripts/` — operational scripts: `seed/` (one-time data migration),
  `import/` (content-batch importer), `e2e/` and `prove-*.ts` (verification
  scripts against a live database).
- `reports/` — generated JSON run output from the import/compose scripts.

See `docs/CORE_LAYER_ENDPOINTS.md`, `docs/CORE_LAYER_OPERATIONS.md`, and
`docs/MIGRATION_STATE.md` for the operational detail on this layer.
